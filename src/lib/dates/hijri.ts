import type { Lang } from '@/i18n/core';

export type HijriDate = { year: number; month: number; day: number };

const DAY_MS = 86_400_000;

const numericFormat = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

export function toHijri(d: Date): HijriDate {
  const out: Partial<HijriDate> = {};
  for (const p of numericFormat.formatToParts(d)) {
    if (p.type === 'year') out.year = parseInt(p.value, 10);
    else if (p.type === 'month') out.month = parseInt(p.value, 10);
    else if (p.type === 'day') out.day = parseInt(p.value, 10);
  }
  return out as HijriDate;
}

/** Gregorian date (UTC noon) of an Umm al-Qura Hijri date. */
export function hijriToGregorian(hYear: number, hMonth: number, hDay: number): Date {
  const epoch = Date.UTC(622, 6, 16, 12);
  const estimate = epoch + ((hYear - 1) * 354.367 + (hMonth - 1) * 29.53 + hDay - 1) * DAY_MS;
  const base = new Date(Math.floor(estimate / DAY_MS) * DAY_MS + DAY_MS / 2);
  for (let i = 0; i <= 20; i++) {
    for (const sign of i === 0 ? [1] : [1, -1]) {
      const cand = new Date(base.getTime() + sign * i * DAY_MS);
      const h = toHijri(cand);
      if (h.year === hYear && h.month === hMonth && h.day === hDay) return cand;
    }
  }
  throw new Error(`No Gregorian date found for Hijri ${hYear}-${hMonth}-${hDay}`);
}

export function formatHijri(d: Date, lang: Lang): string {
  const locale = lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-u-ca-islamic-umalqura-nu-latn';
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}
