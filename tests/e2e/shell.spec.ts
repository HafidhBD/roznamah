import { test, expect } from '@playwright/test';

test('renders Arabic RTL by default and toggles to English, persisting', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(html).toHaveAttribute('lang', 'ar');
  await expect(page.getByTestId('brand')).toHaveText('رَزنامة');

  await page.getByTestId('lang-toggle').click();
  await expect(html).toHaveAttribute('dir', 'ltr');
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('brand')).toHaveText('Roznamah');

  await page.reload();
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(html).toHaveAttribute('dir', 'ltr');
});

test('nav links resolve to real routes', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-calendar').first().click();
  await expect(page).toHaveURL(/\/calendar$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test('no horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBe(390);
});
