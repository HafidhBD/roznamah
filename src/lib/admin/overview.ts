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
