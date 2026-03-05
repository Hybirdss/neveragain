/**
 * Audit existing AI analyses for data quality errors.
 *
 * Usage: DATABASE_URL=... npx tsx tools/audit-analyses.ts
 */

import { neon } from '@neondatabase/serverless';
import { classifyLocation } from '@namazue/db';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL required');
const sql = neon(DATABASE_URL);

interface AuditIssue {
  eventId: string;
  place: string;
  magnitude: number;
  depth: number;
  lat: number;
  lng: number;
  category: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  currentValue: string;
  expectedValue: string;
}

async function main() {
  console.log('=== Namazue Analysis Quality Audit ===\n');

  // Get total count first
  const [{ count }] = await sql`
    SELECT count(*)::int as count FROM analyses WHERE is_latest = true
  `;
  console.log(`Total analyses to audit: ${count}\n`);

  // Fetch in batches to avoid 64MB response limit
  const BATCH_SIZE = 50;
  const rows: any[] = [];

  for (let offset = 0; offset < count; offset += BATCH_SIZE) {
    const batch: any[] = await sql`
      SELECT
        e.id, e.lat, e.lng, e.depth_km, e.magnitude, e.place, e.place_ja,
        e.fault_type, e.time, e.mag_type, e.tsunami,
        e.mt_strike, e.mt_dip, e.mt_rake,
        a.analysis::text as analysis_text,
        a.context::text as context_text,
        a.tier, a.model
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

  const issues: AuditIssue[] = [];

  for (const r of rows) {
    const analysis = JSON.parse(r.analysis_text);
    const context = JSON.parse(r.context_text);
    const facts = analysis.facts || context;

    // Correct classification using new module
    const loc = classifyLocation(r.lat, r.lng, r.place, r.place_ja);

    // ─── 1. Tsunami Classification Audit ───
    const tsunami = facts.tsunami;
    if (tsunami) {
      const oldFactors = tsunami.factors || [];
      const oldIsInland = oldFactors.some((f: string) =>
        f.toLowerCase().includes('inland') || f === 'inland'
      );

      if (oldIsInland && loc.type !== 'inland') {
        issues.push({
          eventId: r.id,
          place: r.place || r.place_ja || '',
          magnitude: r.magnitude,
          depth: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          category: 'tsunami_misclassification',
          severity: 'critical',
          description: `Classified as "inland" but actually "${loc.type}"`,
          currentValue: `factors: ${JSON.stringify(oldFactors)}`,
          expectedValue: `type: ${loc.type}, ~${loc.coastDistanceKm}km from coast (${loc.reason})`,
        });
      }

      // Check offshore events classified as inland that affect tsunami risk
      if (tsunami.risk === 'none' && oldIsInland && loc.type === 'offshore' && r.magnitude >= 5.5) {
        issues.push({
          eventId: r.id,
          place: r.place || r.place_ja || '',
          magnitude: r.magnitude,
          depth: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          category: 'tsunami_risk_underestimated',
          severity: 'critical',
          description: `M${r.magnitude} offshore event has tsunami risk "none" due to inland misclassification`,
          currentValue: `risk: none, factors: ${JSON.stringify(oldFactors)}`,
          expectedValue: `Should have at least "low" risk for M${r.magnitude} offshore event`,
        });
      }
    }

    // ─── 2. Max Intensity Audit ───
    const mi = facts.max_intensity;
    if (mi) {
      // is_offshore mismatch
      const shouldBeOffshore = loc.type !== 'inland';
      if (mi.is_offshore !== shouldBeOffshore) {
        issues.push({
          eventId: r.id,
          place: r.place || r.place_ja || '',
          magnitude: r.magnitude,
          depth: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          category: 'intensity_offshore_flag',
          severity: 'major',
          description: `max_intensity.is_offshore=${mi.is_offshore} but location is "${loc.type}"`,
          currentValue: `is_offshore: ${mi.is_offshore}`,
          expectedValue: `is_offshore: ${shouldBeOffshore}`,
        });
      }

      // Sanity check: intensity value vs magnitude
      if (r.magnitude >= 7.0 && mi.value < 3.0) {
        issues.push({
          eventId: r.id,
          place: r.place || r.place_ja || '',
          magnitude: r.magnitude,
          depth: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          category: 'intensity_too_low',
          severity: 'major',
          description: `M${r.magnitude} earthquake with max intensity ${mi.value} (${mi.class}) seems too low`,
          currentValue: `value: ${mi.value}, class: ${mi.class}`,
          expectedValue: `M7+ should generally produce JMA 4+ at least`,
        });
      }

      // Deep earthquakes should have lower intensity
      if (r.depth_km > 300 && mi.value > 5.5) {
        issues.push({
          eventId: r.id,
          place: r.place || r.place_ja || '',
          magnitude: r.magnitude,
          depth: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          category: 'intensity_deep_event',
          severity: 'minor',
          description: `Deep event (${r.depth_km}km) with high intensity ${mi.value} — verify GMPE valid range`,
          currentValue: `depth: ${r.depth_km}km, intensity: ${mi.value}`,
          expectedValue: `Deep events typically produce lower surface intensity`,
        });
      }
    }

    // ─── 3. Fault Type Audit ───
    const tec = facts.tectonic;
    if (tec) {
      // Interface fault type for clearly inland events
      if (tec.boundary_type === 'subduction_interface' && loc.type === 'inland' && r.depth_km < 30) {
        issues.push({
          eventId: r.id,
          place: r.place || r.place_ja || '',
          magnitude: r.magnitude,
          depth: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          category: 'fault_type_mismatch',
          severity: 'major',
          description: `Classified as "subduction_interface" but event is inland and shallow (${r.depth_km}km)`,
          currentValue: `boundary_type: ${tec.boundary_type}`,
          expectedValue: `Likely "intraplate_shallow" or "crustal" for inland shallow event`,
        });
      }

      // Intraslab at very shallow depth
      if (tec.boundary_type === 'intraslab' && r.depth_km < 20) {
        issues.push({
          eventId: r.id,
          place: r.place || r.place_ja || '',
          magnitude: r.magnitude,
          depth: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          category: 'fault_type_depth_mismatch',
          severity: 'minor',
          description: `Classified as "intraslab" but depth (${r.depth_km}km) is too shallow for slab`,
          currentValue: `boundary_type: ${tec.boundary_type}, depth: ${r.depth_km}km`,
          expectedValue: `Intraslab typically > 60km depth`,
        });
      }

      // Plate classification sanity
      if (tec.plate === 'other' && r.lat >= 20 && r.lat <= 50 && r.lng >= 120 && r.lng <= 155) {
        issues.push({
          eventId: r.id,
          place: r.place || r.place_ja || '',
          magnitude: r.magnitude,
          depth: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          category: 'plate_unknown',
          severity: 'minor',
          description: `Plate classified as "other" for Japan-region event`,
          currentValue: `plate: ${tec.plate}`,
          expectedValue: `Should be pacific/philippine/north_american/eurasian`,
        });
      }
    }

    // ─── 4. Aftershock Forecast Audit ───
    const af = facts.aftershocks;
    if (af && af.forecast) {
      // Probability > 100% (rounding error)
      const probs = [
        af.forecast.p24h_m4plus, af.forecast.p7d_m4plus, af.forecast.p30d_m4plus,
        af.forecast.p24h_m5plus, af.forecast.p7d_m5plus, af.forecast.p30d_m5plus,
      ];
      for (const p of probs) {
        if (p !== undefined && p > 100) {
          issues.push({
            eventId: r.id,
            place: r.place || r.place_ja || '',
            magnitude: r.magnitude,
            depth: r.depth_km,
            lat: r.lat,
            lng: r.lng,
            category: 'aftershock_probability_overflow',
            severity: 'major',
            description: `Aftershock probability > 100%`,
            currentValue: `p=${p}%`,
            expectedValue: `Should be capped at 99%`,
          });
          break;
        }
      }

      // Bath's law: expected max aftershock > mainshock
      if (af.bath_expected_max > r.magnitude) {
        issues.push({
          eventId: r.id,
          place: r.place || r.place_ja || '',
          magnitude: r.magnitude,
          depth: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          category: 'bath_law_violation',
          severity: 'minor',
          description: `Bath expected max (M${af.bath_expected_max}) > mainshock (M${r.magnitude})`,
          currentValue: `bath_max: M${af.bath_expected_max}`,
          expectedValue: `Should be < M${r.magnitude}`,
        });
      }
    }

    // ─── 5. USGS Tsunami Flag vs Rule Engine ───
    if (r.tsunami === true && tsunami && tsunami.risk === 'none') {
      issues.push({
        eventId: r.id,
        place: r.place || r.place_ja || '',
        magnitude: r.magnitude,
        depth: r.depth_km,
        lat: r.lat,
        lng: r.lng,
        category: 'tsunami_flag_contradiction',
        severity: 'critical',
        description: `USGS tsunami flag is TRUE but rule engine says "none"`,
        currentValue: `usgs_tsunami: true, rule_engine: none`,
        expectedValue: `Rule engine should at least say "low" when USGS flags tsunami`,
      });
    }

    // ─── 6. Mechanism Data Consistency ───
    const mech = facts.mechanism;
    if (mech && mech.status === 'available') {
      // Strike/dip/rake range checks
      if (mech.strike < 0 || mech.strike > 360) {
        issues.push({
          eventId: r.id,
          place: r.place || r.place_ja || '',
          magnitude: r.magnitude,
          depth: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          category: 'mechanism_out_of_range',
          severity: 'major',
          description: `Strike out of range: ${mech.strike}`,
          currentValue: `strike: ${mech.strike}`,
          expectedValue: `Should be 0-360`,
        });
      }
      if (mech.dip < 0 || mech.dip > 90) {
        issues.push({
          eventId: r.id,
          place: r.place || r.place_ja || '',
          magnitude: r.magnitude,
          depth: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          category: 'mechanism_out_of_range',
          severity: 'major',
          description: `Dip out of range: ${mech.dip}`,
          currentValue: `dip: ${mech.dip}`,
          expectedValue: `Should be 0-90`,
        });
      }
    }

    // ─── 7. Location / Coordinate Sanity ───
    if (r.lat < 20 || r.lat > 50 || r.lng < 120 || r.lng > 155) {
      // Check if marked as Japan
      if (tec && tec.is_japan === true) {
        issues.push({
          eventId: r.id,
          place: r.place || r.place_ja || '',
          magnitude: r.magnitude,
          depth: r.depth_km,
          lat: r.lat,
          lng: r.lng,
          category: 'location_japan_mismatch',
          severity: 'minor',
          description: `is_japan=true but coordinates outside Japan bounds`,
          currentValue: `lat: ${r.lat}, lng: ${r.lng}`,
          expectedValue: `lat 20-50, lng 120-155 for Japan`,
        });
      }
    }

    // ─── 8. Ground Motion Model Sanity ───
    const gm = facts.ground_motion;
    if (gm) {
      if (gm.vs30 !== 400 && gm.vs30 !== undefined) {
        // Non-default Vs30 — not necessarily wrong, just flagging
      }
    }
  }

  // ─── Report ───
  console.log('\n' + '═'.repeat(80));
  console.log('AUDIT RESULTS');
  console.log('═'.repeat(80));

  const critical = issues.filter(i => i.severity === 'critical');
  const major = issues.filter(i => i.severity === 'major');
  const minor = issues.filter(i => i.severity === 'minor');

  console.log(`\nTotal issues: ${issues.length}`);
  console.log(`  Critical: ${critical.length}`);
  console.log(`  Major: ${major.length}`);
  console.log(`  Minor: ${minor.length}`);

  // Group by category
  const byCategory = new Map<string, AuditIssue[]>();
  for (const issue of issues) {
    const arr = byCategory.get(issue.category) || [];
    arr.push(issue);
    byCategory.set(issue.category, arr);
  }

  for (const [cat, catIssues] of byCategory) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Category: ${cat} (${catIssues.length} issues)`);
    console.log('─'.repeat(60));

    // Show up to 5 examples per category
    for (const issue of catIssues.slice(0, 5)) {
      console.log(`\n  [${issue.severity.toUpperCase()}] ${issue.eventId}`);
      console.log(`    M${issue.magnitude} ${issue.place} (${issue.lat}, ${issue.lng}) depth=${issue.depth}km`);
      console.log(`    ${issue.description}`);
      console.log(`    Current: ${issue.currentValue}`);
      console.log(`    Expected: ${issue.expectedValue}`);
    }
    if (catIssues.length > 5) {
      console.log(`\n  ... and ${catIssues.length - 5} more`);
    }
  }

  // Summary of affected events for re-generation
  const affectedIds = [...new Set(issues.filter(i => i.severity === 'critical').map(i => i.eventId))];
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`Events needing re-generation (critical issues): ${affectedIds.length}`);
  if (affectedIds.length > 0 && affectedIds.length <= 50) {
    console.log(affectedIds.join('\n'));
  }
}

main().catch(console.error);
