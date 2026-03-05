/**
 * Patch Analysis Facts — Re-compute all code-generated facts in existing analyses.
 *
 * This is the FUNDAMENTAL fix for tsunami/intensity/tectonic misclassifications.
 * Instead of invalidating + regenerating (expensive, requires AI API),
 * this directly patches the `facts` portion of each analysis JSON using
 * the corrected geo.ts functions.
 *
 * What gets patched:
 *   - facts.tsunami (risk, factors, confidence)
 *   - facts.max_intensity (value, class, is_offshore, coast_distance_km)
 *   - facts.tectonic.boundary_type, depth_class
 *   - facts.mechanism (no change, just preserved)
 *   - search_index.categories.tsunami_generated
 *
 * What does NOT change:
 *   - AI narrative text (public.why, expert.tectonic_summary, etc.)
 *   - interpretations (AI-generated)
 *   - search_tags, search_region
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
} from '@namazue/db';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL required');
const sql = neon(DATABASE_URL);

const DRY_RUN = process.argv.includes('--dry-run');

interface PatchStats {
  total: number;
  patched: number;
  tsunamiChanged: number;
  intensityChanged: number;
  offshoreFlipped: number;
  faultTypeChanged: number;
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
  if (DRY_RUN) console.log('** DRY RUN — no DB changes **\n');

  // Count
  const [{ count }] = await sql`
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
    skipped: 0,
    errors: 0,
  };

  const BATCH_SIZE = 50;
  const sampleChanges: string[] = [];

  for (let offset = 0; offset < count; offset += BATCH_SIZE) {
    const rows: any[] = await sql`
      SELECT
        a.id as analysis_id,
        a.analysis::text as analysis_text,
        e.id as event_id, e.lat, e.lng, e.depth_km, e.magnitude,
        e.place, e.place_ja, e.fault_type, e.tsunami as usgs_tsunami
      FROM analyses a
      JOIN earthquakes e ON e.id = a.event_id
      WHERE a.is_latest = true
      ORDER BY e.magnitude DESC
      LIMIT ${BATCH_SIZE} OFFSET ${offset}
    `;

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

        if (changes.length === 0) { stats.skipped++; continue; }

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
            SET analysis = ${JSON.stringify(patchedAnalysis)}::jsonb
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

    const pct = Math.round(((offset + rows.length) / count) * 100);
    process.stdout.write(`\r  Progress: ${offset + rows.length}/${count} (${pct}%) — patched: ${stats.patched}, unchanged: ${stats.skipped}`);
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
