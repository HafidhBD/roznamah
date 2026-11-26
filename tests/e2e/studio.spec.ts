import { rmSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';

const tokens: string[] = [];
async function remember(ctx: BrowserContext) {
  for (const c of await ctx.cookies()) if (c.name === 'rz_draft') tokens.push(c.value);
}

test.afterAll(async () => {
  if (!tokens.length || !process.env.DATABASE_URL) return;
  const sql = postgres(process.env.DATABASE_URL);
  const rows = await sql<{ id: string }[]>`delete from calendars where draft_token = any(${tokens}) returning id`;
  // uploaded logos live on disk, not in the DB
  const uploads = path.resolve(process.env.UPLOAD_DIR || './var/uploads');
  for (const { id } of rows) rmSync(path.join(uploads, id), { recursive: true, force: true });
  await sql.end();
});

const START = '2027-01-01';
const NATIONAL = 'اليوم الوطني';
const LOGO = path.join(__dirname, '../fixtures/logo.png');

async function seed(page: Page, titles: string[]) {
  const patch = await page.request.patch('/api/draft', { data: { startMonth: START } });
  expect(patch.ok()).toBeTruthy();
  if (titles.length) {
    const recs = await page.request.post('/api/recommendations', {
      data: { selections: { sector: null, fields: [], audiences: [], uses: [] }, startMonth: START },
    });
    const { items } = (await recs.json()) as { items: { eventId: string; titleAr: string }[] };
    const eventIds = titles.map((t) => items.find((i) => i.titleAr === t)!.eventId);
    expect((await page.request.post('/api/draft/events', { data: { eventIds } })).ok()).toBeTruthy();
  }
  await remember(page.context());
}

const preview = (page: Page) => page.getByTestId('preview');
const savedState = (page: Page) => expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');

/** Goes to the preview page with the given index (0 = cover, 1..12 = months). */
async function goToPage(page: Page, index: number) {
  const indicator = page.getByTestId('preview-index');
  for (let i = 0; i < 14; i++) {
    const current = Number(await indicator.getAttribute('data-index'));
    if (current === index) return;
    await page.getByTestId(current < index ? 'preview-next' : 'preview-prev').click();
  }
  throw new Error(`could not reach page ${index}`);
}

test('studio: identity settings drive the live preview and persist', async ({ page }) => {
  test.setTimeout(90_000);
  await seed(page, [NATIONAL]);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/studio');

  // org name → cover
  await page.getByTestId('org-name-ar').fill('شركة الاختبار');
  await expect(preview(page).locator('[data-page="cover"]')).toContainText('شركة الاختبار');

  // logo upload → preview img + palette swatches
  await page.getByTestId('logo-input').setInputFiles(LOGO);
  await expect(preview(page).locator('[data-page="cover"] img[data-logo]')).toBeVisible();
  await expect(page.getByTestId('palette-swatch').first()).toBeVisible();
  const swatch = page.getByTestId('palette-swatch').first();
  const swatchColor = await swatch.getAttribute('data-color');
  await swatch.click();
  await expect(page.getByTestId('primary-input')).toHaveValue(swatchColor!);

  // official template
  await page.getByTestId('template-official').click();
  await expect(preview(page).locator('[data-template]')).toHaveAttribute('data-template', 'official');

  // occasions render in the month page
  await goToPage(page, 9);
  await expect(preview(page).locator('[data-page="month"]')).toContainText(NATIONAL);
  await expect(preview(page).locator('.hijri').first()).toBeVisible();

  // Hijri off → no .hijri in the month cells
  await page.getByTestId('toggle-hijri').uncheck();
  await expect(preview(page).locator('[data-page="month"] .hijri')).toHaveCount(0);

  // Waves stamp on every page
  for (let i = 0; i <= 12; i++) {
    await goToPage(page, i);
    await expect(preview(page).locator('[data-waves-stamp]')).toBeVisible();
  }

  await savedState(page);
  await page.reload();

  await expect(page.getByTestId('org-name-ar')).toHaveValue('شركة الاختبار');
  await expect(page.getByTestId('template-official')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('toggle-hijri')).not.toBeChecked();
  await expect(page.getByTestId('primary-input')).toHaveValue(swatchColor!);
  await expect(page.getByTestId('palette-swatch').first()).toBeVisible();
  await expect(preview(page).locator('[data-template]')).toHaveAttribute('data-template', 'official');
  await expect(preview(page).locator('[data-page="cover"]')).toContainText('شركة الاختبار');
  await expect(preview(page).locator('[data-page="cover"] img[data-logo]')).toBeVisible();
  await goToPage(page, 9);
  await expect(preview(page).locator('[data-page="month"] .hijri')).toHaveCount(0);
});

test('logo endpoint: rejects a fake image, serves only the owner', async ({ page, browser }) => {
  await seed(page, []);
  const fake = await page.request.post('/api/draft/logo', {
    multipart: { file: { name: 'evil.png', mimeType: 'image/png', buffer: Buffer.from('MZ not an image at all') } },
  });
  expect(fake.status()).toBe(400);
  expect((await fake.json()).error).toBe('BAD_TYPE');

  const ok = await page.request.post('/api/draft/logo', {
    multipart: { file: { name: 'logo.png', mimeType: 'image/png', buffer: require('node:fs').readFileSync(LOGO) } },
  });
  expect(ok.ok()).toBeTruthy();
  const body = await ok.json();
  expect(body.palette.length).toBeGreaterThan(0);
  const own = await page.request.get(body.logoUrl);
  expect(own.status()).toBe(200);
  expect(own.headers()['content-type']).toMatch(/image\/(png|webp)/);

  // a different visitor (no cookie) gets nothing
  const other = await browser.newContext();
  const res = await other.request.get(`http://localhost:3000${body.logoUrl}`);
  expect(res.status()).toBe(404);
  await remember(other);
  await other.close();

  // the logo path cannot be written through the design PATCH
  const patch = await page.request.patch('/api/draft', { data: { design: { logoPath: 'x/y.png' } } });
  expect(patch.status()).toBe(400);
});

test('studio has no horizontal overflow at 390px', async ({ page }) => {
  await seed(page, []);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/studio');
  await expect(preview(page).locator('[data-waves-stamp]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
