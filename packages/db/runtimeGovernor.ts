export const GOVERNOR_STATES = ['calm', 'watch', 'incident', 'recovery'] as const;

export const SOURCE_CLASSES = ['event-truth', 'fast-situational', 'slow-infrastructure'] as const;

export type GovernorState = (typeof GOVERNOR_STATES)[number];

export type SourceClass = (typeof SOURCE_CLASSES)[number];

export type GovernorViewportBounds = readonly [west: number, south: number, east: number, north: number];

export type GovernorRegionScope =
  | { kind: 'national' }
  | { kind: 'regional'; regionIds: [string, ...string[]] }
  | {
      kind: 'viewport';
      regionIds: [string, ...string[]];
      bounds: GovernorViewportBounds;
    };

export interface GovernorActivation {
  state: GovernorState;
  sourceClasses: SourceClass[];
  regionScope: GovernorRegionScope;
  activatedAt: string;
  reason: string;
}

export interface GovernorPolicyEnvelope {
  states: readonly GovernorState[];
  sourceClasses: readonly SourceClass[];
  activation: GovernorActivation;
}
