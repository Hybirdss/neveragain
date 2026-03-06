import test from 'node:test';
import assert from 'node:assert/strict';

import { runtimeRoute } from '../src/routes/runtime.ts';

test('runtime route returns current governor activation and cadence policy', async () => {
  let forwardedUrl = '';

  const response = await runtimeRoute.request(
    'http://example.com/',
    undefined,
    {
      MARITIME_HUB: {
        getByName(name: string) {
          assert.equal(name, 'japan-maritime-hub');
          return {
            fetch(request: Request | string | URL) {
              forwardedUrl = String(request);
              return Response.json({
                governor: {
                  state: 'incident',
                  activated_at: '2026-03-07T05:00:00.000Z',
                  reason: 'major offshore event activated incident mode',
                  region_scope: { kind: 'regional', region_ids: ['kanto'] },
                },
                policies: {
                  events: { source: 'events', cadenceMode: 'poll', refreshMs: 15_000 },
                  maritime: { source: 'maritime', cadenceMode: 'poll', refreshMs: 10_000 },
                },
                fanout: {
                  mode: 'incident-scoped',
                  push_available: false,
                  viewer_refresh_ms: 10_000,
                },
              });
            },
          };
        },
      },
    } as never,
  );

  assert.equal(response.status, 200);

  const payload = await response.json() as {
    governor: { state: string; reason: string };
    policies: { maritime: { refreshMs: number } };
    fanout: { mode: string; push_available: boolean; viewer_refresh_ms: number };
  };

  assert.equal(payload.governor.state, 'incident');
  assert.match(payload.governor.reason, /incident mode/i);
  assert.equal(payload.policies.maritime.refreshMs, 10_000);
  assert.equal(payload.fanout.mode, 'incident-scoped');
  assert.equal(payload.fanout.push_available, false);
  assert.equal(payload.fanout.viewer_refresh_ms, 10_000);
  assert.match(forwardedUrl, /https:\/\/maritime-hub\/runtime/);
});

test('runtime route returns 503 when the durable object binding is unavailable', async () => {
  const response = await runtimeRoute.request('http://example.com/', undefined, {} as never);
  assert.equal(response.status, 503);

  const payload = await response.json() as { error: string };
  assert.equal(payload.error, 'Maritime hub unavailable');
});
