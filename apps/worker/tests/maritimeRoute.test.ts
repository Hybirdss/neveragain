import test from 'node:test';
import assert from 'node:assert/strict';

import { maritimeRoute } from '../src/routes/maritime.ts';

test('maritime route forwards maritime queries to the durable object hub', async () => {
  let forwardedUrl = '';
  const response = await maritimeRoute.request(
    'http://example.com/vessels?profile=japan-wide&west=138.5&south=33.5&east=141.5&north=36.5&limit=25',
    undefined,
    {
      MARITIME_HUB: {
        getByName(name: string) {
          assert.equal(name, 'japan-maritime-hub');
          return {
            fetch(request: Request | string | URL) {
              forwardedUrl = String(request);
              return Response.json({
                source: 'synthetic',
                profile: { id: 'japan-wide', label: 'Japan Wide' },
                generated_at: 123,
                refreshed_at: 123,
                total_tracked: 356,
                visible_count: 25,
                vessels: [],
                provenance: {
                  cache_status: 'miss',
                  snapshot_age_ms: 0,
                  provider: 'synthetic',
                  fallback_reason: 'connect-timeout',
                  refresh_in_flight: false,
                  diagnostics: {
                    attempted_live: true,
                    upstream_phase: 'connect-timeout',
                    messages_received: 0,
                    transport: 'websocket-constructor',
                    source_mix: ['synthetic'],
                    socket_opened: false,
                    subscription_sent: false,
                    close_code: null,
                    close_reason: null,
                    last_error: 'AISstream websocket connect timeout',
                  },
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
    source: string;
    profile: { id: string };
    total_tracked: number;
    visible_count: number;
    provenance: {
      cache_status: string;
      fallback_reason: string;
      refresh_in_flight: boolean;
      diagnostics: {
        attempted_live: boolean;
        upstream_phase: string;
        messages_received: number;
        transport: string | null;
        source_mix: string[];
        socket_opened: boolean | null;
        subscription_sent: boolean | null;
        close_code: number | null;
        close_reason: string | null;
        last_error: string | null;
      };
    };
  };

  assert.equal(payload.source, 'synthetic');
  assert.equal(payload.profile.id, 'japan-wide');
  assert.equal(payload.total_tracked, 356);
  assert.equal(payload.visible_count, 25);
  assert.equal(payload.provenance.cache_status, 'miss');
  assert.equal(payload.provenance.fallback_reason, 'connect-timeout');
  assert.equal(payload.provenance.refresh_in_flight, false);
  assert.equal(payload.provenance.diagnostics.attempted_live, true);
  assert.equal(payload.provenance.diagnostics.upstream_phase, 'connect-timeout');
  assert.equal(payload.provenance.diagnostics.messages_received, 0);
  assert.equal(payload.provenance.diagnostics.transport, 'websocket-constructor');
  assert.deepEqual(payload.provenance.diagnostics.source_mix, ['synthetic']);
  assert.equal(payload.provenance.diagnostics.socket_opened, false);
  assert.equal(payload.provenance.diagnostics.subscription_sent, false);
  assert.equal(payload.provenance.diagnostics.close_code, null);
  assert.equal(payload.provenance.diagnostics.close_reason, null);
  assert.match(payload.provenance.diagnostics.last_error ?? '', /connect timeout/i);
  assert.match(
    forwardedUrl,
    /https:\/\/maritime-hub\/snapshot\?profile=japan-wide&west=138.5&south=33.5&east=141.5&north=36.5&limit=25/,
  );
});

test('maritime route returns 503 when the durable object binding is unavailable', async () => {
  const response = await maritimeRoute.request('http://example.com/vessels', undefined, {} as never);
  assert.equal(response.status, 503);

  const payload = await response.json() as { error: string };
  assert.equal(payload.error, 'Maritime hub unavailable');
});
