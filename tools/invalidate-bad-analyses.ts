/**
 * Invalidate analyses that have critical data quality issues.
 * Sets is_latest = false so generate-analyses.ts can re-generate them.
 *
 * Usage: DATABASE_URL=... npx tsx tools/invalidate-bad-analyses.ts [--dry-run]
 */

import { neon } from '@neondatabase/serverless';
import { classifyLocation } from '@namazue/db';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL required');
const sql = neon(DATABASE_URL);

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('=== Invalidate Bad Analyses ===');
  if (DRY_RUN) console.log('  ** DRY RUN — no DB changes **\n');

  // Get total count
  const [{ count }] = await sql`
    SELECT count(*)::int as count FROM analyses WHERE is_latest = true
  `;
  console.log(`Total analyses: ${count}\n`);

  // Fetch in batches
  const BATCH_SIZE = 50;
  const rows: any[] = [];
  for (let offset = 0; offset < count; offset += BATCH_SIZE) {
    const batch: any[] = await sql`
      SELECT
        e.id, e.lat, e.lng, e.depth_km, e.magnitude, e.place, e.place_ja,
        e.tsunami,
        a.analysis::text as analysis_text,
        a.context::text as context_text
      FROM analyses a
      JOIN earthquakes e ON e.id = a.event_id
      WHERE a.is_latest = true
      ORDER BY e.magnitude DESC
      LIMIT ${BATCH_SIZE} OFFSET ${offset}
    `;
    rows.push(...batch);
    process.stdout.write(`\r  Fetched: ${rows.length}/${count}`);
  }
  console.log(' ✓\n');

  // Find events with critical issues
  const badEventIds: Set<string> = new Set();
  const reasons: Map<string, string[]> = new Map();

  for (const r of rows) {
    const analysis = JSON.parse(r.analysis_text);
    const context = JSON.parse(r.context_text);
    const facts = analysis.facts || context;
    const loc = classifyLocation(r.lat, r.lng, r.place, r.place_ja);
    const eventReasons: string[] = [];

    // 1. Tsunami misclassification
    const tsunami = facts.tsunami;
    if (tsunami) {
      const oldFactors = tsunami.factors || [];
      const oldIsInland = oldFactors.some((f: string) =>
        f.toLowerCase().includes('inland') || f === 'inland'
      );
      if (oldIsInland && loc.type !== 'inland') {
        eventReasons.push(`tsunami: classified as inland but actually ${loc.type}`);
      }
    }

    // 2. USGS tsunami flag contradiction
    if (r.tsunami === true && tsunami && tsunami.risk === 'none') {
      eventReasons.push(`tsunami: USGS flag=true but risk=none`);
    }

    // 3. Max intensity offshore flag wrong
    const mi = facts.max_intensity;
    if (mi && mi.value !== null && mi.value !== undefined) {
      const shouldBeOffshore = loc.type !== 'inland';
      if (mi.is_offshore !== shouldBeOffshore) {
        eventReasons.push(`intensity: is_offshore=${mi.is_offshore} should be ${shouldBeOffshore}`);
      }
    }

    // 4. Fault type mismatch (shallow inland classified as subduction_interface)
    const tec = facts.tectonic;
    if (tec && tec.boundary_type === 'subduction_interface' && loc.type === 'inland' && r.depth_km < 30) {
      eventReasons.push(`fault: subduction_interface but inland shallow`);
    }

    // 5. Deep event (>300km) with tsunami risk (physically impossible)
    if (r.depth_km > 300 && tsunami && tsunami.risk !== 'none') {
      eventReasons.push(`tsunami: deep event (${r.depth_km}km) should have risk=none, got ${tsunami.risk}`);
    }

    // 6. (Retired) Intensity Mw cap at 8.3 — fixed in geo.ts, cap now 9.5

    // 7. Global event with Japan-specific tectonic classification
    if (tec && tec.is_japan === false && tec.plate && tec.plate !== 'other') {
      eventReasons.push(`tectonic: non-Japan event classified as plate=${tec.plate}`);
    }

    // 8. Spatial stats = 0 (resume mode bug — should have real data)
    const spatial = facts.spatial;
    if (spatial && spatial.total === 0) {
      eventReasons.push(`spatial: total=0 (resume mode bug)`);
    }

    // 9. Deep event + USGS tsunami flag but factors missing USGS note
    if (r.depth_km > 300 && r.tsunami === true && tsunami) {
      const hasUsgsNote = (tsunami.factors || []).some((f: string) =>
        f.toLowerCase().includes('usgs')
      );
      if (!hasUsgsNote) {
        eventReasons.push(`tsunami: deep+USGS flag but factors missing USGS note`);
      }
    }

    // 10. Noto peninsula reclassification (was inland, should be near_coast)
    if (loc.type === 'near_coast' || loc.type === 'offshore') {
      const mi3 = facts.max_intensity;
      if (mi3 && mi3.is_offshore === false) {
        eventReasons.push(`intensity: location now ${loc.type} but is_offshore=false`);
      }
    }

    if (eventReasons.length > 0) {
      badEventIds.add(r.id);
      reasons.set(r.id, eventReasons);
    }
  }

  console.log(`Events to invalidate: ${badEventIds.size}\n`);

  // Show breakdown by magnitude
  const byMag = { m7plus: 0, m6: 0, m5: 0, m4: 0 };
  for (const r of rows) {
    if (!badEventIds.has(r.id)) continue;
    if (r.magnitude >= 7) byMag.m7plus++;
    else if (r.magnitude >= 6) byMag.m6++;
    else if (r.magnitude >= 5) byMag.m5++;
    else byMag.m4++;
  }
  console.log(`  M7+: ${byMag.m7plus}`);
  console.log(`  M6-6.9: ${byMag.m6}`);
  console.log(`  M5-5.9: ${byMag.m5}`);
  console.log(`  M4-4.9: ${byMag.m4}`);

  // Show sample
  console.log('\nSample invalidations:');
  let shown = 0;
  for (const r of rows) {
    if (!badEventIds.has(r.id)) continue;
    if (shown >= 10) break;
    console.log(`  M${r.magnitude} ${(r.place ?? r.place_ja ?? '').slice(0, 50)}`);
    for (const reason of reasons.get(r.id) ?? []) {
      console.log(`    → ${reason}`);
    }
    shown++;
  }

  if (DRY_RUN) {
    console.log('\n** DRY RUN — no changes made. Remove --dry-run to execute. **');
    return;
  }

  // Execute invalidation in batches
  const ids = [...badEventIds];
  const INVALIDATE_BATCH = 100;
  let invalidated = 0;

  for (let i = 0; i < ids.length; i += INVALIDATE_BATCH) {
    const batch = ids.slice(i, i + INVALIDATE_BATCH);
    await sql`
      UPDATE analyses SET is_latest = false
      WHERE event_id = ANY(${batch}) AND is_latest = true
    `;
    invalidated += batch.length;
    process.stdout.write(`\r  Invalidated: ${invalidated}/${ids.length}`);
  }
  console.log(' ✓');

  console.log(`\nDone! ${invalidated} analyses invalidated.`);
  console.log(`Run generate-analyses.ts to re-generate them.`);
}

main().catch(console.error);
