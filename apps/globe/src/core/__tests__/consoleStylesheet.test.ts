import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const CONSOLE_CSS_PATH = resolve(TEST_DIR, '../console.css');

const EXPECTED_IMPORTS = [
  './styles/fonts.css',
  './styles/tokens.css',
  './styles/base.css',
  './styles/layout.css',
  './styles/panels-summary.css',
  './styles/controls.css',
  './styles/panels-ops.css',
  './styles/palette.css',
  './styles/timeline.css',
  './styles/notifications.css',
  './styles/modals.css',
  './styles/tooltip.css',
  './styles/responsive.css',
];

describe('console stylesheet structure', () => {
  it('keeps console.css as a thin entry file that imports modular partials', () => {
    const source = readFileSync(CONSOLE_CSS_PATH, 'utf8');
    const imports = [...source.matchAll(/@import ['"](.+?)['"];/g)].map((match) => match[1]);
    const residual = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@import ['"].+?['"];/g, '')
      .trim();

    expect(imports).toEqual(EXPECTED_IMPORTS);
    expect(residual).toBe('');

    for (const relativePath of EXPECTED_IMPORTS) {
      const absolutePath = resolve(dirname(CONSOLE_CSS_PATH), relativePath);
      expect(existsSync(absolutePath)).toBe(true);
    }
  });
});
