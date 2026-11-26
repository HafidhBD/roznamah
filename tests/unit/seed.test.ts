import { afterAll, describe, expect, it } from 'vitest';
import { and, count, eq } from 'drizzle-orm';
import { db, sql } from '@/db/client';
import { eventOccurrences, eventTags, events, taxonomyTerms } from '@/db/schema';
import { runSeed } from '@/db/seed/run';
import { eventsSeed, validateEvent, type SeedEvent } from '@/db/seed/events';
import { taxonomyKeys } from '@/db/seed/taxonomy';

afterAll(async () => {
  await sql.end();
});

async function counts() {
  const [t] = await db.select({ n: count() }).from(taxonomyTerms);
  const [e] = await db.select({ n: count() }).from(events);
  const [g] = await db.select({ n: count() }).from(eventTags);
  const [o] = await db.select({ n: count() }).from(eventOccurrences);
  return { terms: t.n, events: e.n, tags: g.n, occurrences: o.n };
}

describe('seed', () => {
  it('is idempotent and large enough', async () => {
    await runSeed();
    const first = await counts();
    await runSeed();
    const second = await counts();
    expect(second).toEqual(first);
    expect(first.events).toBeGreaterThanOrEqual(60);
    expect(first.terms).toBe(4 + 14 + 10 + 5);
  });

  it('has the national day with the right date', async () => {
    await runSeed();
    const [nd] = await db.select().from(events).where(eq(events.slug, 'national-day'));
    expect(nd.gMonth).toBe(9);
    expect(nd.gDay).toBe(23);
    expect(nd.kind).toBe('national');
    const slugs = new Set((await db.select({ s: events.slug }).from(events)).map((r) => r.s));
    for (const s of [
      'founding-day', 'flag-day', 'ramadan-start', 'eid-al-fitr', 'arafah-day', 'eid-al-adha',
      'hijri-new-year', 'white-friday', 'back-to-school', 'riyadh-season', 'year-end',
    ])
      expect(slugs.has(s), s).toBe(true);
  });

  it('seeds Hijri religious events and the White Friday overrides', async () => {
    await runSeed();
    const rows = await db.select().from(events);
    const by = (s: string) => rows.find((r) => r.slug === s)!;
    expect([by('ramadan-start').hMonth, by('ramadan-start').hDay]).toEqual([9, 1]);
    expect([by('eid-al-fitr').hMonth, by('eid-al-fitr').durationDays]).toEqual([10, 3]);
    expect([by('arafah-day').hMonth, by('arafah-day').hDay]).toEqual([12, 9]);
    expect([by('eid-al-adha').hDay, by('eid-al-adha').durationDays]).toEqual([10, 4]);
    expect(by('hijri-new-year').recurrence).toBe('hijri_fixed');
    const occ = await db.select().from(eventOccurrences).where(eq(eventOccurrences.eventId, by('white-friday').id));
    expect(occ.map((o) => `${o.year}:${o.startDate}:${o.status}`).sort()).toEqual([
      '2026:2026-11-27:confirmed',
      '2027:2027-11-26:confirmed',
    ]);
    const none = await db.select().from(eventOccurrences).where(eq(eventOccurrences.eventId, by('riyadh-season').id));
    expect(none).toHaveLength(0);
  });

  it('tags every field key with at least 2 events', async () => {
    await runSeed();
    const rows = await db
      .select({ key: taxonomyTerms.key, n: count() })
      .from(eventTags)
      .innerJoin(taxonomyTerms, eq(eventTags.termId, taxonomyTerms.id))
      .where(eq(taxonomyTerms.group, 'field'))
      .groupBy(taxonomyTerms.key);
    const got = new Map(rows.map((r) => [r.key, r.n]));
    for (const key of taxonomyKeys.field) expect(got.get(key) ?? 0, key).toBeGreaterThanOrEqual(2);
  });

  it('differentiates sector weights except for national/religious events', () => {
    for (const e of eventsSeed) {
      const w = e.tags.filter((t) => t.group === 'sector').map((t) => t.weight);
      expect(w.length, e.slug).toBe(4);
      const equal = new Set(w).size === 1;
      if (e.kind === 'national' || e.kind === 'religious') expect(w).toEqual([3, 3, 3, 3]);
      else expect(equal, e.slug).toBe(false);
    }
    const wf = eventsSeed.find((e) => e.slug === 'white-friday')!;
    const sec = Object.fromEntries(wf.tags.filter((t) => t.group === 'sector').map((t) => [t.key, t.weight]));
    expect(sec.government).toBe(1);
    expect(sec.private).toBe(3);
  });

  it('gives every event a source (except commercial) and a content idea', () => {
    for (const e of eventsSeed) {
      expect(e.contentIdeaAr.length, e.slug).toBeGreaterThan(10);
      expect(e.contentIdeaEn.length, e.slug).toBeGreaterThan(10);
      if (e.kind !== 'commercial') expect(e.sourceUrl, e.slug).toMatch(/^https:\/\//);
    }
  });
});

describe('seed is non-destructive', () => {
  it('keeps admin edits by default and restores them with update:true', async () => {
    await runSeed();
    const [ev] = await db.select().from(events).where(eq(events.slug, 'national-day'));
    const [tag] = await db.select().from(eventTags).where(eq(eventTags.eventId, ev.id)).limit(1);
    const orig = { title: ev.titleAr, weight: tag.weight };
    const newWeight = tag.weight === 1 ? 2 : 1;
    const tagKey = and(eq(eventTags.eventId, ev.id), eq(eventTags.termId, tag.termId));
    await db.update(events).set({ titleAr: 'تعديل المشرف' }).where(eq(events.id, ev.id));
    await db.update(eventTags).set({ weight: newWeight }).where(tagKey);

    await runSeed();
    const [after] = await db.select().from(events).where(eq(events.id, ev.id));
    const [afterTag] = await db.select().from(eventTags).where(tagKey);
    expect(after.titleAr).toBe('تعديل المشرف');
    expect(afterTag.weight).toBe(newWeight);

    await runSeed({ update: true });
    const [restored] = await db.select().from(events).where(eq(events.id, ev.id));
    const [restoredTag] = await db.select().from(eventTags).where(tagKey);
    expect(restored.titleAr).toBe(orig.title);
    expect(restoredTag.weight).toBe(orig.weight);
  });

  it('no longer seeds unofficial occasions', () => {
    const slugs = eventsSeed.map((e) => e.slug);
    expect(slugs).not.toContain('isra-miraj');
    expect(slugs).not.toContain('laylat-al-qadr');
  });
});

describe('validateEvent', () => {
  const base = eventsSeed.find((e) => e.slug === 'national-day')!;
  const bad = (patch: Partial<SeedEvent>) => () => validateEvent({ ...base, ...patch });

  it('accepts the seed and rejects out-of-range or inconsistent dates', () => {
    expect(bad({})).not.toThrow();
    expect(bad({ gMonth: 13 })).toThrow(/gMonth/);
    expect(bad({ gMonth: 4, gDay: 31 })).toThrow(/gDay/);
    expect(bad({ gDay: 0 })).toThrow(/gDay/);
    expect(bad({ hMonth: 9, hDay: 1 })).toThrow(/hMonth/);
    expect(bad({ recurrence: 'hijri_fixed', hMonth: 13, hDay: 1, gMonth: undefined, gDay: undefined })).toThrow(/hMonth/);
    expect(bad({ recurrence: 'hijri_fixed', hMonth: 9, hDay: 31, gMonth: undefined, gDay: undefined })).toThrow(/hDay/);
    expect(bad({ recurrence: 'hijri_fixed', hMonth: 9, hDay: 1 })).toThrow(/gMonth/);
    expect(bad({ recurrence: 'annual_manual' })).toThrow(/annual_manual/);
    expect(bad({ tags: [{ group: 'field', key: 'nope', weight: 2 }] })).toThrow(/unknown/);
    expect(bad({ tags: [{ group: 'field', key: 'health', weight: 4 }] })).toThrow(/weight/);
  });
});
