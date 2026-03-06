import { describe, expect, it } from 'vitest';

import {
  canActivateCrossSection,
  resolvePresetAfterSelectionChange,
  resolvePresetForMobileSnap,
} from '../expertPresetGuard';

describe('resolvePresetAfterSelectionChange', () => {
  it('resets crossSection to default on deselect', () => {
    expect(resolvePresetAfterSelectionChange({
      currentPreset: 'crossSection',
      previousSelectedId: 'eq-1',
      nextSelectedId: null,
    })).toBe('default');
  });

  it('resets crossSection to default when incident changes', () => {
    expect(resolvePresetAfterSelectionChange({
      currentPreset: 'crossSection',
      previousSelectedId: 'eq-1',
      nextSelectedId: 'eq-2',
    })).toBe('default');
  });

  it('keeps non-expert presets unchanged', () => {
    expect(resolvePresetAfterSelectionChange({
      currentPreset: 'default',
      previousSelectedId: 'eq-1',
      nextSelectedId: null,
    })).toBe('default');
  });

  it('keeps crossSection active for the same selected incident', () => {
    expect(resolvePresetAfterSelectionChange({
      currentPreset: 'crossSection',
      previousSelectedId: 'eq-1',
      nextSelectedId: 'eq-1',
    })).toBe('crossSection');
  });
});

describe('resolvePresetForMobileSnap', () => {
  it('resets crossSection when the sheet returns to peek', () => {
    expect(resolvePresetForMobileSnap({
      currentPreset: 'crossSection',
      snap: 'peek',
    })).toBe('default');
  });

  it('keeps crossSection for half and full sheet states', () => {
    expect(resolvePresetForMobileSnap({
      currentPreset: 'crossSection',
      snap: 'half',
    })).toBe('crossSection');
    expect(resolvePresetForMobileSnap({
      currentPreset: 'crossSection',
      snap: 'full',
    })).toBe('crossSection');
  });
});

describe('canActivateCrossSection', () => {
  it('requires an explicit advanced-tools entry with a valid selected incident', () => {
    expect(canActivateCrossSection({
      selectedEventId: 'eq-1',
      magnitude: 4.6,
      advancedToolsOpen: true,
    })).toBe(true);
  });

  it('blocks activation when no incident is selected, advanced tools are closed, or magnitude is too low', () => {
    expect(canActivateCrossSection({
      selectedEventId: null,
      magnitude: 5.0,
      advancedToolsOpen: true,
    })).toBe(false);
    expect(canActivateCrossSection({
      selectedEventId: 'eq-1',
      magnitude: 5.0,
      advancedToolsOpen: false,
    })).toBe(false);
    expect(canActivateCrossSection({
      selectedEventId: 'eq-1',
      magnitude: 3.9,
      advancedToolsOpen: true,
    })).toBe(false);
  });
});
