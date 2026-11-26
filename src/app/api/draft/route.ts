import { eq, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { calendars } from '@/db/schema';
import { defaultDesign, designPatchSchema, designSchema } from '@/lib/design';
import {
  draftFromRequest,
  langFromRequest,
  listEventViews,
  selectionsSchema,
  startMonthSchema,
  withDraftCookie,
} from '@/lib/draft';

const patchSchema = z
  .object({
    startMonth: startMonthSchema,
    selections: selectionsSchema,
    design: designPatchSchema,
  })
  .partial()
  .strict();

async function payload(req: Request, draft: NonNullable<Awaited<ReturnType<typeof draftFromRequest>>>) {
  const { calendar } = draft;
  const events = await listEventViews(calendar, langFromRequest(req));
  return {
    calendar: { startMonth: calendar.startMonth, selections: calendar.selections, design: calendar.design },
    events,
  };
}

export async function GET(req: Request) {
  const draft = (await draftFromRequest(req, true))!;
  return withDraftCookie(NextResponse.json(await payload(req, draft)), draft);
}

export async function PATCH(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }
  const draft = (await draftFromRequest(req, true))!;
  const { startMonth, selections, design } = parsed.data;
  const set: PgUpdateSetSource<typeof calendars> = { updatedAt: new Date() };
  if (startMonth) set.startMonth = startMonth;
  if (selections) set.selections = selections;
  if (design) {
    const merged = designSchema.safeParse({ ...defaultDesign, ...draft.calendar.design, ...design });
    if (!merged.success) {
      return NextResponse.json({ error: 'invalid_body', issues: merged.error.issues }, { status: 400 });
    }
    // Merge in SQL so a concurrent write to other design fields (e.g. the logo upload) is kept.
    set.design = sql`${JSON.stringify(defaultDesign)}::jsonb || ${calendars.design} || ${JSON.stringify(design)}::jsonb`;
  }
  const [row] = await db.update(calendars).set(set).where(eq(calendars.id, draft.calendar.id)).returning();
  return withDraftCookie(NextResponse.json(await payload(req, { ...draft, calendar: row })), draft);
}
