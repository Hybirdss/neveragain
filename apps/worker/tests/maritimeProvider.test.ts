import test from 'node:test';
import assert from 'node:assert/strict';

import { createMaritimeSnapshotProvider } from '../src/maritime/provider.ts';

test('maritime provider falls back to synthetic snapshots when no AIS key is configured', async () => {
  const provider = createMaritimeSnapshotProvider({});
  const snapshot = await provider.loadProfileSnapshot('japan-wide', 1_000);

  assert.equal(snapshot.source, 'synthetic');
  assert.equal(snapshot.profile.id, 'japan-wide');
  assert.ok(snapshot.totalTracked > 122);
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
  assert.equal(snapshot.totalTracked, 1);
  assert.equal(snapshot.vessels[0]?.name, 'TOKYO TEST');
  assert.equal(snapshot.vessels[0]?.lat, 35.2);
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
  assert.ok(snapshot.totalTracked > 122);
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
  assert.ok(snapshot.totalTracked > 122);
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
}
