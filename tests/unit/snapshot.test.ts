import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { and, eq, gt, inArray } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, sql } from '@/db/client';
import { calendars, events } from '@/db/schema';

const dir = mkdtempSync(path.join(tmpdir(), 'rz-snap-'));
process.env.UPLOAD_DIR = dir;
process.env.RENDER_SECRET = 'test-render-secret';

let logoRoute: typeof import('@/app/api/draft/logo/route');
let draftRoute: typeof import('@/app/api/draft/route');
let eventsRoute: typeof import('@/app/api/draft/events/route');
let buildSnapshot: typeof import('@/lib/snapshot').buildSnapshot;

const tokens: string[] = [];
beforeAll(async () => {
  logoRoute = await import('@/app/api/draft/logo/route');
  draftRoute = await import('@/app/api/draft/route');
  eventsRoute = await import('@/app/api/draft/events/route');
  ({ buildSnapshot } = await import('@/lib/snapshot'));
});
afterAll(async () => {
  if (tokens.length) await db.delete(calendars).where(inArray(calendars.draftToken, tokens));
  await sql.end();
  rmSync(dir, { recursive: true, force: true });
});

const cookie = (token?: string) => (token ? { cookie: `rz_draft=${token}` } : undefined);
const json = (method: string, url: string, token: string | undefined, body: unknown) =>
  new Request(`http://x${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...cookie(token) },
    body: JSON.stringify(body),
  });

async function upload(token: string | undefined, bytes: Buffer, name = 'logo.png', type = 'image/png') {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(bytes)], name, { type }));
  const res = await logoRoute.POST(new Request('http://x/api/draft/logo', { method: 'POST', headers: cookie(token), body: form }));
  const set = res.cookies.get('rz_draft')?.value;
  if (set) tokens.push(set);
  return { res, token: set ?? token };
}

const png = () => sharp({ create: { width: 120, height: 60, channels: 4, background: '#0a7f5a' } }).png().toBuffer();

describe('logo route + snapshot', () => {
  it('stores the logo for the draft, serves it only with the cookie or the render secret, and embeds it in the snapshot', async () => {
    const { res, token } = await upload(undefined, await png());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logoUrl).toMatch(/^\/api\/draft\/logo\?v=/);
    expect(body.palette.length).toBeGreaterThan(0);

    // a design PATCH sent afterwards keeps the logo (merged in SQL), and cannot set logoPath itself
    expect((await draftRoute.PATCH(json('PATCH', '/api/draft', token, { startMonth: '2027-01', design: { orgNameAr: 'شركة' } }))).status).toBe(200);
    expect((await draftRoute.PATCH(json('PATCH', '/api/draft', token, { design: { logoPath: 'a/b.png' } }))).status).toBe(400);

    const [row] = await db.select().from(calendars).where(eq(calendars.draftToken, token!));
    expect(row.design.logoPath).toMatch(new RegExp(`^${row.id}/`));
    expect(row.design.orgNameAr).toBe('شركة');

    const own = await logoRoute.GET(new Request(`http://x${body.logoUrl}`, { headers: cookie(token) }));
    expect(own.status).toBe(200);
    expect(own.headers.get('content-type')).toBe('image/png');
    expect((await logoRoute.GET(new Request(`http://x${body.logoUrl}`))).status).toBe(404);
    expect((await logoRoute.GET(new Request(`http://x/api/draft/logo?calendarId=${row.id}&secret=nope`))).status).toBe(404);
    expect(
      (await logoRoute.GET(new Request(`http://x/api/draft/logo?calendarId=${row.id}&secret=test-render-secret`))).status,
    ).toBe(200);

    // multi-day occasion + a custom one
    const [multi] = await db
      .select()
      .from(events)
      .where(and(eq(events.active, true), gt(events.durationDays, 1), eq(events.recurrence, 'hijri_fixed')))
      .limit(1);
    await eventsRoute.POST(json('POST', '/api/draft/events', token, { eventIds: [multi.id] }));
    await eventsRoute.POST(
      json('POST', '/api/draft/events', token, { custom: { titleAr: 'ذكرى التأسيس', titleEn: 'Founding day', date: '2027-05-10' } }),
    );

    const snap = await buildSnapshot(row.id);
    expect(snap.logoDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(snap.startMonth).toBe('2027-01-01');
    expect(snap.months).toHaveLength(12);
    expect(snap.months.map((m) => `${m.year}-${m.month0}`)[0]).toBe('2027-0');
    for (const m of snap.months) {
      expect(m.weeks.length).toBeGreaterThanOrEqual(4);
      for (const w of m.weeks) expect(w).toHaveLength(7);
    }
    const may = snap.months[4];
    expect(may.events['2027-05-10'][0]).toMatchObject({ titleAr: 'ذكرى التأسيس', titleEn: 'Founding day', kind: 'custom' });

    const days = snap.months.flatMap((m) => Object.entries(m.events)).filter(([, evs]) => evs.some((e) => e.eventId === multi.id));
    expect(days.length).toBeGreaterThanOrEqual(multi.durationDays);
    const ev = days[0][1].find((e) => e.eventId === multi.id)!;
    expect(ev.titleAr).toBe(multi.titleAr);
    expect(ev.titleEn).toBe(multi.titleEn);
    expect(ev.status).toBe('estimated');

    // a replaced logo deletes the old file; DELETE clears it
    const second = await upload(token, await png());
    expect(second.res.status).toBe(200);
    const [after] = await db.select().from(calendars).where(eq(calendars.id, row.id));
    expect(after.design.logoPath).not.toBe(row.design.logoPath);
    const { readLogo } = await import('@/lib/logo');
    expect(await readLogo(row.design.logoPath)).toBeNull();
    expect((await logoRoute.DELETE(new Request('http://x/api/draft/logo', { method: 'DELETE', headers: cookie(token) }))).status).toBe(200);
    expect((await buildSnapshot(row.id)).logoDataUrl).toBeNull();
  });

  it('rejects a renamed text file and an oversized upload', async () => {
    const bad = await upload(undefined, Buffer.from('not an image at all'), 'x.png');
    expect(bad.res.status).toBe(400);
    expect((await bad.res.json()).error).toBe('BAD_TYPE');
    const big = await upload(bad.token, Buffer.alloc(6 * 1024 * 1024, 1), 'big.png');
    expect(big.res.status).toBe(413);
  });
});
