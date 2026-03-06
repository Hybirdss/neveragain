const { Client } = require('pg');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows } = await client.query(`
    SELECT
      id::text,
      COALESCE(name_ja, 'Fault ' || id) as name,
      COALESCE(name_en, 'Fault ' || id) as name_en,
      fault_type,
      estimated_mw,
      length_km,
      COALESCE(recurrence_years, 0) as recurrence_years,
      COALESCE(probability_30yr, 0) as probability_30yr,
      ST_AsGeoJSON(geom)::json->'coordinates' as segments
    FROM active_faults
    WHERE ST_Y(ST_Centroid(geom)) BETWEEN 24 AND 46
      AND ST_X(ST_Centroid(geom)) BETWEEN 122 AND 150
    ORDER BY estimated_mw DESC
  `);

  function mapFaultType(ft) {
    if (!ft) return 'crustal';
    if (ft.includes('transform') || ft === 'spreading_ridge') return 'interface';
    return 'crustal';
  }

  const faults = rows.map(r => ({
    id: 'af-' + r.id,
    name: r.name,
    nameEn: r.name_en,
    segments: r.segments.map(([lng, lat]) => [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5]),
    lengthKm: Math.round(r.length_km * 10) / 10,
    estimatedMw: r.estimated_mw,
    depthKm: 15,
    faultType: mapFaultType(r.fault_type),
    interval: r.recurrence_years > 0 ? r.recurrence_years + '年' : 'N/A',
    probability30yr: r.probability_30yr > 0 ? (r.probability_30yr * 100).toFixed(1) + '%' : 'N/A',
  }));

  // Major subduction zone faults not in AIST DB — hand-curated plate boundaries
  const trenchFaults = [
    {
      id: 'nankai-trough', name: '南海トラフ', nameEn: 'Nankai Trough',
      segments: [[132,32.5],[133,33],[134,33.5],[135,33.8],[136,34],[137,34.2]],
      lengthKm: 700, estimatedMw: 9.1, depthKm: 20, faultType: 'interface',
      interval: '100-150年', probability30yr: '70-80%',
    },
    {
      id: 'sagami-trough', name: '相模トラフ', nameEn: 'Sagami Trough',
      segments: [[139.2,34.8],[139.5,34.5],[139.8,34.2],[140.2,34]],
      lengthKm: 200, estimatedMw: 8.0, depthKm: 25, faultType: 'interface',
      interval: '200-400年', probability30yr: '0-5%',
    },
    {
      id: 'japan-trench-tohoku', name: '日本海溝（東北沖）', nameEn: 'Japan Trench (Tohoku)',
      segments: [[142.5,36],[143,37.5],[143.5,39],[144,40.5],[144.5,41.5]],
      lengthKm: 800, estimatedMw: 9.0, depthKm: 24, faultType: 'interface',
      interval: '600年', probability30yr: 'N/A',
    },
    {
      id: 'kuril-trench', name: '千島海溝', nameEn: 'Kuril Trench',
      segments: [[145,42],[146,43],[147,44],[148,45]],
      lengthKm: 500, estimatedMw: 8.8, depthKm: 30, faultType: 'interface',
      interval: '340-380年', probability30yr: '7-40%',
    },
  ];

  const allFaults = [...trenchFaults, ...faults];

  fs.writeFileSync('apps/globe/public/data/active-faults.json', JSON.stringify(allFaults));
  console.log('Exported', allFaults.length, 'faults (' + trenchFaults.length + ' trenches + ' + faults.length + ' from DB)');
  console.log('File size:', (fs.statSync('apps/globe/public/data/active-faults.json').size / 1024).toFixed(1), 'KB');

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
