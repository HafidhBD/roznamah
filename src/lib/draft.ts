import { randomBytes } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  calendarEvents,
  calendars,
  eventOccurrences,
  events,
  type CalendarRow,
} from '@/db/schema';
import { defaultDesign, designSchema } from '@/lib/design';
import { resolveOccurrences, spanEnd, type Occurrence } from '@/lib/dates/occurrences';
import type { Selections } from '@/lib/recommend';

export const DRAFT_COOKIE = 'rz_draft';
export const LANG_COOKIE = 'rz_lang';
export const SPAN_MONTHS = 12;

export const draftCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 90,
  secure: process.env.NODE_ENV === 'production',
});

export type ResolvedDraft = { calendar: CalendarRow; token: string; created: boolean };

const defaultSelections = (): Selections => ({ sector: null, fields: [], audiences: [], uses: [] });

/** January 1 of next year (UTC). */
function defaultStartMonth(now = new Date()): string {
  return `${now.getUTCFullYear() + 1}-01-01`;
}

/** Design of a brand-new draft: the defaults, in the visitor's UI language ('en' only when chosen). */
export const newDraftDesign = (lang?: string) => ({ ...defaultDesign, language: lang === 'en' ? ('en' as const) : ('ar' as const) });

/**
 * Core draft lookup. A token that matches no row is never adopted: with `create`
 * a brand-new row and fresh token are produced, otherwise null.
 */
export async function resolveDraft(
  token: string | undefined,
  opts: { create: boolean; lang?: 'ar' | 'en' },
): Promise<ResolvedDraft | null> {
  if (token && token.length <= 200) {
    const [row] = await db.select().from(calendars).where(eq(calendars.draftToken, token));
    if (row) return { calendar: row, token, created: false };
  }
  if (!opts.create) return null;
  const fresh = randomBytes(32).toString('base64url');
  const [row] = await db
    .insert(calendars)
    .values({
      draftToken: fresh,
      startMonth: defaultStartMonth(),
      selections: defaultSelections(),
      // A new draft's calendar language follows the visitor's UI language (existing drafts are untouched).
      design: newDraftDesign(opts.lang),
    })
    .returning();
  return { calendar: row, token: fresh, created: true };
}

/** For route handlers / server actions (request scope required). */
export async function getOrCreateDraft(): Promise<CalendarRow> {
  const jar = await cookies();
  const lang = jar.get(LANG_COOKIE)?.value === 'en' ? 'en' : 'ar';
  const r = (await resolveDraft(jar.get(DRAFT_COOKIE)?.value, { create: true, lang }))!;
  if (r.created) jar.set(DRAFT_COOKIE, r.token, draftCookieOptions());
  return r.calendar;
}

/** Read-only, for server components (cannot set cookies). */
export async function getDraft(): Promise<CalendarRow | null> {
  const jar = await cookies();
  return (await resolveDraft(jar.get(DRAFT_COOKIE)?.value, { create: false }))?.calendar ?? null;
}

// ---- validation ----

const keys = z.array(z.string().min(1).max(64)).max(50);
export const selectionsSchema = z.object({
  sector: z.string().min(1).max(64).nullable(),
  fields: keys,
  audiences: keys,
  uses: keys,
});

/** Start months are bounded to sane years (the Hijri/occurrence math and UI assume nothing wilder). */
export const MIN_START_YEAR = 2000;
export const MAX_START_YEAR = 2100;
export const startYearInRange = (s: string) => {
  const y = Number(s.slice(0, 4));
  return y >= MIN_START_YEAR && y <= MAX_START_YEAR;
};

export const startMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/)
  .refine(startYearInRange, `year must be ${MIN_START_YEAR}-${MAX_START_YEAR}`)
  .transform((s) => `${s.slice(0, 7)}-01`);

export { designSchema };

// ---- event views ----

export type CalendarEventView = {
  id: string;
  eventId: string | null;
  title: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  kind: string;
  color: string;
  icon: string;
  occurrences: Occurrence[];
  custom: boolean;
};

export async function listEventViews(
  calendar: CalendarRow,
  lang: 'ar' | 'en',
): Promise<CalendarEventView[]> {
  const rows = await db
    .select({ ce: calendarEvents, ev: events })
    .from(calendarEvents)
    .leftJoin(events, eq(calendarEvents.eventId, events.id))
    .where(eq(calendarEvents.calendarId, calendar.id))
    .orderBy(calendarEvents.addedAt);
  const ids = rows.flatMap((r) => (r.ev ? [r.ev.id] : []));
  const overrides = ids.length
    ? await db.select().from(eventOccurrences).where(inArray(eventOccurrences.eventId, ids))
    : [];
  const primary = calendar.design.primary;
  const views: CalendarEventView[] = rows.map(({ ce, ev }) => {
    if (ev) {
      return {
        id: ce.id,
        eventId: ev.id,
        title: lang === 'en' ? ev.titleEn || ev.titleAr : ev.titleAr,
        titleAr: ev.titleAr,
        titleEn: ev.titleEn || ev.titleAr,
        descriptionAr: ev.descriptionAr,
        descriptionEn: ev.descriptionEn || ev.descriptionAr,
        kind: ev.kind,
        color: ev.color ?? primary,
        icon: ev.icon ?? '★',
        occurrences: resolveOccurrences(ev, overrides, calendar.startMonth, SPAN_MONTHS),
        custom: false,
      };
    }
    const date = ce.customDate ?? calendar.startMonth;
    const title =
      lang === 'en' ? ce.customTitleEn || ce.customTitleAr || '' : ce.customTitleAr || ce.customTitleEn || '';
    return {
      id: ce.id,
      eventId: null,
      title,
      titleAr: ce.customTitleAr || ce.customTitleEn || '',
      titleEn: ce.customTitleEn || ce.customTitleAr || '',
      descriptionAr: '',
      descriptionEn: '',
      kind: 'custom',
      color: ce.customColor ?? primary,
      icon: '★',
      occurrences: inSpan(calendar, date)
        ? [{ eventId: ce.id, start: date, end: date, status: 'confirmed' }]
        : [],
      custom: true,
    };
  });
  return views.sort((a, b) =>
    (a.occurrences[0]?.start ?? '9999').localeCompare(b.occurrences[0]?.start ?? '9999'),
  );
}

export const inSpan = (calendar: CalendarRow, iso: string) =>
  iso >= calendar.startMonth && iso <= spanEnd(calendar.startMonth, SPAN_MONTHS);

// ---- route-handler helpers (read the request, write the response; no Next request scope) ----

function cookieFrom(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      const raw = part.slice(i + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return undefined; // malformed percent-encoding: treat as no cookie
      }
    }
  }
  return undefined;
}

export const langFromRequest = (req: Request): 'ar' | 'en' =>
  cookieFrom(req, LANG_COOKIE) === 'en' ? 'en' : 'ar';

export const draftFromRequest = (req: Request, create: boolean) =>
  resolveDraft(cookieFrom(req, DRAFT_COOKIE), { create, lang: langFromRequest(req) });

/** Sets the draft cookie on a response only when a new draft was just created. */
export function withDraftCookie(res: NextResponse, draft: ResolvedDraft): NextResponse {
  if (draft.created) res.cookies.set(DRAFT_COOKIE, draft.token, draftCookieOptions());
  return res;
}
