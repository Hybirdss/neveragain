import { describe, expect, it } from 'vitest';

import { inferFaultType } from '@namazue/db/geo';

describe('inferFaultType', () => {
  it('does not classify west-of-trench Miyako events as interface by default', () => {
    const faultType = inferFaultType(10, 25.234, 125.029, '55 km NNW of Hirara, Japan');

    expect(faultType).toBe('crustal');
  });

  it('keeps Japan Trench east-coast offshore events as interface', () => {
    const faultType = inferFaultType(18, 39.846, 143.339, '121 km E of Miyako, Japan');

    expect(faultType).toBe('interface');
  });

  it('keeps Ryukyu trench seaward events as interface', () => {
    const faultType = inferFaultType(10, 25.872, 128.5362, '83 km SE of Katsuren-haebaru, Japan');

    expect(faultType).toBe('interface');
  });
});
