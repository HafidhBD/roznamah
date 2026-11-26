import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { db, sql } from '@/db/client';
import { calendars, events } from '@/db/schema';
import { DELETE as delEvent, POST as postEvent } from '@/app/api/draft/events/route';
import { GET, PATCH } from '@/app/api/draft/route';
import { resolveDraft } from '@/lib/draft';

const tokens: string[] = [];
afterAll(async () => {
  if (tokens.length) await db.delete(calendars).where(inArray(calendars.draftToken, tokens));
  await sql.end();
});

const req = (method: string, path: string, token?: string, body?: unknown, extra = '') =>
  new Request(`http://x${path}`, {
    method,
    headers: { cookie: [token && `rz_draft=${token}`, extra].filter(Boolean).join('; ') },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function fresh() {
  const res = await GET(req('GET', '/api/draft'));
  const sc = res.cookies.get('rz_draft')!;
  tokens.push(sc.value);
  return { res, token: sc.value, json: await res.json() };
}
const someEvents = async (n: number) => (await db.select({ id: events.id }).from(events).where(eq(events.active, true)).limit(n)).map((e) => e.id);

describe('draft API', () => {
  it('sets an httpOnly 90-day cookie when none is sent', async () => {
    const { res, json } = await fresh();
    const header = res.headers.get('set-cookie')!;
    expect(header).toMatch(/rz_draft=/);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/Max-Age=7776000/i);
    expect(header).toMatch(/SameSite=lax/i);
    expect(json.calendar.startMonth).toMatch(/^\d{4}-01-01$/);
    expect(json.calendar.design.primary).toBe('#6d3df5');
    expect(json.events).toEqual([]);
  });

  it('does not re-set the cookie for a valid token', async () => {
    const { token } = await fresh();
    const res = await GET(req('GET', '/api/draft', token));
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('isolates drafts between cookies', async () => {
    const a = await fresh();
    const b = await fresh();
    expect(a.token).not.toBe(b.token);
    const [id] = await someEvents(1);
    expect((await postEvent(req('POST', '/api/draft/events', a.token, { eventIds: [id] }))).status).toBe(200);
    const ja = await (await GET(req('GET', '/api/draft', a.token))).json();
    const jb = await (await GET(req('GET', '/api/draft', b.token))).json();
    expect(ja.events).toHaveLength(1);
    expect(jb.events).toHaveLength(0);
  });

  it('forged cookie creates a new empty draft and never adopts the token', async () => {
    const a = await fresh();
    const [id] = await someEvents(1);
    await postEvent(req('POST', '/api/draft/events', a.token, { eventIds: [id] }));
    const res = await GET(req('GET', '/api/draft', 'forged-token-value'));
    const issued = res.cookies.get('rz_draft')!.value;
    tokens.push(issued);
    expect(issued).not.toBe('forged-token-value');
    expect(issued).not.toBe(a.token);
    expect((await res.json()).events).toEqual([]);
    expect(await resolveDraft('forged-token-value', { create: false })).toBeNull();
  });

  it('rejects an invalid design color and leaves the design unchanged', async () => {
    const { token } = await fresh();
    const bad = await PATCH(req('PATCH', '/api/draft', token, { design: { primary: 'red' } }));
    expect(bad.status).toBe(400);
    const j = await (await GET(req('GET', '/api/draft', token))).json();
    expect(j.calendar.design.primary).toBe('#6d3df5');
  });

  it('merges a partial design, normalizes startMonth and validates selections', async () => {
    const { token } = await fresh();
    const ok = await PATCH(
      req('PATCH', '/api/draft', token, { startMonth: '2027-03-17', design: { primary: '#112233', title: 'x'.repeat(120) } }),
    );
    expect(ok.status).toBe(200);
    const j = await ok.json();
    expect(j.calendar.startMonth).toBe('2027-03-01');
    expect(j.calendar.design.primary).toBe('#112233');
    expect(j.calendar.design.secondary).toBe('#d8a54f');
    expect((await PATCH(req('PATCH', '/api/draft', token, { design: { title: 'x'.repeat(121) } }))).status).toBe(400);
    expect((await PATCH(req('PATCH', '/api/draft', token, { design: { bogus: 1 } }))).status).toBe(400);
    expect((await PATCH(req('PATCH', '/api/draft', token, { selections: { sector: 1 } }))).status).toBe(400);
    const sel = { sector: 'tech', fields: ['a'], audiences: [], uses: [] };
    const s = await (await PATCH(req('PATCH', '/api/draft', token, { selections: sel }))).json();
    expect(s.calendar.selections).toEqual(sel);
  });

  it('rejects a custom event outside the span and accepts one inside', async () => {
    const { token, json } = await fresh();
    const year = json.calendar.startMonth.slice(0, 4);
    const outside = await postEvent(
      req('POST', '/api/draft/events', token, { custom: { titleAr: 'حدث', date: `${Number(year) + 2}-01-01` } }),
    );
    expect(outside.status).toBe(400);
    const inside = await postEvent(
      req('POST', '/api/draft/events', token, { custom: { titleAr: 'حدث', date: `${year}-05-10` } }, 'rz_lang=en'),
    );
    expect(inside.status).toBe(200);
    const ev = (await inside.json()).events[0];
    expect(ev).toMatchObject({ custom: true, kind: 'custom', icon: '★', color: '#6d3df5', title: 'حدث', eventId: null });
    expect(ev.occurrences[0]).toMatchObject({ start: `${year}-05-10`, status: 'confirmed' });
  });

  it('custom event outside the current span stays but has no occurrences', async () => {
    const { token } = await fresh();
    await PATCH(req('PATCH', '/api/draft', token, { startMonth: '2027-01' }));
    const add = await postEvent(req('POST', '/api/draft/events', token, { custom: { titleAr: 'حدث', date: '2027-05-10' } }));
    expect((await add.json()).events[0].occurrences).toHaveLength(1);
    await PATCH(req('PATCH', '/api/draft', token, { startMonth: '2028-01' }));
    const j = await (await GET(req('GET', '/api/draft', token))).json();
    expect(j.events).toHaveLength(1);
    expect(j.events[0].occurrences).toEqual([]);
    await PATCH(req('PATCH', '/api/draft', token, { startMonth: '2027-01' }));
    expect((await (await GET(req('GET', '/api/draft', token))).json()).events[0].occurrences).toHaveLength(1);
  });

  it('adding the same eventId twice is idempotent; unknown ids give 400', async () => {
    const { token } = await fresh();
    const [id] = await someEvents(1);
    await postEvent(req('POST', '/api/draft/events', token, { eventIds: [id] }));
    const r = await postEvent(req('POST', '/api/draft/events', token, { eventIds: [id, id] }));
    expect(r.status).toBe(200);
    expect((await r.json()).events).toHaveLength(1);
    const unknown = await postEvent(
      req('POST', '/api/draft/events', token, { eventIds: [id, '00000000-0000-4000-8000-000000000000'] }),
    );
    expect(unknown.status).toBe(400);
  });

  it('cookie B cannot delete a row of calendar A; A can', async () => {
    const a = await fresh();
    const b = await fresh();
    const [id] = await someEvents(1);
    const added = await (await postEvent(req('POST', '/api/draft/events', a.token, { eventIds: [id] }))).json();
    const rowId = added.events[0].id;
    expect((await delEvent(req('DELETE', `/api/draft/events?id=${rowId}`, b.token))).status).toBe(404);
    expect((await delEvent(req('DELETE', `/api/draft/events?id=${rowId}`))).status).toBe(404);
    expect((await (await GET(req('GET', '/api/draft', a.token))).json()).events).toHaveLength(1);
    expect((await delEvent(req('DELETE', `/api/draft/events?id=${rowId}`, a.token))).status).toBe(200);
    expect((await (await GET(req('GET', '/api/draft', a.token))).json()).events).toHaveLength(0);
  });
});
