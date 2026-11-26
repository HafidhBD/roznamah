import { describe, expect, it } from 'vitest';
import type { EventRow, OccurrenceRow } from '@/db/schema';
import { formatHijri, hijriToGregorian, toHijri } from '@/lib/dates/hijri';
import { resolveOccurrences, spanEnd } from '@/lib/dates/occurrences';
import { monthGrid } from '@/lib/dates/month-grid';

const iso = (d: Date) => d.toISOString().slice(0, 10);

function ev(p: Partial<EventRow>): EventRow {
  return {
    id: 'e1',
    slug: 'x',
    titleAr: 'x',
    titleEn: 'x',
    descriptionAr: '',
    descriptionEn: '',
    kind: 'national',
    recurrence: 'gregorian_fixed',
    gMonth: null,
    gDay: null,
    hMonth: null,
    hDay: null,
    durationDays: 1,
    icon: null,
    color: null,
    contentIdeaAr: null,
    contentIdeaEn: null,
    prepDays: 14,
    sourceName: null,
    sourceUrl: null,
    active: true,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...p,
  };
}

function occ(p: Partial<OccurrenceRow>): OccurrenceRow {
  return {
    eventId: 'e1',
    year: 2027,
    startDate: '2027-01-01',
    status: 'confirmed',
    sourceUrl: null,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...p,
  };
}

const ramadan = ev({ id: 'ramadan-start', recurrence: 'hijri_fixed', kind: 'religious', hMonth: 9, hDay: 1 });

describe('hijri conversion', () => {
  it('converts Gregorian to Umm al-Qura', () => {
    expect(toHijri(new Date('2027-03-10T12:00:00Z'))).toEqual({ year: 1448, month: 10, day: 2 });
  });
  it('converts Hijri to Gregorian', () => {
    expect(iso(hijriToGregorian(1448, 10, 1))).toBe('2027-03-09');
  });
  it('round-trips', () => {
    expect(toHijri(hijriToGregorian(1448, 9, 1))).toEqual({ year: 1448, month: 9, day: 1 });
  });
  it('formats in both languages', () => {
    const d = new Date('2027-03-10T12:00:00Z');
    expect(formatHijri(d, 'en')).toContain('1448');
    expect(formatHijri(d, 'ar')).toContain('1448');
  });
});

describe('spanEnd', () => {
  it('returns the last day of the span', () => {
    expect(spanEnd('2027-01-01', 12)).toBe('2027-12-31');
    expect(spanEnd('2027-03-01', 12)).toBe('2028-02-29');
  });
});

describe('resolveOccurrences', () => {
  it('resolves gregorian_fixed', () => {
    const e = ev({ id: 'nat', gMonth: 9, gDay: 23 });
    expect(resolveOccurrences(e, [], '2027-01-01', 12)).toEqual([
      { eventId: 'nat', start: '2027-09-23', end: '2027-09-23', status: 'confirmed' },
    ]);
  });
  it('skips Feb 29 in non-leap years', () => {
    const e = ev({ gMonth: 2, gDay: 29 });
    expect(resolveOccurrences(e, [], '2027-01-01', 12)).toEqual([]);
    expect(resolveOccurrences(e, [], '2028-01-01', 12).map((o) => o.start)).toEqual(['2028-02-29']);
  });
  it('finds one Ramadan start in a span', () => {
    const r = resolveOccurrences(ramadan, [], '2027-03-01', 12);
    expect(r.map((o) => o.start)).toEqual(['2028-01-28']);
    expect(r[0].status).toBe('estimated');
  });
  it('finds two Ramadan starts in one span', () => {
    expect(resolveOccurrences(ramadan, [], '2030-01-01', 12).map((o) => o.start)).toEqual([
      '2030-01-05',
      '2030-12-26',
    ]);
  });
  it('override wins and confirms', () => {
    const o = occ({ eventId: 'ramadan-start', year: 2028, startDate: '2028-01-29' });
    expect(resolveOccurrences(ramadan, [o], '2027-03-01', 12)).toEqual([
      { eventId: 'ramadan-start', start: '2028-01-29', end: '2028-01-29', status: 'confirmed' },
    ]);
  });
  it('consumes an override once when a year has two occurrences', () => {
    const o = occ({ eventId: 'ramadan-start', year: 2030, startDate: '2030-01-06' });
    expect(
      resolveOccurrences(ramadan, [o], '2030-01-01', 12).map((r) => [r.start, r.status]),
    ).toEqual([
      ['2030-01-06', 'confirmed'],
      ['2030-12-26', 'estimated'],
    ]);
  });
  it('override row status wins', () => {
    const o = occ({ eventId: 'ramadan-start', year: 2028, startDate: '2028-01-29', status: 'estimated' });
    expect(resolveOccurrences(ramadan, [o], '2027-03-01', 12)[0].status).toBe('estimated');
  });
  it('ignores overrides for other events', () => {
    const o = occ({ eventId: 'other', year: 2028, startDate: '2028-01-29' });
    expect(resolveOccurrences(ramadan, [o], '2027-03-01', 12)[0].start).toBe('2028-01-28');
  });
  it('annual_manual without override yields none', () => {
    expect(resolveOccurrences(ev({ recurrence: 'annual_manual' }), [], '2027-01-01', 12)).toEqual([]);
  });
  it('annual_manual uses override rows inside the span', () => {
    const e = ev({ recurrence: 'annual_manual' });
    const rows = [
      occ({ year: 2027, startDate: '2027-05-10', status: 'estimated' }),
      occ({ year: 2028, startDate: '2028-05-10' }),
    ];
    expect(resolveOccurrences(e, rows, '2027-01-01', 12)).toEqual([
      { eventId: 'e1', start: '2027-05-10', end: '2027-05-10', status: 'estimated' },
    ]);
  });
  it('applies durationDays', () => {
    const e = ev({ gMonth: 9, gDay: 22, durationDays: 3 });
    expect(resolveOccurrences(e, [], '2027-01-01', 12)[0].end).toBe('2027-09-24');
  });
});

describe('monthGrid', () => {
  it('lays out February 2027 with Sunday start', () => {
    const g = monthGrid(2027, 1, 0);
    expect(g[0]).toEqual([null, '2027-02-01', '2027-02-02', '2027-02-03', '2027-02-04', '2027-02-05', '2027-02-06']);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g.flat().filter(Boolean)).toHaveLength(28);
  });
  it('supports Monday and Saturday starts', () => {
    expect(monthGrid(2027, 1, 1)[0][0]).toBe('2027-02-01');
    expect(monthGrid(2027, 1, 6)[0].indexOf('2027-02-01')).toBe(2);
  });
});
