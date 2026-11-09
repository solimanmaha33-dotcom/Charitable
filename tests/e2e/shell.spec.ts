import { expect, test } from '@playwright/test';

test('signed-out Arabic shell fits a 360px phone and links to sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('نظام إدارة الجمعية')).toBeVisible();
  await expect(page.getByRole('img', { name: 'شعار جمعية مرام الخير' })).toHaveAttribute('src', '/brand/maram-logo.png');
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await expect(page.getByLabel('كود الموظف')).toBeVisible();
  await expect(page.getByLabel('كلمة السر')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.getByLabel('كود الموظف')).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/cases');
  await expect(page.getByRole('heading', { name: 'سجّل دخولك الأول' })).toBeVisible();
});

test('case print sheet appears in print media', async ({ page }) => {
  await page.goto('/');
  await page.locator('main').evaluate((main) => main.insertAdjacentHTML('beforeend', '<article class="case-print-document">نموذج اختبار</article>'));
  const sheet = page.locator('.case-print-document');
  await expect(sheet).toHaveCSS('display', 'none');
  await page.emulateMedia({ media: 'print' });
  await expect(sheet).toHaveCSS('display', 'block');
  await expect(sheet).toHaveCSS('visibility', 'visible');
  await expect(page.locator('.app-header')).toHaveCSS('visibility', 'hidden');
});

test('shows the shared offline warning until the browser reports a connection again',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
 await expect(page.getByRole('status')).toContainText('النت فاصل دلوقتي.. ما تقفلش الصفحة واستنى لما يرجع عشان البيانات اللي كتبتها ما تضيعش');
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.getByText('النت فاصل دلوقتي.. ما تقفلش الصفحة واستنى لما يرجع عشان البيانات اللي كتبتها ما تضيعش')).toHaveCount(0);
});
