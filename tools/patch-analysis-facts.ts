/**
 * Patch Analysis Facts + Narrative — Re-compute code-generated facts and
 * normalize user-facing narrative in existing analyses.
 *
 * This is the low-cost recovery path after hallucinated or contradictory
 * earthquake prose was saved to the DB. Instead of invalidating analyses and
 * paying for re-generation, this script:
 *   1. Recomputes factual layers from corrected geo.ts rules
 *   2. Rewrites the most error-prone narrative fields from facts using
 *      deterministic templates
 *
 * Usage:
 *   DATABASE_URL=... npx tsx tools/patch-analysis-facts.ts [--dry-run]
 */

import { neon } from '@neondatabase/serverless';
import {
  classifyLocation,
  inferFaultType,
  assessTsunamiRisk,
  computeMaxIntensity,
  canonicalizeAnalysisForStorage,
} from '@namazue/db';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL required');
const sql = neon(DATABASE_URL);

const DRY_RUN = process.argv.includes('--dry-run');
const START_OFFSET = process.env.START_OFFSET ? parseInt(process.env.START_OFFSET, 10) : 0;
const STALE_ONLY = process.env.STALE_ONLY === '1';

interface PatchStats {
  total: number;
  patched: number;
  tsunamiChanged: number;
  intensityChanged: number;
  offshoreFlipped: number;
  faultTypeChanged: number;
  narrativeChanged: number;
  skipped: number;
  errors: number;
}

function diff(label: string, oldVal: any, newVal: any): string | null {
  const o = JSON.stringify(oldVal);
  const n = JSON.stringify(newVal);
  if (o === n) return null;
  return `${label}: ${o} → ${n}`;
}

async function main() {
  console.log('=== Patch Analysis Facts ===');
  console.log('Re-computing tsunami/intensity/tectonic facts with corrected geo.ts\n');
  if (START_OFFSET > 0) console.log(`Starting from offset ${START_OFFSET}\n`);
  if (STALE_ONLY) console.log('Filtering to analyses with stale narrative markers only\n');
  if (DRY_RUN) console.log('** DRY RUN — no DB changes **\n');

  // Count
  const [{ count }] = STALE_ONLY
    ? await sql`
      SELECT count(*)::int as count
      FROM analyses a
      WHERE a.is_latest = true
        AND (
          COALESCE(a.analysis->'dashboard'->'headline'->>'ko', '') ~ '(^|\s)M ?[0-9]|깊이[[:space:]]*[0-9]+[[:space:]]*km|[0-9]+[[:space:]]*km'
          OR COALESCE(a.analysis->'dashboard'->'headline'->>'en', '') ~* '(^|\s)M ?[0-9]|depth[[:space:]]*[0-9]+[[:space:]]*km|[0-9]+[[:space:]]*km'
          OR a.analysis->'expert'->'historical_comparison' <> 'null'::jsonb
          OR (
            a.analysis->'expert'->'notable_features' <> '[]'::jsonb
            AND a.analysis->'expert'->'notable_features' <> 'null'::jsonb
          )
        )
    `
    : await sql`
      SELECT count(*)::int as count FROM analyses WHERE is_latest = true
    `;
  console.log(`Total analyses to patch: ${count}\n`);

  const stats: PatchStats = {
    total: count,
    patched: 0,
    tsunamiChanged: 0,
    intensityChanged: 0,
    offshoreFlipped: 0,
    faultTypeChanged: 0,
    narrativeChanged: 0,
    skipped: 0,
    errors: 0,
  };

  const BATCH_SIZE = 50;
  const sampleChanges: string[] = [];

  for (let offset = START_OFFSET; offset < count; offset += BATCH_SIZE) {
    const batchOffset = STALE_ONLY ? 0 : offset;
    const rows: any[] = STALE_ONLY
      ? await sql`
        SELECT
          a.id as analysis_id,
          a.analysis::text as analysis_text,
          e.id as event_id, e.lat, e.lng, e.depth_km, e.magnitude,
          e.place, e.place_ja, e.fault_type, e.tsunami as usgs_tsunami
        FROM analyses a
        JOIN earthquakes e ON e.id = a.event_id
        WHERE a.is_latest = true
          AND (
            COALESCE(a.analysis->'dashboard'->'headline'->>'ko', '') ~ '(^|\s)M ?[0-9]|깊이[[:space:]]*[0-9]+[[:space:]]*km|[0-9]+[[:space:]]*km'
            OR COALESCE(a.analysis->'dashboard'->'headline'->>'en', '') ~* '(^|\s)M ?[0-9]|depth[[:space:]]*[0-9]+[[:space:]]*km|[0-9]+[[:space:]]*km'
            OR a.analysis->'expert'->'historical_comparison' <> 'null'::jsonb
            OR (
              a.analysis->'expert'->'notable_features' <> '[]'::jsonb
              AND a.analysis->'expert'->'notable_features' <> 'null'::jsonb
            )
          )
        ORDER BY e.magnitude DESC
        LIMIT ${BATCH_SIZE} OFFSET ${batchOffset}
      `
      : await sql`
        SELECT
          a.id as analysis_id,
          a.analysis::text as analysis_text,
          e.id as event_id, e.lat, e.lng, e.depth_km, e.magnitude,
          e.place, e.place_ja, e.fault_type, e.tsunami as usgs_tsunami
        FROM analyses a
        JOIN earthquakes e ON e.id = a.event_id
        WHERE a.is_latest = true
        ORDER BY e.magnitude DESC
        LIMIT ${BATCH_SIZE} OFFSET ${batchOffset}
      `;

    if (STALE_ONLY && rows.length === 0) break;

    for (const r of rows) {
      try {
        const analysis = JSON.parse(r.analysis_text);
        const oldFacts = analysis.facts;
        if (!oldFacts) { stats.skipped++; continue; }

        // Re-compute with corrected code
        const loc = classifyLocation(r.lat, r.lng, r.place, r.place_ja);
        const faultType = r.fault_type || inferFaultType(r.depth_km, r.lat, r.lng, r.place, r.place_ja);
        const isOffshore = loc.type !== 'inland';

        const newTsunami = assessTsunamiRisk(
          r.magnitude, r.depth_km, faultType,
          r.lat, r.lng, r.place, r.place_ja, r.usgs_tsunami,
        );
        const newMaxIntensity = computeMaxIntensity(
          r.magnitude, r.depth_km, faultType, isOffshore, loc.coastDistanceKm,
        );

        // Determine boundary_type using same logic as generate-analyses
        function classifyBoundary(ft?: string, depth?: number): string {
          if (ft === 'interface') return 'subduction_interface';
          if (ft === 'intraslab') return 'intraslab';
          if (ft === 'crustal') return (depth ?? 0) > 30 ? 'intraplate_deep' : 'intraplate_shallow';
          return 'unknown';
        }
        function classifyDepthClass(depth: number): string {
          if (depth < 30) return 'shallow';
          if (depth < 70) return 'mid';
          if (depth < 300) return 'intermediate';
          return 'deep';
        }

        const newBoundaryType = classifyBoundary(faultType, r.depth_km);
        const newDepthClass = classifyDepthClass(r.depth_km);

        // Check what changed
        const changes: string[] = [];

        const tsunamiDiff = diff('tsunami.risk', oldFacts.tsunami?.risk, newTsunami.risk);
        if (tsunamiDiff) { changes.push(tsunamiDiff); stats.tsunamiChanged++; }

        const intensityDiff = diff('max_intensity.value', oldFacts.max_intensity?.value, newMaxIntensity.value);
        if (intensityDiff) { changes.push(intensityDiff); stats.intensityChanged++; }

        const offshoreDiff = diff('is_offshore', oldFacts.max_intensity?.is_offshore, newMaxIntensity.is_offshore);
        if (offshoreDiff) { changes.push(offshoreDiff); stats.offshoreFlipped++; }

        const boundaryDiff = diff('boundary_type', oldFacts.tectonic?.boundary_type, newBoundaryType);
        if (boundaryDiff) { changes.push(boundaryDiff); stats.faultTypeChanged++; }

        // Build patched facts
        const patchedFacts = {
          ...oldFacts,
          tsunami: newTsunami,
          max_intensity: newMaxIntensity,
          tectonic: {
            ...oldFacts.tectonic,
            boundary_type: newBoundaryType,
            depth_class: newDepthClass,
          },
        };

        // Patch search_index.categories
        const patchedAnalysis = {
          ...analysis,
          facts: patchedFacts,
        };
        if (patchedAnalysis.search_index?.categories) {
          patchedAnalysis.search_index.categories.tsunami_generated = newTsunami.risk !== 'none';
          patchedAnalysis.search_index.categories.boundary = newBoundaryType;
          patchedAnalysis.search_index.categories.depth_class = newDepthClass;
        }

        const normalizedAnalysis = canonicalizeAnalysisForStorage(patchedAnalysis, {
          magnitude: r.magnitude,
          depth_km: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          place: r.place,
          place_ja: r.place_ja,
        });

        const narrativeChanged = JSON.stringify({
          dashboard: patchedAnalysis.dashboard,
          public: patchedAnalysis.public,
          expert: patchedAnalysis.expert,
          interpretations: patchedAnalysis.interpretations,
        }) !== JSON.stringify({
          dashboard: normalizedAnalysis.dashboard,
          public: normalizedAnalysis.public,
          expert: normalizedAnalysis.expert,
          interpretations: normalizedAnalysis.interpretations,
        });

        if (narrativeChanged) {
          changes.push('narrative normalized');
          stats.narrativeChanged++;
        }

        if (changes.length === 0) { stats.skipped++; continue; }

        // Log sample
        if (sampleChanges.length < 20) {
          const place = (r.place ?? r.place_ja ?? '').slice(0, 40);
          sampleChanges.push(
            `  M${r.magnitude} ${place} (${r.depth_km}km)\n    ${changes.join(' | ')}`,
          );
        }

        // Write to DB
        if (!DRY_RUN) {
          await sql`
            UPDATE analyses
            SET analysis = ${JSON.stringify(normalizedAnalysis)}::jsonb
            WHERE id = ${r.analysis_id}
          `;
        }

        stats.patched++;
      } catch (err: any) {
        stats.errors++;
        if (stats.errors <= 5) {
          console.error(`\n  Error patching ${r.event_id}: ${(err.message ?? '').slice(0, 100)}`);
        }
      }
    }

    const processed = STALE_ONLY
      ? stats.patched + stats.skipped + stats.errors
      : offset + rows.length;
    const pct = Math.min(100, Math.round((processed / count) * 100));
    process.stdout.write(`\r  Progress: ${processed}/${count} (${pct}%) — patched: ${stats.patched}, unchanged: ${stats.skipped}`);
  }

  console.log('\n');

  // Report
  console.log('═'.repeat(60));
  console.log('PATCH RESULTS');
  console.log('═'.repeat(60));
  console.log(`  Total analyses: ${stats.total}`);
  console.log(`  Patched:        ${stats.patched}`);
  console.log(`  Unchanged:      ${stats.skipped}`);
  console.log(`  Errors:         ${stats.errors}`);
  console.log();
  console.log('Breakdown of changes:');
  console.log(`  Tsunami risk changed:    ${stats.tsunamiChanged}`);
  console.log(`  Intensity changed:       ${stats.intensityChanged}`);
  console.log(`  Offshore flag flipped:   ${stats.offshoreFlipped}`);
  console.log(`  Fault type changed:      ${stats.faultTypeChanged}`);
  console.log(`  Narrative normalized:    ${stats.narrativeChanged}`);

  if (sampleChanges.length > 0) {
    console.log('\nSample changes:');
    for (const s of sampleChanges) console.log(s);
  }

  if (DRY_RUN) {
    console.log('\n** DRY RUN — no changes made. Remove --dry-run to execute. **');
  } else {
    console.log(`\nDone! ${stats.patched} analyses patched with corrected facts.`);
  }
}

main().catch(console.error);
