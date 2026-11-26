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
  const patch = await page.request.patch('/api/draft', {
    data: { startMonth: START },
  });
  expect(patch.ok()).toBeTruthy();
  if (titles.length) {
    const recs = await page.request.post('/api/recommendations', {
      data: {
        selections: { sector: null, fields: [], audiences: [], uses: [] },
        startMonth: START,
      },
    });
    const { items } = (await recs.json()) as {
      items: { eventId: string; titleAr: string }[];
    };
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

test('logo endpoint: rejects a fake image, serves only the owner', async ({ page, browser, baseURL }) => {
  await seed(page, []);
  const fake = await page.request.post('/api/draft/logo', {
    multipart: {
      file: {
        name: 'evil.png',
        mimeType: 'image/png',
        buffer: Buffer.from('MZ not an image at all'),
      },
    },
  });
  expect(fake.status()).toBe(400);
  expect((await fake.json()).error).toBe('BAD_TYPE');

  const ok = await page.request.post('/api/draft/logo', {
    multipart: {
      file: {
        name: 'logo.png',
        mimeType: 'image/png',
        buffer: require('node:fs').readFileSync(LOGO),
      },
    },
  });
  expect(ok.ok()).toBeTruthy();
  const body = await ok.json();
  expect(body.palette.length).toBeGreaterThan(0);
  const own = await page.request.get(body.logoUrl);
  expect(own.status()).toBe(200);
  expect(own.headers()['content-type']).toMatch(/image\/(png|webp)/);

  // a different visitor (no cookie) gets nothing
  const other = await browser.newContext();
  const res = await other.request.get(`${baseURL}${body.logoUrl}`);
  expect(res.status()).toBe(404);
  await remember(other);
  await other.close();

  // the logo path cannot be written through the design PATCH
  const patch = await page.request.patch('/api/draft', {
    data: { design: { logoPath: 'x/y.png' } },
  });
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

const LONG_AR = 'مؤسسة '.repeat(20).slice(0, 120);
const LONG_EN = 'Organization '.repeat(10).slice(0, 120);

/** Every label in a day cell is whole (not cut by the cell) and the «+N» line lies inside the cell. */
async function cellsAreWhole(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    let more = 0;
    for (const cell of document.querySelectorAll<HTMLElement>(
      '[data-testid="preview"] [data-page="month"] [data-date]',
    )) {
      const box = cell.getBoundingClientRect();
      const list = cell.querySelector('.rz-cell-events');
      if (list) {
        const lb = list.getBoundingClientRect();
        for (const ev of list.querySelectorAll('.rz-ev')) {
          if (ev.getBoundingClientRect().bottom > lb.bottom + 0.5) problems.push(`cut label in ${cell.dataset.date}`);
        }
      }
      const m = cell.querySelector('.rz-more');
      if (m) {
        more++;
        const r = m.getBoundingClientRect();
        if (r.top < box.top || r.bottom > box.bottom + 0.5) problems.push(`+N outside ${cell.dataset.date}`);
      }
    }
    for (const sel of ['.rzm-org', '.rzo-org']) {
      const el = document.querySelector<HTMLElement>(`[data-testid="preview"] ${sel}`);
      const area = el?.closest('.rzm-band, .rzo-head');
      if (el && area && el.getBoundingClientRect().bottom > area.getBoundingClientRect().bottom + 0.5)
        problems.push(`${sel} spills`);
    }
    return { problems, more };
  });
}

test.describe('dense pages', () => {
  test.use({ deviceScaleFactor: 2 });
  test('dense bilingual month: cells never cut an occasion or the +N line', async ({ page }) => {
    test.setTimeout(60_000);
    await seed(page, []);
    const design = {
      language: 'bi',
      showDescriptions: true,
      notesArea: true,
      orgNameAr: LONG_AR,
      orgNameEn: LONG_EN,
    };
    expect((await page.request.patch('/api/draft', { data: { design } })).ok()).toBeTruthy();
    const sql = postgres(process.env.DATABASE_URL!);
    const june = await sql<
      { id: string }[]
    >`select id from events where active and recurrence = 'gregorian_fixed' and g_month = 6`;
    await sql.end();
    expect(june.length).toBeGreaterThanOrEqual(8);
    expect(
      (
        await page.request.post('/api/draft/events', {
          data: { eventIds: june.map((r) => r.id) },
        })
      ).ok(),
    ).toBeTruthy();
    for (let i = 1; i <= 5; i++) {
      const custom = {
        titleAr: `اجتماع مجلس الإدارة رقم ${i}`,
        titleEn: `Board meeting number ${i}`,
        date: '2027-06-10',
      };
      expect((await page.request.post('/api/draft/events', { data: { custom } })).ok()).toBeTruthy();
    }

    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/studio');
    await goToPage(page, 6);
    await expect(preview(page).locator('[data-date="2027-06-10"] .rz-more')).toBeVisible();
    for (const template of ['modern', 'official'] as const) {
      await page.getByTestId(`template-${template}`).click();
      await expect(preview(page).locator('[data-template]')).toHaveAttribute('data-template', template);
      const { problems, more } = await cellsAreWhole(page);
      expect(problems).toEqual([]);
      expect(more).toBeGreaterThan(0);
      if (process.env.SHOT_DIR) {
        await preview(page).screenshot({
          path: path.join(process.env.SHOT_DIR, `task-9-dense-bi-${template}.png`),
        });
      }
    }
    // taller cells (no descriptions list, no notes area) show more labels, still whole
    for (const toggle of ['toggle-descriptions', 'toggle-notes']) {
      await page.getByTestId(toggle).uncheck();
      for (const template of ['modern', 'official'] as const) {
        await page.getByTestId(`template-${template}`).click();
        expect((await cellsAreWhole(page)).problems).toEqual([]);
      }
    }
    await savedState(page);
  });
});
