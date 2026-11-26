import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import postgres from 'postgres';
import { SESSION_COOKIE, createAdminSession, deleteUserByEmail } from '../helpers/admin-session';

const ADMIN = (process.env.ADMIN_EMAILS ?? 'admin@example.com').split(',')[0].trim();
const OUTSIDER = 'e2e-outsider@example.com';
const ORG = 'جهة اختبار الإدارة';

const sql = postgres(process.env.DATABASE_URL!);
let adminToken = '';
let outsiderToken = '';

test.beforeAll(async () => {
  adminToken = await createAdminSession(sql, ADMIN);
  outsiderToken = await createAdminSession(sql, OUTSIDER);
});

test.afterAll(async () => {
  await sql`delete from leads where org_name like ${ORG + '%'}`;
  await deleteUserByEmail(sql, ADMIN);
  await deleteUserByEmail(sql, OUTSIDER);
  await sql.end();
});

async function signInAs(page: Page, token: string, baseURL: string | undefined) {
  await page.context().addCookies([{ name: SESSION_COOKIE, value: token, url: baseURL! }]);
}

test('unauthenticated /admin redirects to sign-in; admin APIs are 403', async ({ page, request }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  await page.goto('/admin/events');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  expect((await request.post('/api/admin/events', { data: {} })).status()).toBe(403);
  expect((await request.get('/api/admin/leads/export')).status()).toBe(403);
});

test('a session whose email is not in ADMIN_EMAILS gets no access', async ({ page, baseURL, request }) => {
  await signInAs(page, outsiderToken, baseURL);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  const res = await page.request.post('/api/admin/events', { data: {} });
  expect(res.status()).toBe(403);
  void request;
});

test('admin shell, overview and editing flag-day updates public recommendations', async ({ page, baseURL }) => {
  await signInAs(page, adminToken, baseURL);
  await page.goto('/admin');
  for (const label of ['نظرة عامة', 'المناسبات', 'التصنيفات', 'العملاء المحتملون']) {
    await expect(page.getByRole('navigation', { name: 'تنقل لوحة الإدارة' }).getByText(label)).toBeVisible();
  }
  await expect(page.getByTestId('stat-events')).not.toHaveText('0');
  await expect(page.getByTestId('needs-date')).toBeVisible();
  // Estimated Hijri dates (e.g. Ramadan 2027) come with a confirm action that opens the editor.
  const confirm = page.getByRole('link', { name: 'تأكيد التاريخ' }).first();
  await expect(confirm).toBeVisible();

  await page.goto('/admin/events?q=flag-day');
  await page.getByTestId('edit-flag-day').click();
  const title = page.getByTestId('field-titleAr');
  const original = await title.inputValue();
  const edited = `${original} المعدّل`;
  try {
    await title.fill(edited);
    await page.getByTestId('event-save').click();
    await expect(page.getByTestId('event-status')).toHaveText('تم الحفظ');

    const recs = await page.request.post('/api/recommendations', {
      data: { selections: { sector: null, fields: [], audiences: [], uses: [] }, startMonth: '2027-01-01' },
    });
    const { items } = (await recs.json()) as { items: { titleAr: string }[] };
    expect(items.some((i) => i.titleAr === edited)).toBe(true);
  } finally {
    await title.fill(original);
    await page.getByTestId('event-save').click();
    await expect(page.getByTestId('event-status')).toHaveText('تم الحفظ');
  }
});

test('invalid event input is rejected with 400', async ({ page, baseURL }) => {
  await signInAs(page, adminToken, baseURL);
  const res = await page.request.post('/api/admin/events', {
    data: { slug: 'bad', titleAr: 'x', titleEn: 'x', kind: 'national', recurrence: 'gregorian_fixed', gMonth: 13, gDay: 1, durationDays: 1, prepDays: 1, active: true, tags: [] },
  });
  expect(res.status()).toBe(400);
});

test('occurrence override: confirm a Hijri date from the editor', async ({ page, baseURL }) => {
  // 2028 on purpose: other specs run in parallel on the same DB with 2027 spans and assert that Eid
  // al-Fitr 2027 is 'estimated'; a temporary 2027 override made them flaky.
  await signInAs(page, adminToken, baseURL);
  await page.goto('/admin/events?q=eid-al-fitr');
  await page.getByTestId('edit-eid-al-fitr').click();
  await page.getByTestId('occ-year').selectOption('2028');
  await page.getByTestId('occ-date').fill('2028-02-27');
  await page.getByTestId('occ-status').selectOption('confirmed');
  await page.getByTestId('occ-save').click();
  await expect(page.getByTestId('occ-status-msg')).toHaveText('تم حفظ التاريخ');
  try {
    await expect(page.getByTestId('occ-row-2028')).toContainText('2028-02-27 (مؤكد)');
  } finally {
    await page.getByTestId('occ-remove').click();
    await expect(page.getByTestId('occ-status-msg')).toHaveText('تم حفظ التاريخ');
  }
});

test('leads: table, filters, pagination and Excel export', async ({ page, baseURL }) => {
  await sql`delete from leads where org_name like ${ORG + '%'}`;
  // Dated an hour ahead so they stay the newest even while download specs add leads in parallel.
  for (let i = 0; i < 27; i++) {
    await sql`insert into leads (email, org_name, sector, fields, phone, created_at)
              values (${`lead${i}@example.com`}, ${`${ORG} ${i}`}, ${i === 0 ? 'nonprofit' : 'private'}, ${sql.json(['health'])}, '0500000000', now() + interval '1 hour' - ${i} * interval '1 minute')`;
  }
  await signInAs(page, adminToken, baseURL);
  await page.goto('/admin/leads');
  const headers = await page.getByTestId('leads-table').locator('th').allTextContents();
  expect(headers[0]).toBe('الجهة');
  expect(headers).toHaveLength(7);
  await expect(page.getByTestId('leads-table').locator('tbody tr')).toHaveCount(25);
  await expect(page.getByTestId('leads-table').locator('tbody tr').first()).toContainText(`${ORG} 0`);

  await page.getByTestId('leads-next').click();
  await expect(page).toHaveURL(/page=2/);
  expect(await page.getByTestId('leads-table').locator('tbody tr').count()).toBeGreaterThanOrEqual(2);

  await page.goto('/admin/leads?sector=nonprofit');
  await expect(page.getByTestId('leads-table')).toContainText(`${ORG} 0`);
  await expect(page.getByTestId('leads-table')).not.toContainText(`${ORG} 1`);

  await page.goto('/admin/leads');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('leads-export').click()]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile((await download.path())!);
  const sheet = wb.worksheets[0];
  expect(sheet.getRow(1).getCell(1).value).toBe('الجهة');
  expect(sheet.rowCount).toBeGreaterThanOrEqual(28);
});

test('taxonomy terms can be edited but not deleted', async ({ page, baseURL }) => {
  await signInAs(page, adminToken, baseURL);
  await page.goto('/admin/taxonomy');
  await expect(page.getByTestId('term-sector-government')).toBeVisible();
  await expect(page.getByRole('button', { name: /حذف/ })).toHaveCount(0);
  const [{ id }] = await sql<{ id: number }[]>`select id from taxonomy_terms where "group" = 'sector' and key = 'government'`;
  expect((await page.request.delete(`/api/admin/taxonomy/${id}`)).status()).toBe(405);
});
