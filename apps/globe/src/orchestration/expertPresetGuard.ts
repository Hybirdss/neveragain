import type { ViewPreset } from '../types';

export function resolvePresetAfterSelectionChange(args: {
  currentPreset: ViewPreset;
  previousSelectedId: string | null;
  nextSelectedId: string | null;
}): ViewPreset {
  if (args.currentPreset !== 'crossSection') return args.currentPreset;
  if (!args.nextSelectedId) return 'default';
  if (args.previousSelectedId !== args.nextSelectedId) return 'default';
  return args.currentPreset;
}

export function resolvePresetForMobileSnap(args: {
  currentPreset: ViewPreset;
  snap: 'peek' | 'half' | 'full';
}): ViewPreset {
  if (args.currentPreset === 'crossSection' && args.snap === 'peek') {
    return 'default';
  }
  return args.currentPreset;
}

export function canActivateCrossSection(args: {
  selectedEventId: string | null;
  magnitude: number | null;
  advancedToolsOpen: boolean;
}): boolean {
  return Boolean(
    args.selectedEventId
    && args.advancedToolsOpen
    && args.magnitude !== null
    && args.magnitude >= 4.0,
  );
}
