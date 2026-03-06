import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const DIST_DIR = path.join(ROOT_DIR, 'apps', 'globe', 'dist', 'assets');

const BUDGETS = [
  {
    label: 'largest JS asset',
    limit: 2_000_000,
    select: (assets) => assets.filter((asset) => asset.ext === '.js').sort((a, b) => b.bytes - a.bytes)[0] ?? null,
    format: (asset) => `${asset.name} (${asset.bytes} bytes)`,
  },
  {
    label: 'total JS assets',
    limit: 2_050_000,
    select: (assets) => {
      const jsAssets = assets.filter((asset) => asset.ext === '.js');
      return {
        name: `${jsAssets.length} JS assets`,
        bytes: jsAssets.reduce((sum, asset) => sum + asset.bytes, 0),
      };
    },
    format: (asset) => `${asset.bytes} bytes across ${asset.name}`,
  },
  {
    label: 'largest CSS asset',
    limit: 110_000,
    select: (assets) => assets.filter((asset) => asset.ext === '.css').sort((a, b) => b.bytes - a.bytes)[0] ?? null,
    format: (asset) => `${asset.name} (${asset.bytes} bytes)`,
  },
  {
    label: 'total CSS assets',
    limit: 150_000,
    select: (assets) => {
      const cssAssets = assets.filter((asset) => asset.ext === '.css');
      return {
        name: `${cssAssets.length} CSS assets`,
        bytes: cssAssets.reduce((sum, asset) => sum + asset.bytes, 0),
      };
    },
    format: (asset) => `${asset.bytes} bytes across ${asset.name}`,
  },
];

if (!fs.existsSync(DIST_DIR)) {
  console.error(`Bundle budget check requires a fresh globe build. Missing: ${DIST_DIR}`);
  process.exit(1);
}

const assets = fs.readdirSync(DIST_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => {
    const fullPath = path.join(DIST_DIR, entry.name);
    return {
      name: entry.name,
      ext: path.extname(entry.name),
      bytes: fs.statSync(fullPath).size,
    };
  });

const failures = [];
for (const budget of BUDGETS) {
  const measurement = budget.select(assets);
  if (!measurement) {
    failures.push(`${budget.label}: no matching assets found`);
    continue;
  }

  const summary = budget.format(measurement);
  if (measurement.bytes > budget.limit) {
    failures.push(`${budget.label}: ${summary} exceeds ${budget.limit} bytes`);
  } else {
    console.log(`${budget.label}: ${summary} <= ${budget.limit} bytes`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}
