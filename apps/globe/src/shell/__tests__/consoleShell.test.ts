import { describe, expect, it } from 'vitest';

import {
  CONSOLE_SHELL_HTML,
  CONSOLE_SHELL_SLOT_IDS,
} from '../consoleShell';

describe('consoleShell', () => {
  it('exposes stable shell slots for runtime composition', () => {
    expect(CONSOLE_SHELL_SLOT_IDS).toEqual([
      'nz-map',
      'nz-system-bar',
      'nz-region',
      'nz-status',
      'nz-settings-btn',
      'nz-rail-left',
      'nz-rail-right',
      'nz-timeline-host',
      'nz-bottom-drawer-host',
      'nz-bottom-bar',
    ]);

    for (const slotId of CONSOLE_SHELL_SLOT_IDS) {
      expect(CONSOLE_SHELL_HTML).toContain(`id="${slotId}"`);
    }
  });
});
