import { buildSyntheticMaritimeSnapshot, type AisCoverageProfileId } from '@namazue/db';
import type { MaritimeSnapshotProvider } from './service.ts';

export function createMaritimeSnapshotProvider(): MaritimeSnapshotProvider {
  return {
    provider: 'synthetic',
    async loadProfileSnapshot(profileId: AisCoverageProfileId, now: number) {
      return buildSyntheticMaritimeSnapshot({ profileId, now });
    },
  };
}
