import { expect, test } from '@playwright/test';

test('Arabic navigation fits a 360px phone and works with a keyboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('نظام الجمعية')).toBeVisible();
  const links = page.getByRole('navigation').getByRole('link');
  for (const link of await links.all()) {
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const familiesLink = page.getByRole('link', { name: 'الأسر', exact: true });
  await familiesLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/families');
  await expect(page.getByRole('heading', { name: 'سجّل دخولك الأول' })).toBeVisible();
  await page.getByRole('link', { name: 'روح لتسجيل الدخول' }).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
});
