import { canonicalizeAnalysisForStorage as canonicalizeStoredAnalysis } from './analysisNormalization.ts';

interface AnalysisEventInput {
  magnitude: number;
  depth_km: number;
  lat: number;
  lng: number;
  place?: string | null;
  place_ja?: string | null;
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

export function prepareAnalysisForEvent(
  analysis: unknown,
  event: AnalysisEventInput,
): Record<string, any> | null {
  const record = asRecord(analysis);
  if (!record) return null;
  if (!asRecord(record.facts)) {
    return JSON.parse(JSON.stringify(record)) as Record<string, any>;
  }
  return canonicalizeStoredAnalysis(record, event);
}

export function canonicalizeAnalysisForEvent(
  analysis: unknown,
  event: AnalysisEventInput,
): Record<string, any> | null {
  return prepareAnalysisForEvent(analysis, event);
}
