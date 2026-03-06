export const CANONICAL_EVENT_SOURCES = ['server', 'usgs', 'jma', 'historical', 'scenario'] as const;
export type CanonicalEventSource = (typeof CANONICAL_EVENT_SOURCES)[number];

export const CANONICAL_EVENT_CONFIDENCE = ['high', 'medium', 'low'] as const;
export type CanonicalEventConfidence = (typeof CANONICAL_EVENT_CONFIDENCE)[number];

export const REVISION_DIVERGENCE_SEVERITIES = ['none', 'minor', 'material'] as const;
export type RevisionDivergenceSeverity = (typeof REVISION_DIVERGENCE_SEVERITIES)[number];
