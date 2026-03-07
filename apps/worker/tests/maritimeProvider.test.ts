import test from 'node:test';
import assert from 'node:assert/strict';

import { createMaritimeSnapshotProvider } from '../src/maritime/provider.ts';

test('maritime provider falls back to synthetic snapshots when no AIS key is configured', async () => {
  const provider = createMaritimeSnapshotProvider({});
  const snapshot = await provider.loadProfileSnapshot('japan-wide', 1_000);

  assert.equal(snapshot.source, 'synthetic');
  assert.equal(snapshot.fallbackReason, 'not-configured');
  assert.equal(snapshot.diagnostics.attemptedLive, false);
  assert.equal(snapshot.diagnostics.upstreamPhase, 'not-configured');
  assert.equal(snapshot.diagnostics.transport, 'websocket-constructor');
  assert.deepEqual(snapshot.diagnostics.sourceMix, []);
  assert.equal(snapshot.profile.id, 'japan-wide');
  assert.equal(snapshot.totalTracked, 0);
  assert.deepEqual(snapshot.vessels, []);
});

test('maritime provider can build a live snapshot from AISHub polling when configured', async () => {
  const provider = createMaritimeSnapshotProvider(
    {
      AISHUB_USERNAME: 'demo-user',
      AISHUB_MAX_AGE_MINUTES: 15,
    } as never,
    {
      fetchImpl: async (url) => {
        assert.match(String(url), /data\.aishub\.net\/ws\.php/);
        assert.match(String(url), /username=demo-user/);
        return new Response(JSON.stringify([
          { RECORDS: 1 },
          [{
            MMSI: 431000444,
            NAME: 'AISHUB TEST',
            LATITUDE: 35.4,
            LONGITUDE: 139.8,
            COG: 88,
            SOG: 11,
            TIME: '2026-03-07 00:00:04 GMT',
            NAVSTAT: 0,
            TYPE: 70,
          }],
        ]));
      },
      webSocketFactory: () => {
        throw new Error('websocket path should not run');
      },
    },
  );

  const snapshot = await provider.loadProfileSnapshot('japan-wide', 4_000);
  assert.equal(snapshot.source, 'live');
  assert.equal(snapshot.totalTracked, 1);
  assert.equal(snapshot.diagnostics.transport, 'http-poll');
  assert.deepEqual(snapshot.diagnostics.sourceMix, ['aishub']);
  assert.equal(snapshot.vessels[0]?.name, 'AISHUB TEST');
  assert.equal(snapshot.vessels[0]?.type, 'cargo');
});

test('maritime provider can build a live snapshot from AISstream websocket messages', async () => {
  const sockets: FakeWebSocket[] = [];
  const provider = createMaritimeSnapshotProvider(
    {
      AISSTREAM_API_KEY: 'test-key',
      AISSTREAM_COLLECTION_WINDOW_MS: 10,
    },
    {
      webSocketFactory: (url) => {
        const socket = new FakeWebSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    },
  );

  const snapshotPromise = provider.loadProfileSnapshot('japan-wide', 5_000);
  await Promise.resolve();

  const socket = sockets[0];
  assert.ok(socket);
  assert.equal(socket.url, 'wss://stream.aisstream.io/v0/stream');
  socket.emitOpen();
  assert.match(socket.sentMessages[0] ?? '', /"APIKey":"test-key"/);
  socket.emitMessage(JSON.stringify({
    MessageType: 'PositionReport',
    MetaData: {
      MMSI: 431000111,
      ShipName: 'TOKYO TEST',
      time_utc: '2026-03-07T00:00:05Z',
    },
    Message: {
      PositionReport: {
        Latitude: 35.2,
        Longitude: 139.9,
        Cog: 90,
        Sog: 12,
        NavigationalStatus: 0,
      },
    },
  }));

  const snapshot = await snapshotPromise;
  assert.equal(snapshot.source, 'live');
  assert.equal(snapshot.fallbackReason, undefined);
  assert.equal(snapshot.diagnostics.attemptedLive, true);
  assert.equal(snapshot.diagnostics.upstreamPhase, 'completed');
  assert.equal(snapshot.diagnostics.messagesReceived, 1);
  assert.equal(snapshot.totalTracked, 1);
  assert.equal(snapshot.vessels[0]?.name, 'TOKYO TEST');
  assert.equal(snapshot.vessels[0]?.lat, 35.2);
});

test('maritime provider merges AISHub and AISstream vessels by MMSI priority', async () => {
  const sockets: FakeWebSocket[] = [];
  const provider = createMaritimeSnapshotProvider(
    {
      AISSTREAM_API_KEY: 'test-key',
      AISSTREAM_COLLECTION_WINDOW_MS: 200,
      AISHUB_USERNAME: 'demo-user',
      AISHUB_MAX_AGE_MINUTES: 15,
    } as never,
    {
      fetchImpl: async (url) => {
        if (String(url).startsWith('https://data.aishub.net/')) {
          return new Response(JSON.stringify([
            { RECORDS: 1 },
            [{
              MMSI: 431000111,
              NAME: 'AISHUB DUPLICATE',
              LATITUDE: 35.21,
              LONGITUDE: 139.91,
              COG: 80,
              SOG: 10,
              TIME: '2026-03-07 00:00:04 GMT',
              NAVSTAT: 0,
              TYPE: 70,
            }],
          ]));
        }
        const socket = new FakeWebSocket('wss://stream.aisstream.io/v0/stream');
        sockets.push(socket);
        return {
          webSocket: socket as unknown as WebSocket,
        } as Response;
      },
      webSocketFactory: () => {
        throw new Error('constructor path should not run');
      },
    },
  );

  const snapshotPromise = provider.loadProfileSnapshot('japan-wide', 5_000);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const socket = sockets[0];
  assert.ok(socket);
  // fetch-upgrade socket is already open after accept() — no emitOpen() needed
  socket.emitMessage(JSON.stringify({
    MessageType: 'PositionReport',
    MetaData: {
      MMSI: 431000111,
      ShipName: 'AISSTREAM WINNER',
      time_utc: '2026-03-07T00:00:05Z',
    },
    Message: {
      PositionReport: {
        Latitude: 35.2,
        Longitude: 139.9,
        Cog: 90,
        Sog: 12,
        NavigationalStatus: 0,
      },
    },
  }));

  const snapshot = await snapshotPromise;
  assert.equal(snapshot.source, 'live');
  assert.equal(snapshot.totalTracked, 1);
  assert.equal(snapshot.vessels[0]?.name, 'AISSTREAM WINNER');
  assert.deepEqual(snapshot.diagnostics.sourceMix?.sort(), ['aishub', 'aisstream']);
});

test('maritime provider prefers fetch-upgrade websocket clients when available', async () => {
  const socket = new FakeWebSocket('wss://stream.aisstream.io/v0/stream');
  let fetchCalls = 0;
  const provider = createMaritimeSnapshotProvider(
    {
      AISSTREAM_API_KEY: 'test-key',
      AISSTREAM_COLLECTION_WINDOW_MS: 200,
    },
    {
      fetchImpl: async (url, init) => {
        fetchCalls += 1;
        assert.equal(String(url), 'https://stream.aisstream.io/v0/stream');
        assert.equal(init?.headers instanceof Headers ? init.headers.get('Upgrade') : null, 'websocket');
        return {
          webSocket: socket as unknown as WebSocket,
        } as Response;
      },
      webSocketFactory: () => {
        throw new Error('constructor path should not run');
      },
    },
  );

  const snapshotPromise = provider.loadProfileSnapshot('japan-wide', 6_000);
  await new Promise((resolve) => setTimeout(resolve, 10));
  // fetch-upgrade socket is already open after accept() — no emitOpen() needed
  socket.emitMessage(JSON.stringify({
    MessageType: 'PositionReport',
    MetaData: {
      MMSI: 431000222,
      ShipName: 'FETCH TEST',
      time_utc: '2026-03-07T00:00:06Z',
    },
    Message: {
      PositionReport: {
        Latitude: 34.7,
        Longitude: 135.3,
        Cog: 45,
        Sog: 8,
        NavigationalStatus: 0,
      },
    },
  }));

  const snapshot = await snapshotPromise;
  assert.equal(fetchCalls, 1);
  assert.equal(snapshot.source, 'live');
  assert.equal(snapshot.diagnostics.transport, 'fetch-upgrade');
  assert.equal(snapshot.diagnostics.socketOpened, true);
  assert.equal(snapshot.diagnostics.subscriptionSent, true);
  assert.equal(snapshot.vessels[0]?.name, 'FETCH TEST');
});

test('maritime provider times out fetch-upgrade attempts and falls back to constructor transport', async () => {
  const sockets: FakeWebSocket[] = [];
  const provider = createMaritimeSnapshotProvider(
    {
      AISSTREAM_API_KEY: 'test-key',
      AISSTREAM_COLLECTION_WINDOW_MS: 10,
    },
    {
      fetchImpl: () => new Promise(() => {}),
      webSocketFactory: (url) => {
        const socket = new FakeWebSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      connectTimeoutMs: 20,
    },
  );

  const snapshotPromise = provider.loadProfileSnapshot('japan-wide', 7_500);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const socket = sockets[0];
  assert.ok(socket);
  socket.emitOpen();
  socket.emitMessage(JSON.stringify({
    MessageType: 'PositionReport',
    MetaData: {
      MMSI: 431000333,
      ShipName: 'FALLBACK TEST',
      time_utc: '2026-03-07T00:00:08Z',
    },
    Message: {
      PositionReport: {
        Latitude: 33.9,
        Longitude: 130.9,
        Cog: 10,
        Sog: 5,
        NavigationalStatus: 0,
      },
    },
  }));

  const snapshot = await snapshotPromise;
  assert.equal(snapshot.source, 'live');
  assert.equal(snapshot.diagnostics.transport, 'websocket-constructor');
  assert.equal(snapshot.diagnostics.socketOpened, true);
  assert.equal(snapshot.vessels[0]?.name, 'FALLBACK TEST');
});

test('maritime provider falls back to synthetic snapshots when AISstream fails', async () => {
  const provider = createMaritimeSnapshotProvider(
    {
      AISSTREAM_API_KEY: 'test-key',
      AISSTREAM_COLLECTION_WINDOW_MS: 10,
    },
    {
      webSocketFactory: () => {
        throw new Error('socket unavailable');
      },
    },
  );

  const snapshot = await provider.loadProfileSnapshot('japan-wide', 7_000);
  assert.equal(snapshot.source, 'synthetic');
  assert.equal(snapshot.fallbackReason, 'upstream-error');
  assert.equal(snapshot.diagnostics.attemptedLive, true);
  assert.equal(snapshot.diagnostics.upstreamPhase, 'upstream-error');
  assert.equal(snapshot.diagnostics.transport, 'websocket-constructor');
  assert.deepEqual(snapshot.diagnostics.sourceMix, []);
  assert.match(snapshot.diagnostics.lastError ?? '', /socket unavailable/);
  assert.equal(snapshot.totalTracked, 0);
  assert.deepEqual(snapshot.vessels, []);
});

test('maritime provider falls back when AISstream never opens', async () => {
  const provider = createMaritimeSnapshotProvider(
    {
      AISSTREAM_API_KEY: 'test-key',
      AISSTREAM_COLLECTION_WINDOW_MS: 10,
    },
    {
      webSocketFactory: (url) => new FakeWebSocket(url) as unknown as WebSocket,
      connectTimeoutMs: 20,
    },
  );

  const snapshot = await provider.loadProfileSnapshot('japan-wide', 9_000);
  assert.equal(snapshot.source, 'synthetic');
  assert.equal(snapshot.fallbackReason, 'connect-timeout');
  assert.equal(snapshot.diagnostics.attemptedLive, true);
  assert.equal(snapshot.diagnostics.upstreamPhase, 'connect-timeout');
  assert.equal(snapshot.diagnostics.transport, 'websocket-constructor');
  assert.equal(snapshot.diagnostics.messagesReceived, 0);
  assert.deepEqual(snapshot.diagnostics.sourceMix, []);
  assert.equal(snapshot.totalTracked, 0);
  assert.deepEqual(snapshot.vessels, []);
});

test('maritime provider marks sockets that close before open as upstream handshake failures', async () => {
  const sockets: FakeWebSocket[] = [];
  const provider = createMaritimeSnapshotProvider(
    {
      AISSTREAM_API_KEY: 'test-key',
      AISSTREAM_COLLECTION_WINDOW_MS: 10,
    },
    {
      webSocketFactory: (url) => {
        const socket = new FakeWebSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      connectTimeoutMs: 50,
    },
  );

  const snapshotPromise = provider.loadProfileSnapshot('japan-wide', 11_000);
  await Promise.resolve();
  const socket = sockets[0];
  assert.ok(socket);
  socket.emitClose({ code: 1006, reason: 'upstream closed' });

  const snapshot = await snapshotPromise;
  assert.equal(snapshot.source, 'synthetic');
  assert.equal(snapshot.fallbackReason, 'upstream-error');
  assert.equal(snapshot.diagnostics.attemptedLive, true);
  assert.equal(snapshot.diagnostics.upstreamPhase, 'closed-before-open');
  assert.equal(snapshot.diagnostics.transport, 'websocket-constructor');
  assert.deepEqual(snapshot.diagnostics.sourceMix, []);
  assert.equal(snapshot.diagnostics.socketOpened, false);
  assert.equal(snapshot.diagnostics.subscriptionSent, false);
  assert.equal(snapshot.diagnostics.closeCode, 1006);
  assert.equal(snapshot.diagnostics.closeReason, 'upstream closed');
  assert.equal(snapshot.totalTracked, 0);
  assert.deepEqual(snapshot.vessels, []);
});

class FakeWebSocket {
  readonly sentMessages: string[] = [];
  private readonly listeners = new Map<string, Array<(event?: unknown) => void>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, handler: (event?: unknown) => void): void {
    const current = this.listeners.get(type) ?? [];
    current.push(handler);
    this.listeners.set(type, current);
  }

  send(message: string): void {
    this.sentMessages.push(message);
  }

  accept(): void {}

  close(): void {}

  emitOpen(): void {
    for (const handler of this.listeners.get('open') ?? []) {
      handler();
    }
  }

  emitMessage(data: string): void {
    for (const handler of this.listeners.get('message') ?? []) {
      handler({ data });
    }
  }

  emitClose(event: { code?: number; reason?: string } = {}): void {
    for (const handler of this.listeners.get('close') ?? []) {
      handler(event);
    }
  }
}
