import { afterAll, describe, expect, it } from 'vitest';
import { sql } from '@/db/client';
import { POST } from '@/app/api/recommendations/route';

afterAll(async () => {
  await sql.end();
});

const raw = (body: string) => POST(new Request('http://x/api/recommendations', { method: 'POST', body }));
const call = (b: unknown) => raw(JSON.stringify(b));
const sel = { sector: null, fields: [], audiences: [], uses: [] };

describe('POST /api/recommendations', () => {
  it('returns 200 with items for a valid body', async () => {
    const r = await call({ selections: sel, startMonth: '2027-01-01' });
    expect(r.status).toBe(200);
    expect((await r.json()).items.length).toBeGreaterThan(0);
  });
  it('returns 400 for invalid JSON, invalid body and month 2027-13', async () => {
    expect((await raw('{nope')).status).toBe(400);
    expect((await call({ selections: {}, startMonth: '2027-01' })).status).toBe(400);
    expect((await call({ selections: sel, startMonth: '2027-13' })).status).toBe(400);
  });
  it('normalizes YYYY-MM like YYYY-MM-01', async () => {
    const a = await (await call({ selections: sel, startMonth: '2027-03' })).json();
    const b = await (await call({ selections: sel, startMonth: '2027-03-01' })).json();
    expect(a).toEqual(b);
  });
});
