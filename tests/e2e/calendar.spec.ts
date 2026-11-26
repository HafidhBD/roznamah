import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';

const tokens: string[] = [];
async function remember(ctx: BrowserContext) {
  for (const c of await ctx.cookies()) if (c.name === 'rz_draft') tokens.push(c.value);
}

test.afterAll(async () => {
  if (!tokens.length || !process.env.DATABASE_URL) return;
  const sql = postgres(process.env.DATABASE_URL);
  await sql`delete from calendars where draft_token = any(${tokens})`;
  await sql.end();
});

const NATIONAL = 'اليوم الوطني';
const EID = 'عيد الفطر';
const START = '2027-01-01';

/** Seeds the page's draft through the API (page.request shares the page's cookies). */
async function seed(page: Page, titles: string[], design?: Record<string, unknown>) {
  const patch = await page.request.patch('/api/draft', { data: { startMonth: START, ...(design ? { design } : {}) } });
  expect(patch.ok()).toBeTruthy();
  const recs = await page.request.post('/api/recommendations', {
    data: { selections: { sector: null, fields: [], audiences: [], uses: [] }, startMonth: START },
  });
  const { items } = (await recs.json()) as { items: { eventId: string; titleAr: string }[] };
  const eventIds = titles.map((title) => {
    const hit = items.find((i) => i.titleAr === title);
    expect(hit, `recommendation for ${title}`).toBeTruthy();
    return hit!.eventId;
  });
  if (eventIds.length) {
    const res = await page.request.post('/api/draft/events', { data: { eventIds } });
    expect(res.ok()).toBeTruthy();
  }
  await remember(page.context());
}

test('month view, custom occasion add/remove, list view, back to home', async ({ page }) => {
  await seed(page, [NATIONAL]);
  await page.goto('/');
  await page.getByTestId('nav-calendar').first().click();
  await expect(page).toHaveURL(/\/calendar$/);

  await expect(page.getByTestId('calendar-count')).toHaveText('1');
  await page.getByTestId('strip-2027-09').click();
  await expect(page.getByTestId('month-title')).toContainText('2027');
  await expect(page.getByTestId('day-2027-09-23').getByTestId('pill')).toHaveText(NATIONAL);

  // add a custom occasion on 2027-05-10
  await page.getByTestId('add-custom').click();
  await page.getByTestId('custom-title-ar').fill('ذكرى تأسيس الشركة');
  await page.getByTestId('custom-month').selectOption('2027-05');
  await page.getByTestId('custom-day').selectOption('10');
  // day/month pickers instead of a native date field: Western digits on every device
  const labels = await page.locator('[data-testid="custom-day"] option, [data-testid="custom-month"] option').allTextContents();
  expect(labels.join(' ')).toMatch(/2027/);
  expect(labels.join(' ')).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
  await page.getByTestId('custom-submit').click();
  await expect(page.getByTestId('custom-form')).toBeHidden();
  await expect(page.getByTestId('calendar-count')).toHaveText('2');
  await expect(page.getByTestId('day-2027-05-10').getByTestId('pill')).toHaveText('ذكرى تأسيس الشركة');

  // remove it from the day panel
  await page.getByTestId('day-2027-05-10').click();
  await page.getByTestId('day-remove').click();
  await expect(page.getByTestId('day-none')).toBeVisible();
  await page.getByTestId('modal-close').click();
  await expect(page.getByTestId('day-2027-05-10').getByTestId('pill')).toHaveCount(0);
  await expect(page.getByTestId('calendar-count')).toHaveText('1');

  // list view: months in order, with the occasion in September
  await page.getByTestId('view-list').click();
  const months = page.getByTestId('list-month');
  await expect(months).toHaveCount(1);
  await expect(months.first()).toContainText(NATIONAL);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test('list view orders months; multi-day Eid shows on every day; span edges and recommendations', async ({ page }) => {
  await seed(page, [NATIONAL, EID]);
  await page.goto('/calendar');

  // span edges
  await expect(page.getByTestId('month-prev')).toBeDisabled();
  await page.getByTestId('strip-2027-12').click();
  await expect(page.getByTestId('month-next')).toBeDisabled();

  // Eid al-Fitr 2027 covers several consecutive days (estimated, so dashed)
  await page.getByTestId('strip-2027-03').click();
  const eidDays = page.locator('[data-testid^="day-2027-"]').filter({ has: page.getByTestId('pill').filter({ hasText: EID }) });
  expect(await eidDays.count()).toBeGreaterThanOrEqual(3);
  await expect(page.getByTestId('pill').filter({ hasText: EID }).first()).toHaveAttribute('data-status', 'estimated');

  await page.getByTestId('view-list').click();
  const headings = await page.getByTestId('list-month').locator('h3').allTextContents();
  expect(headings.length).toBe(2);
  const order = await page.getByTestId('list-item').allTextContents();
  expect(order[0]).toContain(EID);
  expect(order[1]).toContain(NATIONAL);

  // day panel: an added occasion is not offered again, others on that day are
  await page.getByTestId('view-month').click();
  await page.getByTestId('strip-2027-09').click();
  await page.getByTestId('day-2027-09-23').click();
  await expect(page.getByTestId('day-item')).toHaveCount(1);
  await expect(page.getByTestId('day-rec').filter({ hasText: NATIONAL })).toHaveCount(0);
});

test('day panel offers a recommended occasion that can be added', async ({ page }) => {
  await seed(page, []);
  await page.goto('/calendar');
  await expect(page.getByTestId('calendar-empty')).toBeVisible();
  // add a custom occasion so the grid appears, then open National Day
  await page.getByTestId('add-custom').click();
  await page.getByTestId('custom-title-ar').fill('اجتماع');
  await page.getByTestId('custom-submit').click();
  await expect(page.getByTestId('calendar-empty')).toBeHidden();

  await page.getByTestId('strip-2027-09').click();
  await page.getByTestId('day-2027-09-23').click();
  const rec = page.getByTestId('day-rec').filter({ hasText: NATIONAL });
  await expect(rec).toHaveCount(1);
  await rec.getByTestId('day-rec-add').click();
  await expect(page.getByTestId('day-item').filter({ hasText: NATIONAL })).toHaveCount(1);
  await expect(page.getByTestId('day-rec').filter({ hasText: NATIONAL })).toHaveCount(0);
});

test('empty state links back to home', async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.getByTestId('calendar-empty')).toBeVisible();
  await page.getByTestId('calendar-empty-cta').click();
  await expect(page).toHaveURL(/\/$/);
});

test('failures are shown to the visitor, and the form validates inline', async ({ page }) => {
  await seed(page, [NATIONAL]);
  await page.goto('/calendar');
  await page.getByTestId('strip-2027-09').click();

  await page.route('**/api/draft/events?id=*', (route) => route.fulfill({ status: 500, body: '{}' }));
  await page.getByTestId('day-2027-09-23').click();
  await page.getByTestId('day-remove').click();
  await expect(page.getByTestId('day-error')).toBeVisible();
  await expect(page.getByTestId('calendar-error')).toBeVisible();
  await expect(page.getByTestId('day-item')).toHaveCount(1);
  await page.unroute('**/api/draft/events?id=*');
  await page.getByTestId('modal-close').click();

  await page.getByTestId('add-custom').click();
  await page.getByTestId('custom-submit').click();
  await expect(page.getByTestId('custom-error-titleAr')).toBeVisible();
  await page.getByTestId('custom-title-ar').fill('x');
  // only the span's 12 months can be picked
  await expect(page.getByTestId('custom-month').locator('option')).toHaveCount(12);

  // a server-side rejection (date outside the span) surfaces inline too
  await page.route('**/api/draft/events', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"date_outside_span"}' })
      : route.continue(),
  );
  await page.getByTestId('custom-month').selectOption('2027-02');
  await page.getByTestId('custom-day').selectOption('2');
  await page.getByTestId('custom-submit').click();
  await expect(page.getByTestId('custom-error-date')).toHaveText('التاريخ خارج فترة التقويم الممتدة 12 شهرًا.');
});

test('weekStart follows the draft design (Monday first)', async ({ page }) => {
  await seed(page, [NATIONAL], { weekStart: 1 });
  await page.goto('/calendar');
  await page.getByTestId('strip-2027-09').click();
  // 2027-09-01 is a Wednesday: 2 leading blanks when the week starts Monday
  const cells = page.getByTestId('month-grid').locator('> div').nth(1).locator('> *');
  await expect(cells.nth(2)).toHaveAttribute('data-testid', 'day-2027-09-01');
});

test('no horizontal overflow at 390px', async ({ page }) => {
  await seed(page, [NATIONAL, EID]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/calendar');
  await page.getByTestId('strip-2027-09').click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('language toggle refreshes occasion titles', async ({ page }) => {
  await seed(page, [NATIONAL]);
  await page.goto('/calendar');
  await page.getByTestId('strip-2027-09').click();
  await expect(page.getByTestId('pill')).toHaveText(NATIONAL);
  await page.getByTestId('lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByTestId('strip-2027-09').click();
  await expect(page.getByTestId('pill')).toHaveText('Saudi National Day');
});
