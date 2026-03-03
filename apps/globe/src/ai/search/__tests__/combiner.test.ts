import { describe, expect, it } from 'vitest';
import { buildSearchFilter } from '../combiner';

describe('buildSearchFilter', () => {
  it('keeps parsed=true when magnitude lower bound is zero', () => {
    const filter = buildSearchFilter('M0+');

    expect(filter.parsed).toBe(true);
    expect(filter.mag_min).toBe(0);
    expect(filter.raw_query).toBe('M0+');
  });
});
