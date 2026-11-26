import { expect, test, type BrowserContext } from '@playwright/test';
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


test('plan builder: recommend, add, persist, isolate', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByTestId('sector-government').click();
  await page.getByTestId('chip-health').click();
  await page.getByTestId('chip-awareness').click();
  // let the debounced draft save land before reloading later
  const saved = page.waitForResponse((r) => r.url().includes('/api/draft') && r.request().method() === 'PATCH');
  await page.getByTestId('recommend-btn').click();

  const cards = page.getByTestId('rec-card');
  await expect(cards.first()).toBeVisible();
  // national/religious occasions rank first; a health-matched card follows within the first page
  await expect(page.getByTestId('rec-reasons').filter({ hasText: 'الصحة' }).first()).toBeVisible();
  await expect(cards).toHaveCount(12);
  await expect(page.getByTestId('rec-card').filter({ hasText: 'اليوم الوطني' }).first()).toBeVisible();
  await page.getByTestId('show-more').click();
  await expect(cards).toHaveCount(24);

  await cards.nth(0).getByTestId('rec-toggle').click();
  await cards.nth(1).getByTestId('rec-toggle').click();
  await expect(page.getByTestId('plan-count')).toHaveText('2');
  await saved;

  await remember(page.context());
  await page.reload();
  await expect(page.getByTestId('sector-government')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('chip-health')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('chip-awareness')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('plan-count')).toHaveText('2');

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await page2.goto('http://localhost:3000/');
  await expect(page2.getByTestId('plan-count')).toHaveText('0');
  await remember(other);
  await other.close();
});
