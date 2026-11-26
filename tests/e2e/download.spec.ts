/**
 * Email-gated download, end to end: studio dialog → memory outbox → download page → worker-rendered
 * PDF. The dev server runs with EMAIL_TRANSPORT=memory (playwright.config webServer env); the worker
 * is spawned here as its own process, exactly like `npm run worker`.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

const EMAIL = 'test@example.com';
const ORG = 'شركة الاختبار للتقنية';
const SCREENSHOTS = process.env.TASK11_SCREENSHOTS; // optional folder for review screenshots

let worker: ChildProcess | undefined;
let workerLog = '';
const draftTokens: string[] = [];
let sql: ReturnType<typeof postgres>;

test.beforeAll(async ({}, info) => {
  sql = postgres(process.env.DATABASE_URL!);
  // Earlier runs: clear this address so rate limits and reuse never interfere.
  await sql`delete from leads where email = ${EMAIL}`;
  const baseURL = info.project.use.baseURL!;
  worker = spawn(process.execPath, ['--import', 'tsx', 'worker/index.ts'], {
    env: { ...process.env, APP_URL: baseURL },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  worker.stdout!.on('data', (d) => (workerLog += d));
  worker.stderr!.on('data', (d) => (workerLog += d));
  await expect.poll(() => workerLog, { timeout: 60_000, message: 'worker did not start' }).toContain('listening for');
});

test.afterAll(async () => {
  if (worker && worker.exitCode === null) {
    const exited = new Promise((done) => worker!.once('exit', done));
    worker.kill('SIGTERM');
    await exited;
  }
  const rows = await sql<{ id: string }[]>`
    delete from downloads where lead_id in (select id from leads where email = ${EMAIL}) returning id`;
  const files = path.resolve(process.env.FILES_DIR || './var/files');
  for (const { id } of rows) rmSync(path.join(files, id), { recursive: true, force: true });
  await sql`delete from leads where email = ${EMAIL}`;
  if (draftTokens.length) await sql`delete from calendars where draft_token = any(${draftTokens})`;
  await sql.end();
});

async function buildDraft(page: Page) {
  expect((await page.request.patch('/api/draft', { data: { startMonth: '2027-01', design: { orgNameAr: ORG } } })).ok()).toBeTruthy();
  const recs = await page.request.post('/api/recommendations', {
    data: { selections: { sector: 'private', fields: [], audiences: [], uses: [] }, startMonth: '2027-01-01' },
  });
  const { items } = (await recs.json()) as { items: { eventId: string }[] };
  const eventIds = items.slice(0, 6).map((i) => i.eventId);
  expect((await page.request.post('/api/draft/events', { data: { eventIds } })).ok()).toBeTruthy();
  for (const c of await page.context().cookies()) if (c.name === 'rz_draft') draftTokens.push(c.value);
}

test('download A4: dialog → email link → ready page → PDF', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await buildDraft(page);
  await page.goto('/studio');

  await page.getByTestId('download').click();
  const dialog = page.getByTestId('download-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('role', 'dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');

  // defaults: A4 on, A3 and bleed off; org prefilled; exact notice linking /privacy
  await expect(page.getByTestId('format-A4')).toBeChecked();
  await expect(page.getByTestId('format-A3')).not.toBeChecked();
  await expect(page.getByTestId('format-bleed')).not.toBeChecked();
  await expect(page.getByTestId('dl-org')).toHaveValue(ORG);
  await expect(page.getByTestId('download-notice')).toHaveText('بإرسالك توافق على سياسة الخصوصية، وقد تتواصل معك ويفز بخصوص خدماتها');
  await expect(page.getByTestId('download-notice').getByRole('link')).toHaveAttribute('href', '/privacy');
  await expect(dialog.locator('input[type="checkbox"]')).toHaveCount(3); // no consent checkbox

  // inline validation
  await page.getByTestId('dl-phone').fill('12345');
  await page.getByTestId('download-submit').click();
  await expect(dialog.getByTestId(/-email-error$/)).toBeVisible();
  await expect(dialog.getByTestId(/-phone-error$/)).toBeVisible();
  await page.getByTestId('dl-phone').fill('0512345678');
  await page.getByTestId('dl-email').fill(EMAIL);
  await page.getByTestId('dl-sector').selectOption('private');
  await expect(dialog.getByTestId(/-error$/)).toHaveCount(0);
  if (SCREENSHOTS) await dialog.screenshot({ path: path.join(SCREENSHOTS, 'task-11-dialog.png') });

  await page.getByTestId('download-submit').click();
  await expect(page.getByTestId('download-success')).toContainText('أرسلنا رابط التحميل إلى بريدك');
  await expect(page.getByTestId('download-success-email')).toHaveText(EMAIL);

  // exactly one email, with the link
  const outbox = await (await page.request.get(`/api/test/outbox?to=${encodeURIComponent(EMAIL)}`)).json();
  expect(outbox.messages).toHaveLength(1);
  const msg = outbox.messages[0];
  expect(msg.to).toEqual([EMAIL]);
  expect(msg.subject).toBe(`تقويم ${ORG} جاهز للتحميل`);
  expect(msg.html).toContain('dir="rtl"');
  expect(msg.html).toContain('/brand/waves.png');
  expect(msg.text).toContain('7');
  const link = /https?:\/\/[^\s"<]+\/download\/[A-Za-z0-9_-]{43}/.exec(msg.text)![0];

  // a repeat submit within 2 minutes reuses the download and sends no second email
  const again = await page.request.post('/api/downloads', {
    data: { email: EMAIL, orgName: ORG, sector: 'private', formats: [{ kind: 'wall', size: 'A4', bleed: false }] },
  });
  expect(again.ok()).toBeTruthy();
  expect((await (await page.request.get(`/api/test/outbox?to=${encodeURIComponent(EMAIL)}`)).json()).messages).toHaveLength(1);

  // the link opens the download page; within 60 s the worker has rendered the file
  await page.goto(new URL(link).pathname);
  await expect(page.getByTestId('download-page')).toBeVisible();
  const file = page.getByTestId('file-roznamah-wall-A4.pdf');
  await expect(file, workerLog).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('download-page')).toHaveAttribute('data-state', 'ready');
  if (SCREENSHOTS) await page.screenshot({ path: path.join(SCREENSHOTS, 'task-11-ready.png'), fullPage: true });

  const [download] = await Promise.all([page.waitForEvent('download'), file.click()]);
  expect(download.suggestedFilename()).toBe('roznamah-wall-A4.pdf');
  const res = await page.request.get((await file.getAttribute('href'))!);
  expect(res.headers()['content-disposition']).toBe('attachment; filename="roznamah-wall-A4.pdf"');
  const pdf = await res.body();
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(50 * 1024);
});

test('an unknown download link shows the request-again state', async ({ page }) => {
  await page.goto('/download/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  await expect(page.getByTestId('download-page')).toHaveAttribute('data-state', 'notFound');
  await expect(page.getByTestId('download-again')).toHaveAttribute('href', '/studio?download=1');
});
