/**
 * The whole customer journey, as a visitor does it: landing → recommendations → add all high matches →
 * calendar (White Friday in November) → studio (name, logo, official template) → download A4 →
 * emailed link (memory outbox) → file listed. Arabic on a phone, then English on a laptop.
 * Every page: no horizontal scroll and no console errors.
 *
 * Set JOURNEY_SCREENSHOTS=<dir> to save final-<width>-<screen>.png of the key screens.
 */
import { rmSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

const SHOTS = process.env.JOURNEY_SCREENSHOTS;
const LOGO = path.join(__dirname, '../fixtures/logo.png');
// Default span: January of next year → December; White Friday has a confirmed 2027 date.
const YEAR = new Date().getUTCFullYear() + 1;

type Run = {
  lang: 'ar' | 'en';
  width: number;
  height: number;
  email: string;
  org: string;
  whiteFriday: string;
  pages: RegExp;
};

const RUNS: Run[] = [
  { lang: 'ar', width: 390, height: 844, email: 'journey-ar@example.com', org: 'متاجر الرحلة 2027', whiteFriday: 'الجمعة البيضاء', pages: /13 صفحة/ },
  { lang: 'en', width: 1366, height: 900, email: 'journey-en@example.com', org: 'Journey Stores', whiteFriday: 'White Friday', pages: /13 pages/ },
];

let sql: ReturnType<typeof postgres>;
const draftTokens: string[] = [];
const emails = RUNS.map((r) => r.email);

test.beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!);
  await sql`delete from leads where email = any(${emails})`; // earlier runs: no rate limit or reuse
});

test.afterAll(async () => {
  const downloads = await sql<{ id: string }[]>`
    delete from downloads where lead_id in (select id from leads where email = any(${emails})) returning id`;
  const files = path.resolve(process.env.FILES_DIR || './var/files');
  for (const { id } of downloads) rmSync(path.join(files, id), { recursive: true, force: true });
  await sql`delete from leads where email = any(${emails})`;
  if (draftTokens.length) {
    const calendars = await sql<{ id: string }[]>`delete from calendars where draft_token = any(${draftTokens}) returning id`;
    const uploads = path.resolve(process.env.UPLOAD_DIR || './var/uploads');
    for (const { id } of calendars) rmSync(path.join(uploads, id), { recursive: true, force: true });
  }
  await sql.end();
});

async function noHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `horizontal scroll on ${where}`).toBeLessThanOrEqual(0);
}

async function shot(page: Page, run: Run, name: string, fullPage = true) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `final-${run.width}-${name}.png`), fullPage });
}

/** Header nav on desktop, bottom nav on phones. */
const nav = (page: Page, run: Run, id: 'home' | 'calendar' | 'studio') =>
  page.getByTestId(run.width < 768 ? `bottom-nav-${id}` : `nav-${id}`);

for (const run of RUNS) {
  test(`journey in ${run.lang === 'ar' ? 'Arabic' : 'English'} at ${run.width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`${page.url()}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => consoleErrors.push(`${page.url()}: ${err.message}`));
    await page.setViewportSize({ width: run.width, height: run.height });

    // ---- landing ----
    await page.goto('/');
    if (run.lang === 'en') {
      await page.getByTestId('lang-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    }
    await expect(page.locator('html')).toHaveAttribute('dir', run.lang === 'ar' ? 'rtl' : 'ltr');
    await noHorizontalScroll(page, 'landing');

    await page.getByTestId('sector-private').click();
    await page.getByTestId('chip-retail').click();
    await page.getByTestId('chip-marketing').click();
    await expect(page.getByTestId('start-month')).toHaveValue(`${YEAR}-01-01`);
    const recsResponse = page.waitForResponse((r) => r.url().endsWith('/api/recommendations') && r.ok());
    await page.getByTestId('recommend-btn').click();
    const { items } = (await (await recsResponse).json()) as { items: { band: string; titleEn: string }[] };
    const high = items.filter((i) => i.band === 'high');
    expect(high.map((i) => i.titleEn)).toContain('White Friday');
    const cards = page.getByTestId('rec-card');
    await expect(cards.first()).toBeVisible();
    const whiteFridayCard = cards.filter({ hasText: run.whiteFriday });
    await expect(whiteFridayCard).toHaveCount(1);

    await page.getByTestId('add-high').click();
    await expect(page.getByTestId('plan-count')).toHaveText(String(high.length));
    await expect(page.getByTestId('add-high')).toBeDisabled();
    const added = high.length;
    await expect(whiteFridayCard.getByTestId('rec-toggle')).toHaveAttribute('aria-pressed', 'true');
    for (const c of await page.context().cookies()) if (c.name === 'rz_draft') draftTokens.push(c.value);
    await noHorizontalScroll(page, 'landing with results');
    await page.getByTestId('results').scrollIntoViewIfNeeded();
    await shot(page, run, 'landing', false);

    // ---- calendar: White Friday in November ----
    await page.getByTestId('plan-bar-link').click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(page.getByTestId('calendar-count')).toHaveText(String(added));
    await page.getByTestId(`strip-${YEAR}-11`).click();
    const novemberPills = page.locator(`[data-testid^="day-${YEAR}-11-"]`).getByTestId('pill');
    await expect(novemberPills.filter({ hasText: run.whiteFriday })).toHaveCount(1);
    await noHorizontalScroll(page, 'calendar');
    await shot(page, run, 'calendar');

    // ---- studio: name, logo, official template ----
    await nav(page, run, 'studio').click();
    await expect(page).toHaveURL(/\/studio$/);
    await page.getByTestId(run.lang === 'ar' ? 'org-name-ar' : 'org-name-en').fill(run.org);
    await expect(page.getByTestId('preview').locator('[data-page="cover"]')).toContainText(run.org);
    await page.getByTestId('logo-input').setInputFiles(LOGO);
    await expect(page.getByTestId('preview').locator('[data-page="cover"] img[data-logo]')).toBeVisible();
    await page.getByTestId('template-official').click();
    await expect(page.getByTestId('template-official')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('preview').locator('[data-template]')).toHaveAttribute('data-template', 'official');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
    await noHorizontalScroll(page, 'studio');
    await shot(page, run, 'studio');

    // ---- download A4 ----
    await page.getByTestId('download').click();
    await expect(page.getByTestId('download-dialog')).toBeVisible();
    await expect(page.getByTestId('format-A4')).toBeChecked();
    await expect(page.getByTestId('dl-org')).toHaveValue(run.org);
    await expect(page.getByTestId('dl-sector')).toHaveValue('private');
    await page.getByTestId('dl-email').fill(run.email);
    await noHorizontalScroll(page, 'download dialog');
    await page.getByTestId('download-submit').click();
    await expect(page.getByTestId('download-success-email')).toHaveText(run.email);

    // ---- the emailed link ----
    const outbox = await (await page.request.get(`/api/test/outbox?to=${encodeURIComponent(run.email)}`)).json();
    expect(outbox.messages).toHaveLength(1);
    const link = /https?:\/\/[^\s"<]+\/download\/[A-Za-z0-9_-]{43}/.exec(outbox.messages[0].text)![0];
    await page.goto(link);
    await expect(page.getByTestId('download-page')).toBeVisible();
    const file = page.getByTestId('file-roznamah-wall-A4.pdf');
    await expect(file).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId('download-page')).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('file-details')).toHaveText(run.pages);
    await noHorizontalScroll(page, 'download page');
    await shot(page, run, 'download');

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });
}
