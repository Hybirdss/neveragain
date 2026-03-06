import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const SHIM_FILES = new Set([
  'types.ts',
  path.join('data', 'eventEnvelope.ts'),
  path.join('engine', 'gmpe.ts'),
  path.join('ops', 'assetCatalog.ts'),
  path.join('ops', 'assetClassRegistry.ts'),
  path.join('ops', 'bundleDomainOverviews.ts'),
  path.join('ops', 'bundleSummaries.ts'),
  path.join('ops', 'eventSelection.ts'),
  path.join('ops', 'exposure.ts'),
  path.join('ops', 'priorities.ts'),
  path.join('ops', 'readModelTypes.ts'),
  path.join('ops', 'serviceReadModel.ts'),
  path.join('ops', 'types.ts'),
  path.join('ops', 'viewport.ts'),
]);

const SHARED_SHIM_IMPORT = /from\s+['"]((?:\.\.\/)+(?:types|ops\/[^'"]+|data\/eventEnvelope|engine\/gmpe))['"]/g;
const ALLOWED_LOCAL_OPS_IMPORTS = new Set([
  'ops/focus',
  'ops/maritimeTelemetry',
  'ops/presentation',
  'ops/scenarioShift',
  'ops/serviceSelectors',
]);

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (entry.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('globe direct ops imports', () => {
  it('does not route internal shared-domain imports through compatibility shims', () => {
    const violations: string[] = [];

    for (const file of collectSourceFiles(ROOT)) {
      const relativePath = path.relative(ROOT, file);
      if (SHIM_FILES.has(relativePath)) {
        continue;
      }

      const source = readFileSync(file, 'utf8');
      const matches = [...source.matchAll(SHARED_SHIM_IMPORT)];
      for (const match of matches) {
        const normalizedImport = match[1]!.replace(/^(\.\.\/)+/, '');
        if (ALLOWED_LOCAL_OPS_IMPORTS.has(normalizedImport)) {
          continue;
        }
        violations.push(`${relativePath}: ${match[1]}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
