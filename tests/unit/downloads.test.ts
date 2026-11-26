import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, sql } from '@/db/client';
import { calendars, downloads, leads } from '@/db/schema';

const filesDir = mkdtempSync(path.join(tmpdir(), 'rz-files-'));
process.env.FILES_DIR = filesDir;
process.env.APP_URL = 'http://app.test';

const enqueued: unknown[] = [];
const sent: { to: string; link: string }[] = [];
vi.mock('@/lib/queue', () => ({
  RENDER_JOB: 'render-download',
  enqueueRender: vi.fn(async (downloadId: string) => {
    enqueued.push(downloadId);
  }),
}));
vi.mock('@/lib/email', () => ({
  sendDownloadEmail: vi.fn(async (to: string, _lang: string, link: string) => {
    sent.push({ to, link });
  }),
  notifyNewLead: vi.fn(async () => {}),
}));

const renderMode = { fail: false };
vi.mock('@/lib/render/pdf', () => ({
  renderPdf: vi.fn(async (_id: string, _format: unknown, outPath: string) => {
    if (renderMode.fail) throw new Error('chromium crashed');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(outPath, '%PDF-1.7 fake');
    return { pages: 13, bytes: 13 };
  }),
}));

let lib: typeof import('@/lib/downloads');
let job: typeof import('@/lib/render/job');
let draftRoute: typeof import('@/app/api/draft/route');
let createRoute: typeof import('@/app/api/downloads/route');
let statusRoute: typeof import('@/app/api/downloads/[token]/route');
let filesRoute: typeof import('@/app/api/files/[token]/[name]/route');

const tokens: string[] = [];
const emails: string[] = [];
beforeAll(async () => {
  lib = await import('@/lib/downloads');
  job = await import('@/lib/render/job');
  draftRoute = await import('@/app/api/draft/route');
  createRoute = await import('@/app/api/downloads/route');
  statusRoute = await import('@/app/api/downloads/[token]/route');
  filesRoute = await import('@/app/api/files/[token]/[name]/route');
});
beforeEach(() => {
  enqueued.length = 0;
  sent.length = 0;
});
afterAll(async () => {
  if (emails.length) await db.delete(leads).where(inArray(leads.email, emails));
  if (tokens.length) await db.delete(calendars).where(inArray(calendars.draftToken, tokens));
  await sql.end();
  rmSync(filesDir, { recursive: true, force: true });
});

const uniqueEmail = (tag: string) => {
  const e = `t11-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  emails.push(e);
  return e;
};

const A4 = { kind: 'wall', size: 'A4', bleed: false } as const;

/** A real draft calendar made through the draft API (cookie token remembered for cleanup). */
async function newDraft(design: Record<string, unknown> = { orgNameAr: 'شركة الاختبار' }) {
  const res = await draftRoute.PATCH(
    new Request('http://x/api/draft', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ startMonth: '2027-01', design }),
    }),
  );
  const token = res.cookies.get('rz_draft')!.value;
  tokens.push(token);
  const [row] = await db.select().from(calendars).where(eq(calendars.draftToken, token));
  return { token, calendarId: row.id };
}

const input = (calendarId: string, email: string, ip = '10.0.0.1') => ({
  calendarId,
  email,
  orgName: 'شركة الاختبار',
  sector: 'private',
  fields: ['technology'],
  formats: [A4],
  ip,
});

const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

describe('createDownload', () => {
  it('reuses a download for the same calendar and email within 2 minutes (one job, one email)', async () => {
    const { calendarId } = await newDraft();
    const email = uniqueEmail('reuse');
    const a = await lib.createDownload(input(calendarId, email));
    const b = await lib.createDownload(input(calendarId, email.toUpperCase()));
    expect(a.reused).toBe(false);
    expect(b).toEqual({ token: a.token, reused: true });
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes base64url
    expect(enqueued).toHaveLength(1);
    expect(sent).toEqual([{ to: email, link: `http://app.test/download/${a.token}` }]);

    const [row] = await db.select().from(downloads).where(eq(downloads.token, a.token));
    const days = (row.expiresAt.getTime() - row.createdAt.getTime()) / 86_400_000;
    expect(days).toBeCloseTo(7, 2);
    expect(row.status).toBe('queued');
    expect(row.formats).toEqual([A4]);
  });

  it('concurrent double-submits still create a single download', async () => {
    const { calendarId } = await newDraft();
    const email = uniqueEmail('race');
    const [a, b] = await Promise.all([
      lib.createDownload(input(calendarId, email)),
      lib.createDownload(input(calendarId, email)),
    ]);
    expect(a.token).toBe(b.token);
    expect(enqueued).toHaveLength(1);
  });

  it('does not reuse a failed download', async () => {
    const { calendarId } = await newDraft();
    const email = uniqueEmail('failed');
    const a = await lib.createDownload(input(calendarId, email));
    await db.update(downloads).set({ status: 'failed' }).where(eq(downloads.token, a.token));
    const b = await lib.createDownload(input(calendarId, email));
    expect(b.reused).toBe(false);
    expect(b.token).not.toBe(a.token);
  });

  it('throws RateLimitError on the 6th request in an hour for one email', async () => {
    const email = uniqueEmail('rate');
    for (let i = 0; i < 5; i++) {
      const { calendarId } = await newDraft(); // different calendars: no reuse
      await lib.createDownload(input(calendarId, email, `10.1.0.${i}`));
    }
    const { calendarId } = await newDraft();
    await expect(lib.createDownload(input(calendarId, email, '10.1.0.9'))).rejects.toBeInstanceOf(lib.RateLimitError);
    expect(enqueued).toHaveLength(5);
  });

  it('throws RateLimitError past 20 requests an hour from one IP', async () => {
    const ip = `10.2.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
    const { calendarId } = await newDraft();
    const [{ id: leadId }] = await db
      .insert(leads)
      .values(Array.from({ length: 20 }, (_, i) => ({ email: uniqueEmail(`ip${i}`), orgName: 'x', ip })))
      .returning({ id: leads.id });
    expect(leadId).toBeTruthy();
    await expect(lib.createDownload(input(calendarId, uniqueEmail('ip-over'), ip))).rejects.toBeInstanceOf(lib.RateLimitError);
  });

  it('freezes the snapshot: later design changes do not alter downloads.snapshot', async () => {
    const { token: draftToken, calendarId } = await newDraft({ orgNameAr: 'الاسم الأول' });
    const { token } = await lib.createDownload(input(calendarId, uniqueEmail('frozen')));
    await draftRoute.PATCH(
      new Request('http://x/api/draft', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: `rz_draft=${draftToken}` },
        body: JSON.stringify({ design: { orgNameAr: 'الاسم الثاني' } }),
      }),
    );
    const [row] = await db.select().from(downloads).where(eq(downloads.token, token));
    expect(row.snapshot.design.orgNameAr).toBe('الاسم الأول');
    const [cal] = await db.select().from(calendars).where(eq(calendars.id, calendarId));
    expect(cal.design.orgNameAr).toBe('الاسم الثاني');
  });
});

describe('status and files routes', () => {
  async function readyDownload(expiresAt: Date) {
    const { calendarId } = await newDraft();
    const { token } = await lib.createDownload(input(calendarId, uniqueEmail('files')));
    const [row] = await db
      .update(downloads)
      .set({ status: 'ready', files: [{ name: 'roznamah-wall-A4.pdf', size: 9 }], expiresAt })
      .where(eq(downloads.token, token))
      .returning();
    mkdirSync(path.join(filesDir, row.id), { recursive: true });
    writeFileSync(path.join(filesDir, row.id, 'roznamah-wall-A4.pdf'), '%PDF-1.7\n');
    return token;
  }

  it('serves a ready file as an attachment and reports status without lead or snapshot data', async () => {
    const token = await readyDownload(new Date(Date.now() + 86_400_000));
    const status = await statusRoute.GET(new Request('http://x'), ctx({ token }));
    expect(status.status).toBe(200);
    const body = await status.json();
    expect(body).toEqual({
      status: 'ready',
      expired: false,
      files: [{ name: 'roznamah-wall-A4.pdf', size: 9, url: `/api/files/${token}/roznamah-wall-A4.pdf` }],
    });
    const file = await filesRoute.GET(new Request('http://x'), ctx({ token, name: 'roznamah-wall-A4.pdf' }));
    expect(file.status).toBe(200);
    expect(file.headers.get('content-disposition')).toBe('attachment; filename="roznamah-wall-A4.pdf"');
    expect(file.headers.get('content-type')).toBe('application/pdf');
    expect(await file.text()).toBe('%PDF-1.7\n');
  });

  it('an expired token gives expired: true and 410 for its files', async () => {
    const token = await readyDownload(new Date(Date.now() - 1000));
    const body = await (await statusRoute.GET(new Request('http://x'), ctx({ token }))).json();
    expect(body.expired).toBe(true);
    expect(body.files).toEqual([]);
    const file = await filesRoute.GET(new Request('http://x'), ctx({ token, name: 'roznamah-wall-A4.pdf' }));
    expect(file.status).toBe(410);
  });

  it('a name outside the files list (path traversal) is 404; an unknown token is 404', async () => {
    const token = await readyDownload(new Date(Date.now() + 86_400_000));
    for (const name of ['../../etc/passwd', '..%2F..%2Fetc%2Fpasswd', 'roznamah-wall-A3.pdf']) {
      expect((await filesRoute.GET(new Request('http://x'), ctx({ token, name }))).status).toBe(404);
    }
    expect((await statusRoute.GET(new Request('http://x'), ctx({ token: 'nope' }))).status).toBe(404);
    expect((await filesRoute.GET(new Request('http://x'), ctx({ token: 'nope', name: 'roznamah-wall-A4.pdf' }))).status).toBe(404);
  });
});

describe('POST /api/downloads', () => {
  const post = (draftToken: string, body: Record<string, unknown>, ip = '10.9.9.9') =>
    createRoute.POST(
      new Request('http://x/api/downloads', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `rz_draft=${draftToken}`, 'x-forwarded-for': `${ip}, 172.16.0.1` },
        body: JSON.stringify(body),
      }),
    );
  const body = (email: string, extra: Record<string, unknown> = {}) => ({
    email,
    orgName: 'شركة الاختبار',
    sector: 'private',
    formats: [A4],
    ...extra,
  });

  it('accepts 0512345678 and +966512345678; rejects 12345 with 400', async () => {
    const { token } = await newDraft();
    const ok = await post(token, body(uniqueEmail('phone1'), { phone: '0512345678' }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
    expect((await post(token, body(uniqueEmail('phone2'), { phone: '+966512345678' }))).status).toBe(200);
    const bad = await post(token, body(uniqueEmail('phone3'), { phone: '12345' }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).fields).toEqual({ phone: 'invalid' });
  });

  it('records the lead with the first forwarded IP and the draft fields; 400 for bad email / no formats', async () => {
    const { token } = await newDraft();
    const email = uniqueEmail('lead');
    expect((await post(token, body(email), '203.0.113.7')).status).toBe(200);
    const [lead] = await db.select().from(leads).where(eq(leads.email, email));
    expect(lead).toMatchObject({ ip: '203.0.113.7', orgName: 'شركة الاختبار', sector: 'private', phone: null });
    expect((await post(token, body('not-an-email'))).status).toBe(400);
    expect((await post(token, body(uniqueEmail('nofmt'), { formats: [] }))).status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    const { token } = await newDraft();
    const email = uniqueEmail('route-rate');
    await db.insert(leads).values(Array.from({ length: 5 }, () => ({ email, orgName: 'x', ip: '1.1.1.1' })));
    const res = await post(token, body(email));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited' });
  });
});

describe('render-download job', () => {
  const browser = {} as import('playwright').Browser;
  const formats = [A4, { kind: 'wall', size: 'A3', bleed: true }] as const;
  async function queued() {
    const { calendarId } = await newDraft();
    const { token } = await lib.createDownload({ ...input(calendarId, uniqueEmail('job')), formats: [...formats] });
    const [row] = await db.select().from(downloads).where(eq(downloads.token, token));
    return row;
  }
  const statusOf = async (id: string) => (await db.select().from(downloads).where(eq(downloads.id, id)))[0];

  it('renders every format to FILES_DIR/<id>/roznamah-wall-<size>[-bleed].pdf and marks ready', async () => {
    renderMode.fail = false;
    const row = await queued();
    await job.processDownload(row.id, browser, { retryCount: 0, retryLimit: 2 });
    const after = await statusOf(row.id);
    expect(after.status).toBe('ready');
    expect(after.files).toEqual([
      { name: 'roznamah-wall-A4.pdf', size: 13 },
      { name: 'roznamah-wall-A3-bleed.pdf', size: 13 },
    ]);
    const { readdirSync } = await import('node:fs');
    expect(readdirSync(path.join(filesDir, row.id)).sort()).toEqual(['roznamah-wall-A3-bleed.pdf', 'roznamah-wall-A4.pdf']);
  });

  it('a failed attempt goes back to queued (so pg-boss retries); the last one marks failed with the error', async () => {
    renderMode.fail = true;
    const row = await queued();
    await expect(job.processDownload(row.id, browser, { retryCount: 0, retryLimit: 2 })).rejects.toThrow('chromium crashed');
    expect(await statusOf(row.id)).toMatchObject({ status: 'queued', error: 'chromium crashed' });
    await expect(job.processDownload(row.id, browser, { retryCount: 2, retryLimit: 2 })).rejects.toThrow();
    expect(await statusOf(row.id)).toMatchObject({ status: 'failed', error: 'chromium crashed' });
    // a failed download is never picked up again
    renderMode.fail = false;
    await job.processDownload(row.id, browser, { retryCount: 0, retryLimit: 2 });
    expect((await statusOf(row.id)).status).toBe('failed');
  });
});
