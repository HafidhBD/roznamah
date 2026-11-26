import type { Lang } from '@/i18n/core';
import type { CalendarEventView } from '@/lib/draft';
import type { Occurrence } from '@/lib/dates/occurrences';

/** One occurrence of one draft event: the unit the month and list views render. */
export type CalendarItem = { event: CalendarEventView; occ: Occurrence };

export const parseIso = (iso: string) => new Date(`${iso}T12:00:00Z`);

export const pad = (n: number) => String(n).padStart(2, '0');

const locale = (lang: Lang) => (lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB');

export function monthLabel(lang: Lang, year: number, month0: number, style: 'long' | 'short' = 'long') {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: 'UTC',
    month: style,
    year: style === 'long' ? 'numeric' : undefined,
  }).format(new Date(Date.UTC(year, month0, 1, 12)));
}

export function dayLabel(lang: Lang, iso: string) {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseIso(iso));
}

export function shortDate(lang: Lang, iso: string) {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(parseIso(iso));
}

export function weekdayLabel(lang: Lang, dow: number, style: 'short' | 'long' = 'short') {
  // 2027-01-03 is a Sunday.
  return new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', weekday: style }).format(
    new Date(Date.UTC(2027, 0, 3 + dow, 12)),
  );
}

export function flattenItems(events: CalendarEventView[]): CalendarItem[] {
  return events
    .flatMap((event) => event.occurrences.map((occ) => ({ event, occ })))
    .sort((a, b) => a.occ.start.localeCompare(b.occ.start) || a.event.title.localeCompare(b.event.title));
}

export const covers = (occ: { start: string; end: string }, iso: string) => occ.start <= iso && iso <= occ.end;

/** The 12 consecutive months of the span, from a `YYYY-MM-01` start. */
export function spanMonths(startMonth: string): { year: number; month0: number; key: string }[] {
  const y = Number(startMonth.slice(0, 4));
  const m = Number(startMonth.slice(5, 7)) - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m + i, 1, 12));
    const year = d.getUTCFullYear();
    const month0 = d.getUTCMonth();
    return { year, month0, key: `${year}-${pad(month0 + 1)}` };
  });
}

export function spanBounds(startMonth: string) {
  const months = spanMonths(startMonth);
  const last = months[11];
  const lastDay = new Date(Date.UTC(last.year, last.month0 + 1, 0, 12)).getUTCDate();
  return { min: startMonth, max: `${last.key}-${pad(lastDay)}` };
}
