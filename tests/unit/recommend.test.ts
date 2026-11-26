import { afterAll, describe, expect, it } from 'vitest';
import { sql } from '@/db/client';
import { recommend, scoreEvent, type EventWithTags, type Selections } from '@/lib/recommend';

type Tag = EventWithTags['tags'][number];
const tag = (group: Tag['group'], key: string, labelAr: string, labelEn: string, weight: number): Tag => ({
  group, key, labelAr, labelEn, weight,
});
const ev = (kind: EventWithTags['kind'], tags: Tag[]): EventWithTags =>
  ({ id: 'x', slug: 'x', kind, active: true, tags }) as unknown as EventWithTags;

const health = tag('field', 'health', 'الصحة', 'Health', 3);
const environment = tag('field', 'environment', 'البيئة', 'Environment', 3);
const gov = (w: number) => tag('sector', 'government', 'حكومي', 'Government', w);
const priv = (w: number) => tag('sector', 'private', 'خاص', 'Private', w);

const healthDay = ev('field', [health, gov(3)]);
const waterDay = ev('international', [environment, gov(2)]);
const nationalDay = ev('national', []);
const whiteFriday = ev('commercial', [
  tag('field', 'retail', 'التجزئة', 'Retail', 3),
  tag('field', 'health', 'الصحة', 'Health', 1),
  priv(3),
  gov(1),
]);

const sel = (o: Partial<Selections> = {}): Selections => ({ sector: null, fields: [], audiences: [], uses: [], ...o });

describe('scoreEvent', () => {
  it('ranks health day above water day for government+health', () => {
    const s = sel({ sector: 'government', fields: ['health'] });
    expect(scoreEvent(healthDay, s).score).toBeGreaterThan(scoreEvent(waterDay, s).score);
    expect(scoreEvent(healthDay, s).score).toBe(62);
  });

  it('national day scores at least 70 for any selection', () => {
    expect(scoreEvent(nationalDay, sel()).score).toBeGreaterThanOrEqual(70);
    expect(scoreEvent(nationalDay, sel({ fields: ['sports'], uses: ['x'] })).score).toBeGreaterThanOrEqual(70);
  });

  it('national/religious floor holds for every sector', () => {
    for (const sector of [null, 'government', 'private', 'semi_government', 'nonprofit']) {
      expect(scoreEvent(nationalDay, sel({ sector })).score).toBeGreaterThanOrEqual(70);
      expect(scoreEvent(ev('religious', [gov(1)]), sel({ sector })).score).toBeGreaterThanOrEqual(70);
    }
  });

  it('white friday scores lower for government than private', () => {
    const f = { fields: ['retail'] };
    expect(scoreEvent(whiteFriday, sel({ sector: 'government', ...f })).score).toBeLessThan(
      scoreEvent(whiteFriday, sel({ sector: 'private', ...f })).score,
    );
  });

  it('gives reasons in both languages', () => {
    const r = scoreEvent(healthDay, sel({ fields: ['health'] })).reasons;
    expect(r).toContainEqual({ ar: 'يتوافق مع مجال: الصحة', en: 'Matches field: Health' });
    expect(scoreEvent(nationalDay, sel()).reasons).toContainEqual({ ar: 'مناسبة وطنية', en: 'National occasion' });
  });

  it('empty selections: only national/religious score > 0', () => {
    expect(scoreEvent(healthDay, sel()).score).toBe(0);
    expect(scoreEvent(ev('commercial', [priv(3)]), sel()).score).toBe(0);
    expect(scoreEvent(ev('religious', []), sel()).score).toBe(70);
  });

  it('applies the sector factor for untagged sector and clamps', () => {
    expect(scoreEvent(nationalDay, sel({ sector: 'government' })).score).toBe(70); // floored: 70 * 0.9 would be 63
    const full = ev('national', [
      tag('field', 'a', 'أ', 'A', 3), tag('audience', 'b', 'ب', 'B', 3), tag('use', 'c', 'ج', 'C', 3), gov(3),
    ]);
    expect(scoreEvent(full, sel({ sector: 'government', fields: ['a'], audiences: ['b'], uses: ['c'] })).score).toBe(100);
  });

  it('adds audience and use reasons', () => {
    const e = ev('field', [tag('audience', 'youth', 'الشباب', 'Youth', 2), tag('use', 'awareness', 'توعية', 'Awareness', 3)]);
    const r = scoreEvent(e, sel({ audiences: ['youth'], uses: ['awareness'] })).reasons;
    expect(r).toContainEqual({ ar: 'يناسب جمهور: الشباب', en: 'Suits audience: Youth' });
    expect(r).toContainEqual({ ar: 'مناسب لـ: توعية', en: 'Fits: Awareness' });
  });
});

describe('recommend (db)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('ranks for government+health and includes national day', async () => {
    const items = await recommend(sel({ sector: 'government', fields: ['health'] }), '2027-01-01');
    expect(items.length).toBeGreaterThan(0);
    const { db } = await import('@/db/client');
    const { events } = await import('@/db/schema');
    const rows = await db.select({ id: events.id, slug: events.slug }).from(events);
    const slug = new Map(rows.map((r) => [r.id, r.slug]));
    const order = items.map((i) => slug.get(i.eventId));
    expect(order).toContain('national-day');
    expect(order.indexOf('health-day')).toBeGreaterThanOrEqual(0);
    const water = order.indexOf('water-day'); // may be absent (score 0) which also ranks below
    if (water >= 0) expect(order.indexOf('health-day')).toBeLessThan(water);
    for (let i = 1; i < items.length; i++) expect(items[i - 1].score).toBeGreaterThanOrEqual(items[i].score);
    expect(items.every((i) => i.score > 0 && i.occurrences.length > 0)).toBe(true);
  });
});
