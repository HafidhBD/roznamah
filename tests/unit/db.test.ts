import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, sql } from '@/db/client';
import { calendars } from '@/db/schema';

const startMonth = '2027-01-01';

describe('db schema', () => {
  beforeEach(async () => {
    await db.delete(calendars).where(eq(calendars.draftToken, 'x'));
  });
  afterAll(async () => {
    await db.delete(calendars).where(eq(calendars.draftToken, 'x'));
    await sql.end();
  });

  it('enforces a unique draftToken on calendars', async () => {
    await db.insert(calendars).values({ draftToken: 'x', startMonth });
    const err = await db
      .insert(calendars)
      .values({ draftToken: 'x', startMonth })
      .then(() => null, (e: unknown) => e);
    expect(err).toBeTruthy();
    const cause = (err as { cause?: { code?: string } }).cause;
    expect(cause?.code).toBe('23505');
  });
});
