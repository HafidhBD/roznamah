import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { calendarEvents, calendars, events } from '@/db/schema';
import { HEX_COLOR } from '@/lib/design';
import { draftFromRequest, inSpan, langFromRequest, listEventViews, withDraftCookie } from '@/lib/draft';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s));

/** Occasion changes are calendar edits (a download request after one must not reuse an older file). */
const touch = (calendarId: string) =>
  db.update(calendars).set({ updatedAt: new Date() }).where(eq(calendars.id, calendarId));

const bodySchema = z.union([
  z.object({ eventIds: z.array(z.uuid()).min(1).max(100) }).strict(),
  z
    .object({
      custom: z
        .object({
          titleAr: z.string().trim().min(1).max(120),
          titleEn: z.string().trim().max(120).optional(),
          date: isoDate,
          color: z.string().regex(HEX_COLOR).optional(),
        })
        .strict(),
    })
    .strict(),
]);

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }
  const draft = (await draftFromRequest(req, true))!;
  const body = parsed.data;

  if ('eventIds' in body) {
    const ids = [...new Set(body.eventIds)];
    const found = await db
      .select({ id: events.id })
      .from(events)
      .where(and(inArray(events.id, ids), eq(events.active, true)));
    if (found.length !== ids.length) {
      return NextResponse.json({ error: 'unknown_event' }, { status: 400 });
    }
    await db
      .insert(calendarEvents)
      .values(ids.map((eventId) => ({ calendarId: draft.calendar.id, eventId })))
      .onConflictDoNothing();
  } else {
    const c = body.custom;
    if (!inSpan(draft.calendar, c.date)) {
      return NextResponse.json({ error: 'date_outside_span' }, { status: 400 });
    }
    await db.insert(calendarEvents).values({
      calendarId: draft.calendar.id,
      customTitleAr: c.titleAr,
      customTitleEn: c.titleEn || null,
      customDate: c.date,
      customColor: c.color ?? null,
    });
  }
  await touch(draft.calendar.id);
  const views = await listEventViews(draft.calendar, langFromRequest(req));
  return withDraftCookie(NextResponse.json({ events: views }), draft);
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id || !z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const draft = await draftFromRequest(req, false);
  if (!draft) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const deleted = await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.calendarId, draft.calendar.id)))
    .returning({ id: calendarEvents.id });
  if (!deleted.length) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await touch(draft.calendar.id);
  return NextResponse.json({ ok: true });
}
