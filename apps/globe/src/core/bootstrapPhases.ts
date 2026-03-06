export const FIRST_TRUTH_SURFACES = [
  'shell',
  'map-engine',
  'viewport-manager',
  'layer-compositor',
  'event-snapshot',
  'check-these-now',
] as const;

export const SECONDARY_SURFACES = [
  'recent-feed',
  'asset-exposure',
  'maritime-exposure',
  'fault-catalog',
  'layer-control',
  'timeline-rail',
  'settings-panel',
  'command-palette',
  'keyboard-help',
  'notification-queue',
] as const;

export type BootstrapSurfaceId =
  | (typeof FIRST_TRUTH_SURFACES)[number]
  | (typeof SECONDARY_SURFACES)[number];

export type BootstrapSurfacePhase = 'first-truth' | 'secondary';

const FIRST_TRUTH_SURFACE_SET = new Set<BootstrapSurfaceId>(FIRST_TRUTH_SURFACES);

export function isFirstTruthSurface(surface: BootstrapSurfaceId): boolean {
  return FIRST_TRUTH_SURFACE_SET.has(surface);
}

export function getBootstrapSurfacePhase(surface: BootstrapSurfaceId): BootstrapSurfacePhase {
  return isFirstTruthSurface(surface) ? 'first-truth' : 'secondary';
}

export function getBootstrapSurfaceMountOrder(): BootstrapSurfaceId[] {
  return [...FIRST_TRUTH_SURFACES, ...SECONDARY_SURFACES];
}
