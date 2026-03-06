import { describe, expect, it, vi } from 'vitest';

import { runEntryRoute } from '../../entry';

describe('entry routing', () => {
  it('keeps the service route off the legacy bootstrap path', async () => {
    const service = vi.fn(async () => {});
    const legacy = vi.fn(async () => {});
    const lab = vi.fn(async () => {});

    await runEntryRoute('service', {
      appRoot: {} as HTMLElement,
      loaders: {
        service,
        legacy,
        lab,
      },
    });

    expect(service).toHaveBeenCalledTimes(1);
    expect(legacy).not.toHaveBeenCalled();
    expect(lab).not.toHaveBeenCalled();
  });

  it('still resolves the legacy route explicitly', async () => {
    const service = vi.fn(async () => {});
    const legacy = vi.fn(async () => {});
    const lab = vi.fn(async () => {});

    await runEntryRoute('legacy', {
      appRoot: {} as HTMLElement,
      loaders: {
        service,
        legacy,
        lab,
      },
    });

    expect(legacy).toHaveBeenCalledTimes(1);
    expect(service).not.toHaveBeenCalled();
    expect(lab).not.toHaveBeenCalled();
  });

  it('still resolves the lab route explicitly', async () => {
    const service = vi.fn(async () => {});
    const legacy = vi.fn(async () => {});
    const lab = vi.fn(async () => {});

    await runEntryRoute('lab', {
      appRoot: {} as HTMLElement,
      loaders: {
        service,
        legacy,
        lab,
      },
    });

    expect(lab).toHaveBeenCalledTimes(1);
    expect(service).not.toHaveBeenCalled();
    expect(legacy).not.toHaveBeenCalled();
  });
});
