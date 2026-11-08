import { expect, test } from '@playwright/test';

test('signed-out Arabic shell fits a 360px phone and links to sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('نظام إدارة الجمعية')).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  const loginLink = page.getByRole('link', { name: 'تسجيل الدخول', exact: true });
  await expect(loginLink).toBeVisible();
  const box = await loginLink.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await loginLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  await page.goto('/cases');
  await expect(page.getByRole('heading', { name: 'سجّل دخولك الأول' })).toBeVisible();
});
