import { Hono } from 'hono';
import type { Env } from '../index.ts';

export const maritimeRoute = new Hono<{ Bindings: Env }>();

const HUB_NAME = 'japan-maritime-hub';
const HUB_URL = 'https://maritime-hub/snapshot';

maritimeRoute.get('/vessels', async (c) => {
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
