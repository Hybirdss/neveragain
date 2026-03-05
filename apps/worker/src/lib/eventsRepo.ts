import { earthquakes } from '@namazue/db';
import type { createDb } from './db.ts';
import type { EarthquakeInsert } from './eventsValidation.ts';

export async function upsertEvent(
  db: ReturnType<typeof createDb>,
  event: EarthquakeInsert,
): Promise<void> {
  const { id: _id, ...updateSet } = event;
  await db.insert(earthquakes).values(event).onConflictDoUpdate({
    target: earthquakes.id,
    set: updateSet,
  });
}

export async function upsertEvents(
  db: ReturnType<typeof createDb>,
  events: EarthquakeInsert[],
  concurrency = 20,
): Promise<void> {
  if (events.length === 0) return;
  for (let i = 0; i < events.length; i += concurrency) {
    const chunk = events.slice(i, i + concurrency);
    await Promise.all(chunk.map((event) => upsertEvent(db, event)));
  }
}
