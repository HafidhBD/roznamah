import type { EventRow, OccurrenceRow } from '@/db/schema';
import { hijriToGregorian, toHijri } from './hijri';

export type Occurrence = {
  eventId: string;
  start: string; // YYYY-MM-DD
  end: string;
  status: 'confirmed' | 'estimated';
};

const DAY_MS = 86_400_000;

const parseIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => toIso(new Date(parseIso(iso).getTime() + n * DAY_MS));

/** Last day of the span of `months` months starting on `spanStart`. */
export function spanEnd(spanStart: string, months: number): string {
  const s = parseIso(spanStart);
  const next = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + months, s.getUTCDate(), 12));
  return addDays(toIso(next), -1);
}

export function resolveOccurrences(
  event: EventRow,
  overrides: OccurrenceRow[],
  spanStart: string,
  months: number,
): Occurrence[] {
  const last = spanEnd(spanStart, months);
  const inSpan = (iso: string) => iso >= spanStart && iso <= last;
  const mine = overrides.filter((o) => o.eventId === event.id);
  const make = (start: string, status: Occurrence['status']): Occurrence => ({
    eventId: event.id,
    start,
    end: addDays(start, Math.max(1, event.durationDays) - 1),
    status,
  });
  const result: Occurrence[] = [];

  if (event.recurrence === 'annual_manual') {
    for (const o of mine) if (inSpan(o.startDate)) result.push(make(o.startDate, o.status));
  } else {
    const computed: string[] = [];
    if (event.recurrence === 'gregorian_fixed') {
      if (event.gMonth != null && event.gDay != null) {
        const y0 = parseIso(spanStart).getUTCFullYear();
        const y1 = parseIso(last).getUTCFullYear();
        for (let y = y0; y <= y1; y++) {
          const d: Date = new Date(Date.UTC(y, event.gMonth - 1, event.gDay, 12));
          // Invalid dates (e.g. Feb 29 in a non-leap year) roll over: skip them.
          if (d.getUTCMonth() === event.gMonth - 1 && d.getUTCDate() === event.gDay) computed.push(toIso(d));
        }
      }
    } else if (event.hMonth != null && event.hDay != null) {
      const h0 = toHijri(parseIso(spanStart)).year;
      const h1 = toHijri(parseIso(last)).year;
      for (let hy = h0; hy <= h1; hy++) {
        try {
          computed.push(toIso(hijriToGregorian(hy, event.hMonth, event.hDay)));
        } catch {
          // The day does not exist in that Hijri year (e.g. day 30 of a 29-day month): skip it.
        }
      }
    }
    const isHijri = event.recurrence === 'hijri_fixed';
    // Each override row replaces at most one computed occurrence: the nearest one in its year.
    const overrideFor = new Map<number, OccurrenceRow>();
    for (const o of mine) {
      let best = -1;
      let bestDist = Infinity;
      computed.forEach((c, i) => {
        if (overrideFor.has(i) || parseIso(c).getUTCFullYear() !== o.year) return;
        const dist = Math.abs(parseIso(c).getTime() - parseIso(o.startDate).getTime());
        if (dist < bestDist) {
          best = i;
          bestDist = dist;
        }
      });
      if (best >= 0) overrideFor.set(best, o);
    }
    computed.forEach((start, i) => {
      const override = overrideFor.get(i);
      const final = override ? override.startDate : start;
      if (!inSpan(final)) return;
      result.push(make(final, override ? override.status : isHijri ? 'estimated' : 'confirmed'));
    });
  }
  return result.sort((a, b) => a.start.localeCompare(b.start));
}
