/** Pure helpers shared by the calendar document templates (labels, dates, colors). */
import { t, type Lang, type MessageKey } from '@/i18n/core';
import { toHijri } from '@/lib/dates/hijri';
import type { Design } from '@/lib/design';
import { PAGE_MM } from '@/lib/print-sizes';
import type { CalendarSnapshot, SnapshotEvent, SnapshotMonth } from '@/lib/snapshot-core';

export { BLEED_MM, DEFAULT_FORMAT, PAGE_MM, type PageFormat } from '@/lib/print-sizes';
/** Every template is drawn on an A4 artboard and scaled to the trim size. */
export const ARTBOARD = PAGE_MM.A4;

const noon = (y: number, m0: number, d = 1) => new Date(Date.UTC(y, m0, d, 12));
const gLocale = (l: Lang) => (l === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB-u-nu-latn');
const hLocale = (l: Lang) => (l === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-u-ca-islamic-umalqura-nu-latn');
const fmt = (locale: string, opts: Intl.DateTimeFormatOptions, d: Date) =>
  new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts }).format(d);

/** The document's text languages: `main` drives direction; `second` is the bilingual companion. */
export type DocLangs = { main: Lang; second: Lang | null; dir: 'rtl' | 'ltr' };
export function docLangs(language: Design['language']): DocLangs {
  if (language === 'en') return { main: 'en', second: null, dir: 'ltr' };
  return { main: 'ar', second: language === 'bi' ? 'en' : null, dir: 'rtl' };
}

export const monthName = (l: Lang, year: number, month0: number) => fmt(gLocale(l), { month: 'long' }, noon(year, month0));
export const monthYear = (l: Lang, year: number, month0: number) =>
  `${monthName(l, year, month0)} ${year}`;

export const weekdayName = (l: Lang, dow: number, style: 'long' | 'short' = 'long') =>
  fmt(gLocale(l), { weekday: style }, noon(2027, 0, 3 + dow)); // 2027-01-03 is a Sunday

/** One-letter (ar) or two-letter (en) weekday initial, for the small year-at-a-glance months. */
export const weekdayInitial = (l: Lang, dow: number) => t(l, 'doc.dowInitials').split(',')[dow];

const hijriMonthName = (l: Lang, d: Date) => fmt(hLocale(l), { month: 'long' }, d);

/** Hijri months a Gregorian month spans, e.g. «رجب – شعبان 1448» or «ذو الحجة 1448 – محرم 1449». */
export function hijriRange(l: Lang, year: number, month0: number): string {
  const first = noon(year, month0, 1);
  const last = noon(year, month0 + 1, 0);
  const a = toHijri(first);
  const b = toHijri(last);
  const suffix = t(l, 'doc.hijriRangeSuffix');
  if (a.year === b.year && a.month === b.month) return `${hijriMonthName(l, first)} ${a.year}${suffix}`;
  if (a.year === b.year) return `${hijriMonthName(l, first)} – ${hijriMonthName(l, last)} ${a.year}${suffix}`;
  return `${hijriMonthName(l, first)} ${a.year} – ${hijriMonthName(l, last)} ${b.year}${suffix}`;
}

/** The Hijri day label for a cell: the day number, with the month name on the 1st. */
export function hijriDay(l: Lang, iso: string): { day: number; month: string | null } {
  const d = new Date(`${iso}T12:00:00Z`);
  const h = toHijri(d);
  return { day: h.day, month: h.day === 1 ? hijriMonthName(l, d) : null };
}

export const isWeekend = (dow: number) => dow === 5 || dow === 6;
export const weekDows = (weekStart: number) => Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);

export type GridDay = { iso: string; inMonth: boolean };

/**
 * Always six week rows, so every month page has the same grid; days of the neighbouring months
 * fill the leading and trailing cells (rendered faintly, without occasions).
 */
export function gridDays(month: SnapshotMonth): GridDay[][] {
  const lead = Math.max(0, month.weeks[0].findIndex((d) => d !== null));
  const start = Date.UTC(month.year, month.month0, 1, 12) - lead * 86_400_000;
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start + (w * 7 + d) * 86_400_000);
      return { iso: date.toISOString().slice(0, 10), inMonth: date.getUTCMonth() === month.month0 };
    }),
  );
}

export function spanYears(snap: CalendarSnapshot): string {
  const first = snap.months[0];
  const last = snap.months[snap.months.length - 1];
  return first.year === last.year ? String(first.year) : `${first.year}–${last.year}`;
}

export function yearRange(l: Lang, snap: CalendarSnapshot): string {
  const first = snap.months[0];
  const last = snap.months[snap.months.length - 1];
  return `${monthYear(l, first.year, first.month0)} – ${monthYear(l, last.year, last.month0)}`;
}

export function docTitle(design: Design, l: Lang, snap: CalendarSnapshot): string {
  return design.title.trim() || t(l, 'doc.defaultTitle').replace('{year}', spanYears(snap));
}

export const orgName = (design: Design, l: Lang) =>
  (l === 'en' ? design.orgNameEn || design.orgNameAr : design.orgNameAr || design.orgNameEn).trim();

export const eventTitle = (ev: SnapshotEvent, l: Lang) => (l === 'en' ? ev.titleEn || ev.titleAr : ev.titleAr || ev.titleEn);
export const eventDescription = (ev: SnapshotEvent, l: Lang) =>
  (l === 'en' ? ev.descriptionEn || ev.descriptionAr : ev.descriptionAr || ev.descriptionEn).trim();

export const KINDS = ['national', 'religious', 'international', 'field', 'commercial', 'custom'] as const;
const KIND_COLORS: Record<string, string> = {
  national: '#1c7c4c',
  religious: '#a8782a',
  international: '#2c6aa6',
  commercial: '#c4532b',
};

export function eventColor(ev: SnapshotEvent, design: Design): string {
  if (!design.colorByKind) return ev.color;
  if (ev.kind === 'field') return design.primary;
  if (ev.kind === 'custom') return design.secondary;
  return KIND_COLORS[ev.kind] ?? design.primary;
}
export const kindColor = (kind: string, design: Design) =>
  kind === 'field' ? design.primary : kind === 'custom' ? design.secondary : (KIND_COLORS[kind] ?? design.primary);

export const kindLabel = (kind: string, l: Lang) => t(l, `doc.kind.${kind}` as MessageKey);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const INK = '#1d1a2b';
/** White or ink, whichever reads better on `hex`. */
export const readableOn = (hex: string) => (luminance(hex) > 0.36 ? INK : '#ffffff');

/** Unique occurrences touching a month, in date order (for the notes list and legends). */
export function monthOccasions(month: SnapshotMonth): SnapshotEvent[] {
  const seen = new Set<string>();
  const out: SnapshotEvent[] = [];
  for (const iso of Object.keys(month.events).sort()) {
    for (const ev of month.events[iso]) {
      const key = `${ev.id}|${ev.start}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(ev);
      }
    }
  }
  return out;
}

export const dayOf = (iso: string) => Number(iso.slice(8, 10));

/** "23" or "30 – 2" style day span for an occasion, within its month listing. */
export function daySpan(ev: SnapshotEvent): string {
  return ev.start === ev.end ? String(dayOf(ev.start)) : `${dayOf(ev.start)}–${dayOf(ev.end)}`;
}
