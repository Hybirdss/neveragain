import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectDependencyBoundaryViolations,
  summarizeDependencyBoundaryViolations,
} from '../check-dependency-boundaries.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.join(__dirname, 'fixtures', 'dependency-boundaries');

test('collectDependencyBoundaryViolations reports forbidden cross-app and package-to-app imports', () => {
  const fixtureRoot = path.join(fixturesRoot, 'invalid');
  const violations = collectDependencyBoundaryViolations({ rootDir: fixtureRoot });

  assert.deepEqual(
    violations.map((entry) => `${entry.ruleId}:${entry.sourcePath}->${entry.importPath}`).sort(),
    [
      'domain-kernel-only:packages/domain-earthquake/index.ts->@namazue/globe',
      'globe-no-adapters:apps/globe/src/badAdapter.ts->@namazue/adapters-usgs',
      'globe-no-worker:apps/globe/src/bad.ts->@namazue/worker',
      'packages-no-apps:packages/domain-earthquake/index.ts->@namazue/globe',
      'packages-no-apps:packages/ops/index.ts->../../apps/globe/src/core/bootstrap.ts',
      'worker-no-globe:apps/worker/src/bad.ts->../../globe/src/core/bootstrap.ts',
    ],
  );

  const summary = summarizeDependencyBoundaryViolations(violations);
  assert.match(summary, /worker-no-globe/);
  assert.match(summary, /globe-no-worker/);
  assert.match(summary, /globe-no-adapters/);
  assert.match(summary, /packages-no-apps/);
  assert.match(summary, /domain-kernel-only/);
});

test('collectDependencyBoundaryViolations allows valid app-to-package imports', () => {
  const fixtureRoot = path.join(fixturesRoot, 'valid');
  const violations = collectDependencyBoundaryViolations({ rootDir: fixtureRoot });

  assert.deepEqual(violations, []);
});
