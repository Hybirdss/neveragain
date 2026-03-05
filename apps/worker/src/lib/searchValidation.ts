import {
  parseFiniteNumber,
  validateRange,
  validateRangePair,
} from './earthquakeValidation.ts';

export interface ParsedRange {
  min: number | null;
  max: number | null;
  error: string | null;
}

export function parseValidatedRange(
  minRaw: unknown,
  maxRaw: unknown,
  minName: string,
  maxName: string,
  allowedMin: number,
  allowedMax: number,
): ParsedRange {
  const min = parseFiniteNumber(minRaw);
  const max = parseFiniteNumber(maxRaw);

  const minErr = min === null ? null : validateRange(minName, min, allowedMin, allowedMax);
  if (minErr) {
    return { min, max, error: minErr };
  }

  const maxErr = max === null ? null : validateRange(maxName, max, allowedMin, allowedMax);
  if (maxErr) {
    return { min, max, error: maxErr };
  }

  const pairErr = validateRangePair(minName, min, maxName, max);
  if (pairErr) {
    return { min, max, error: pairErr };
  }

  return { min, max, error: null };
}
