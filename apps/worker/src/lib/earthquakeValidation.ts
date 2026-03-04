export const EARTHQUAKE_LIMITS = {
  lat: { min: -90, max: 90 },
  lng: { min: -180, max: 180 },
  depthKm: { min: 0, max: 700 },
  magnitude: { min: 0, max: 10 },
  radiusKm: { min: 1, max: 2000 },
  strike: { min: 0, max: 360 },
  dip: { min: 0, max: 90 },
  rake: { min: -180, max: 180 },
  minYear: 1900,
  maxFutureSkewMs: 5 * 60 * 1000,
} as const;

export function parseFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseTimestamp(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ts = value < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(ts);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!Number.isFinite(num)) return null;
      const ts = num < 1_000_000_000_000 ? num * 1000 : num;
      const fromNum = new Date(ts);
      return Number.isNaN(fromNum.getTime()) ? null : fromNum;
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function isWithinRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function validateRange(
  fieldName: string,
  value: number,
  min: number,
  max: number,
): string | null {
  if (!isWithinRange(value, min, max)) {
    return `${fieldName} must be between ${min} and ${max}`;
  }
  return null;
}

export function validateRangePair(
  minName: string,
  minValue: number | null,
  maxName: string,
  maxValue: number | null,
): string | null {
  if (minValue !== null && maxValue !== null && minValue > maxValue) {
    return `${minName} must be less than or equal to ${maxName}`;
  }
  return null;
}

export function validateEventTime(time: Date, nowMs = Date.now()): string | null {
  if (time.getTime() > nowMs + EARTHQUAKE_LIMITS.maxFutureSkewMs) {
    return 'event.time is too far in the future';
  }
  if (time.getUTCFullYear() < EARTHQUAKE_LIMITS.minYear) {
    return `event.time must be in or after ${EARTHQUAKE_LIMITS.minYear}`;
  }
  return null;
}

export function validateMomentTensor(
  strike: number | null,
  dip: number | null,
  rake: number | null,
  label: string,
): string | null {
  const hasAny = strike !== null || dip !== null || rake !== null;
  const hasAll = strike !== null && dip !== null && rake !== null;
  if (hasAny && !hasAll) {
    return `${label} requires strike, dip, and rake together`;
  }
  if (!hasAll) return null;

  const strikeError = validateRange(`${label}.strike`, strike, EARTHQUAKE_LIMITS.strike.min, EARTHQUAKE_LIMITS.strike.max);
  if (strikeError) return strikeError;

  const dipError = validateRange(`${label}.dip`, dip, EARTHQUAKE_LIMITS.dip.min, EARTHQUAKE_LIMITS.dip.max);
  if (dipError) return dipError;

  const rakeError = validateRange(`${label}.rake`, rake, EARTHQUAKE_LIMITS.rake.min, EARTHQUAKE_LIMITS.rake.max);
  if (rakeError) return rakeError;

  return null;
}
