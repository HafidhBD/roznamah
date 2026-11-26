import { afterAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import { db, sql } from '@/db/client';
import { eventOccurrences, events } from '@/db/schema';
import { needsDate } from '@/lib/admin/overview';

const SLUGS = ['needs-date-none', 'needs-date-dated', 'needs-date-inactive'];

afterAll(async () => {
  await db.delete(events).where(inArray(events.slug, SLUGS));
  await sql.end();
});

describe('needsDate (admin overview)', () => {
  it('lists active annual_manual events with no occurrence in the next 12 months, with the year to fill in', async () => {
    const base = { titleEn: 'x', kind: 'commercial' as const, recurrence: 'annual_manual' as const, durationDays: 1, prepDays: 1 };
    const rows = await db
      .insert(events)
      .values([
        { ...base, slug: 'needs-date-none', titleAr: 'بلا تاريخ', active: true },
        { ...base, slug: 'needs-date-dated', titleAr: 'مؤرخ', active: true },
        { ...base, slug: 'needs-date-inactive', titleAr: 'معطل', active: false },
      ])
      .returning({ id: events.id, slug: events.slug });
    const id = (slug: string) => rows.find((r) => r.slug === slug)!.id;
    await db.insert(eventOccurrences).values({ eventId: id('needs-date-dated'), year: 2028, startDate: '2028-03-01', status: 'confirmed' });

    const today = '2027-12-01';
    const list = await needsDate(today);
    const slugsListed = list.map((i) => i.eventId);
    expect(list.find((i) => i.eventId === id('needs-date-none'))).toMatchObject({ titleAr: 'بلا تاريخ', year: 2028 });
    expect(slugsListed).not.toContain(id('needs-date-dated'));
    expect(slugsListed).not.toContain(id('needs-date-inactive'));
    // Seeded White Friday has 2026 and 2027 dates only: after Black Friday 2027 it needs its 2028 date.
    const [wf] = await db.select().from(events).where(inArray(events.slug, ['white-friday']));
    expect(list.find((i) => i.eventId === wf.id)).toMatchObject({ year: 2028 });
    // ...but not while its 2027 date is still ahead.
    expect((await needsDate('2027-01-15')).map((i) => i.eventId)).not.toContain(wf.id);
  });
});
