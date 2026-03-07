/**
 * Feed Publisher — Writes JSON snapshots to R2 for CDN-served reads.
 *
 * Architecture:
 *   Cron worker writes → R2 bucket → CF CDN (Cache-Control) → clients
 *   Zero Worker invocations for reads. R2 public access + CDN handles it.
 *
 * Files:
 *   feed/events.json    — M2.5+ Japan earthquakes (7 days, max 500)
 *   feed/maritime.json  — AIS vessel snapshot
 *   feed/rail.json      — Shinkansen operation status
 *   feed/governor.json  — Governor policy envelope
 */

const FEED_PREFIX = 'feed/';

// Cache-Control for R2 public access.
// 60s max-age: clients get CDN-cached response, cron refreshes every minute.
const CACHE_CONTROL = 'public, max-age=60, s-maxage=60';

interface PublishOptions {
  bucket: R2Bucket;
  key: string;
  data: unknown;
}

async function publishJson({ bucket, key, data }: PublishOptions): Promise<void> {
  const body = JSON.stringify(data);
  await bucket.put(`${FEED_PREFIX}${key}`, body, {
    httpMetadata: {
      contentType: 'application/json',
      cacheControl: CACHE_CONTROL,
    },
  });
}

export async function publishEventsFeed(
  bucket: R2Bucket,
  events: unknown[],
  governor: unknown,
): Promise<void> {
  await publishJson({
    bucket,
    key: 'events.json',
    data: {
      events,
      count: events.length,
      governor,
      generated_at: Date.now(),
    },
  });
}

export async function publishMaritimeFeed(
  bucket: R2Bucket,
  data: unknown,
): Promise<void> {
  await publishJson({
    bucket,
    key: 'maritime.json',
    data,
  });
}

export async function publishRailFeed(
  bucket: R2Bucket,
  data: unknown,
): Promise<void> {
  await publishJson({
    bucket,
    key: 'rail.json',
    data,
  });
}

export async function publishGovernorFeed(
  bucket: R2Bucket,
  governor: unknown,
): Promise<void> {
  await publishJson({
    bucket,
    key: 'governor.json',
    data: governor,
  });
}
