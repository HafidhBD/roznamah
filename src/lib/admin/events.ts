import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { eventTags, events } from '@/db/schema';
import type { EventInput } from './event-schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

function split(input: EventInput) {
  const { tags, ...fields } = input;
  return { tags, fields };
}

export async function createEvent(input: EventInput): Promise<string> {
  const { tags, fields } = split(input);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(events).values(fields).returning({ id: events.id });
    if (tags.length) await tx.insert(eventTags).values(tags.map((t) => ({ eventId: row.id, ...t })));
    return row.id;
  });
}

/** Returns false when the event does not exist. */
export async function updateEvent(id: string, input: EventInput): Promise<boolean> {
  const { tags, fields } = split(input);
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(events)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning({ id: events.id });
    if (!updated.length) return false;
    await tx.delete(eventTags).where(eq(eventTags.eventId, id));
    if (tags.length) await tx.insert(eventTags).values(tags.map((t) => ({ eventId: id, ...t })));
    return true;
  });
}

export function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown) => (x as { code?: string } | undefined)?.code;
  return code(e) === '23505' || code((e as { cause?: unknown }).cause) === '23505';
}

export function isForeignKeyViolation(e: unknown): boolean {
  const code = (x: unknown) => (x as { code?: string } | undefined)?.code;
  return code(e) === '23503' || code((e as { cause?: unknown }).cause) === '23503';
}
