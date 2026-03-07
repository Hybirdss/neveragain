import { describe, expect, it } from 'vitest';

import {
  detectLocaleFromEnvironment,
  resolveLocaleFromCountry,
} from '../index';

describe('runtime locale resolution', () => {
  it('maps country codes to the operator locale policy', () => {
    expect(resolveLocaleFromCountry('KR')).toBe('ko');
    expect(resolveLocaleFromCountry('JP')).toBe('ja');
    expect(resolveLocaleFromCountry('US')).toBe('en');
    expect(resolveLocaleFromCountry(null)).toBe('en');
  });

  it('falls back to timezone-based country inference when country is unavailable', () => {
    expect(detectLocaleFromEnvironment({ timeZone: 'Asia/Seoul' })).toBe('ko');
    expect(detectLocaleFromEnvironment({ timeZone: 'Asia/Tokyo' })).toBe('ja');
    expect(detectLocaleFromEnvironment({ timeZone: 'America/Los_Angeles' })).toBe('en');
  });
});
