import { expect, test } from '@playwright/test';

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
  await expect(cards.first().getByTestId('rec-reasons')).toContainText('الصحة');
  await expect(page.getByTestId('rec-card').filter({ hasText: 'اليوم الوطني' }).first()).toBeVisible();

  await cards.nth(0).getByTestId('rec-toggle').click();
  await cards.nth(1).getByTestId('rec-toggle').click();
  await expect(page.getByTestId('plan-count')).toHaveText('2');
  await saved;

  await page.reload();
  await expect(page.getByTestId('sector-government')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('chip-health')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('chip-awareness')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('plan-count')).toHaveText('2');

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await page2.goto('http://localhost:3000/');
  await expect(page2.getByTestId('plan-count')).toHaveText('0');
  await other.close();
});
