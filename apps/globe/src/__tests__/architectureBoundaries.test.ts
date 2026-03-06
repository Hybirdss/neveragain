import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const boundaryScript = path.join(repoRoot, 'tools', 'check-dependency-boundaries.mjs');

describe('repository dependency boundaries', () => {
  it('has no forbidden cross-layer imports in the current repo', () => {
    const output = execFileSync(process.execPath, [boundaryScript], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('No dependency boundary violations found.');
  });
});
