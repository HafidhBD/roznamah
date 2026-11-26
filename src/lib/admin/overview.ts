import { count, eq, gte } from 'drizzle-orm';
import { db } from '@/db/client';
import { eventOccurrences, events, leads } from '@/db/schema';
import { resolveOccurrences } from '@/lib/dates/occurrences';

export type EstimatedItem = { eventId: string; titleAr: string; start: string; year: number };

/** Active Hijri events whose date in the next 6 months is still an estimate. */
export async function estimatedDates(today: string): Promise<EstimatedItem[]> {
  const evs = await db.select().from(events).where(eq(events.recurrence, 'hijri_fixed'));
  const overrides = await db.select().from(eventOccurrences);
  const out: EstimatedItem[] = [];
  for (const ev of evs.filter((e) => e.active)) {
    for (const o of resolveOccurrences(ev, overrides, today, 6)) {
      if (o.status === 'estimated') {
        out.push({ eventId: ev.id, titleAr: ev.titleAr, start: o.start, year: Number(o.start.slice(0, 4)) });
      }
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export type NeedsDateItem = { eventId: string; titleAr: string; year: number };

/**
 * Active annual_manual events (no computable date, e.g. White Friday) with no occurrence in the next
 * 12 months. `year` is the one to fill in: the later window year without a date, else this year.
 */
export async function needsDate(today: string): Promise<NeedsDateItem[]> {
  const evs = await db.select().from(events).where(eq(events.recurrence, 'annual_manual'));
  const overrides = await db.select().from(eventOccurrences);
  const thisYear = Number(today.slice(0, 4));
  const out: NeedsDateItem[] = [];
  for (const ev of evs.filter((e) => e.active)) {
    if (resolveOccurrences(ev, overrides, today, 12).length) continue;
    const has = (y: number) => overrides.some((o) => o.eventId === ev.id && o.year === y);
    out.push({ eventId: ev.id, titleAr: ev.titleAr, year: has(thisYear + 1) ? thisYear : thisYear + 1 });
  }
  return out.sort((a, b) => a.titleAr.localeCompare(b.titleAr, 'ar'));
}

/** Start of the current Saudi week (Sunday 00:00, UTC+3). */
export function weekStart(now: Date): Date {
  const local = new Date(now.getTime() + 3 * 3_600_000);
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(day - local.getUTCDay() * 86_400_000 - 3 * 3_600_000);
}

export async function overviewCounts(now = new Date()) {
  const [{ n: eventsTotal }] = await db.select({ n: count() }).from(events);
  const [{ n: leadsTotal }] = await db.select({ n: count() }).from(leads);
  const [{ n: leadsWeek }] = await db.select({ n: count() }).from(leads).where(gte(leads.createdAt, weekStart(now)));
  return { eventsTotal, leadsTotal, leadsWeek };
}
