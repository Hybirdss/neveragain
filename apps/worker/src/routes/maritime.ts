import { Hono } from 'hono';
import type { Env } from '../index.ts';

export const maritimeRoute = new Hono<{ Bindings: Env }>();

const HUB_NAME = 'japan-maritime-hub';
const HUB_URL = 'https://maritime-hub/snapshot';

maritimeRoute.get('/vessels', async (c) => {
  // Serve from R2 feed first (zero DO invocations, CDN-cached)
  const bucket = c.env.FEED_BUCKET;
  if (bucket) {
    try {
      const obj = await bucket.get('feed/maritime.json');
      if (obj) {
        return new Response(obj.body, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
            'X-Source': 'r2',
          },
        });
      }
    } catch {
      // R2 read failed, fall through to DO
    }
  }

  // Fallback: Durable Object
  if (!c.env.MARITIME_HUB) {
    return c.json({ error: 'Maritime hub unavailable' }, 503);
  }

  const hubRequestUrl = new URL(HUB_URL);
  hubRequestUrl.search = new URL(c.req.url).search;
  const stub = c.env.MARITIME_HUB.getByName(HUB_NAME);
  const response = await stub.fetch(hubRequestUrl.toString());

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
});
