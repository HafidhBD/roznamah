import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { eventOccurrences, events } from '@/db/schema';
import { adminRoute } from '@/lib/auth';
import { occurrenceInputSchema } from '@/lib/admin/event-schema';
import { isUuid } from '@/lib/admin/events';

type Ctx = { params: Promise<{ id: string }> };

async function eventExists(id: string) {
  if (!isUuid(id)) return false;
  const [row] = await db.select({ id: events.id }).from(events).where(eq(events.id, id));
  return !!row;
}

/** Adds or overrides the date of one year. */
export const PUT = adminRoute(async (req, { params }: Ctx) => {
  const { id } = await params;
  if (!(await eventExists(id))) return Response.json({ error: 'not_found' }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = occurrenceInputSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  const { year, startDate, status, sourceUrl } = parsed.data;
  await db
    .insert(eventOccurrences)
    .values({ eventId: id, year, startDate, status, sourceUrl })
    .onConflictDoUpdate({
      target: [eventOccurrences.eventId, eventOccurrences.year],
      set: { startDate, status, sourceUrl, updatedAt: new Date() },
    });
  return Response.json({ ok: true });
});

/** Removes the override of one year (`?year=2027`). */
export const DELETE = adminRoute(async (req, { params }: Ctx) => {
  const { id } = await params;
  const year = Number(new URL(req.url).searchParams.get('year'));
  if (!Number.isInteger(year)) return Response.json({ error: 'invalid' }, { status: 400 });
  if (!isUuid(id)) return Response.json({ error: 'not_found' }, { status: 404 });
  await db.delete(eventOccurrences).where(and(eq(eventOccurrences.eventId, id), eq(eventOccurrences.year, year)));
  return Response.json({ ok: true });
});
