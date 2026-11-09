import { expect, test } from '@playwright/test';

test('desktop signed-out shell fits the viewport and protects the cases page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  await page.goto('/cases');
  await expect(page.getByRole('heading', { name: 'سجّل دخولك الأول' })).toBeVisible();
});

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

test('manager creates an employee who signs in and creates a searchable family code', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const s = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }));
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(s.API_URL)) throw Error('Local Supabase required');
  const admin = createClient(s.API_URL, s.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const sql = (input: string) => execFileSync('docker', ['exec', '-i', 'supabase_db_charitable-case-system', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const id = crypto.randomUUID(), managerCode = `M${id.slice(0, 8)}`, employeeCode = `E${id.slice(0, 8)}`, motherName = `أم وهمية ${id.slice(0, 8)}`, childName=`طفل تجريبي ${id.slice(0,8)}`, password = 'synthetic-password-123', email = `${id}@staff.invalid`;
  let manager = '', employee = '', employeeAuth = '', caseFile = '';
  try {
    const u = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (u.error || !u.data.user) throw u.error; manager = u.data.user.id;
    sql(`insert into public.employees(id,employee_code,display_name,role) values ('${manager}','${managerCode}','Synthetic manager','manager'); insert into private.employee_auth values ('${manager}','${manager}');`);
    await page.goto('/login'); await page.getByLabel('كود الموظف').fill(managerCode); await page.getByLabel('كلمة السر').fill(password); await page.getByRole('button', { name: 'دخول', exact: true }).click();
    await expect(page.getByRole('button', { name: 'تسجيل الخروج' })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ابدأ من هنا' })).toBeVisible();
    const desktopHeadings = await page.locator('.home-page h2').allTextContents();
    expect(desktopHeadings.indexOf('ابدأ من هنا')).toBeLessThan(desktopHeadings.indexOf('متابعة انتهاء بطاقات الرقم القومي'));
    expect(await page.locator('.workspace-summary').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(4);
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await page.locator('.workspace-summary').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const mobilePages = [
      ['/cases', 'الحالات'],
      ['/cases/new', 'إضافة حالة جديدة'],
      ['/donations', 'التبرعات والكفالات'],
      ['/assistant', 'المساعد الذكي'],
      ['/staff', 'الموظفين'],
    ] as const;
    for (const [path, heading] of mobilePages) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} should fit a 360px viewport`).toBeLessThanOrEqual(360);
      const navigation = page.getByRole('navigation', { name: 'القائمة الرئيسية' });
      await expect(navigation.getByRole('link')).toHaveCount(5);
      expect(await navigation.evaluate(element => element.scrollWidth <= element.clientWidth), `${path} navigation should not clip links`).toBe(true);
      await page.setViewportSize({ width: 320, height: 720 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} should fit a 320px viewport`).toBeLessThanOrEqual(320);
      expect(await navigation.evaluate(element => element.scrollWidth <= element.clientWidth), `${path} navigation should fit at 320px`).toBe(true);
      await page.setViewportSize({ width: 360, height: 800 });
      if (path === '/donations') {
        await expect(page.getByRole('status').filter({ hasText: 'جاري تحميل البيانات' })).toBeHidden();
        await page.getByText('إضافة متبرع', { exact: true }).first().click();
        await expect(page.getByLabel('اسم المتبرع')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
      }
      if (path === '/assistant') {
        await page.getByRole('button', { name: 'ابحث عن حالة فيها علاج' }).click();
        await expect(page.getByLabel('سؤالك')).toHaveValue('ابحث عن حالة فيها علاج');
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'تفعيل الوضع الليلي' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: 'تفعيل الوضع النهاري' }).click();
    await page.goto('/staff'); await page.getByLabel('كود الموظف').fill(employeeCode); await page.getByLabel('اسم الموظف').fill('Synthetic employee'); await page.getByLabel('كلمة السر المؤقتة').fill(password); await page.locator('form').getByLabel('تعديل الحالات').check(); await page.getByRole('button', {name:'إنشاء الموظف'}).click();
    await expect(page.getByRole('group', {name:'Synthetic employee'})).toBeVisible();
    employee = sql(`select id from public.employees where employee_code='${employeeCode}'`);
    employeeAuth = sql(`select auth_user_id from private.employee_auth where employee_id='${employee}'`);
    await page.getByRole('button', {name:'تسجيل الخروج'}).click();
    await page.goto('/login'); await page.getByLabel('كود الموظف').fill(employeeCode); await page.getByLabel('كلمة السر').fill(password); await page.getByRole('button', { name: 'دخول', exact: true }).click();
    await expect(page.getByRole('button', { name: 'تسجيل الخروج' })).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/cases'); await page.getByRole('link', { name: 'إضافة حالة جديدة' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'case intake should fit a 360px viewport').toBeLessThanOrEqual(360);
    await page.getByLabel('أرملة').check();
    await page.getByLabel('اسم الأم (مطلوب)').fill(motherName);
    await page.getByLabel('الرقم القومي للأم').fill('29001011234567');
    await expect(page.getByLabel('تاريخ ميلاد الأم')).toHaveValue('1990-01-01');
    await expect(page.getByLabel('نوع الأم')).toHaveValue('female');
    await page.getByLabel('حالة الملف').selectOption('موقوف');
    await page.getByLabel('سبب الإيقاف').fill('استكمال مستند تجريبي');
    await page.getByLabel('رقم الموبايل 1').fill('01012345678');
    await page.getByRole('button', { name: 'حفظ ملف الحالة' }).click();
    await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+$/); caseFile = page.url().split('/').pop()!;
    const row = await admin.from('families').select('code,file_status,status_reason,mother_date_of_birth,mother_gender').eq('id', caseFile).single(); if (row.error) throw row.error;
    expect(row.data.code).toMatch(/^F-\d{4,}$/); expect(row.data.file_status).toBe('موقوف'); expect(row.data.status_reason).toBe('استكمال مستند تجريبي'); expect(row.data.mother_date_of_birth).toBe('1990-01-01'); expect(row.data.mother_gender).toBe('female');
    await expect(page.getByText(row.data.code).first()).toBeVisible();
    await page.getByRole('button',{name:'إضافة فرد للأسرة'}).click();
    await page.getByLabel('اسم الفرد').fill(childName);
    await page.getByLabel('صلة القرابة').fill('ابن');
    await page.getByLabel('الرقم القومي للفرد').fill('32402291234577');
    await expect(page.getByLabel('تاريخ الميلاد')).toHaveValue('2024-02-29');
    await expect(page.getByLabel('النوع')).toHaveValue('male');
    await page.getByRole('button',{name:'إضافة الفرد'}).click();
    await expect(page.getByText(childName).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'case details should fit a 360px viewport').toBeLessThanOrEqual(360);
    await expect(page.getByRole('heading', { name: /ملف الحالة/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'طباعة الحالة' })).toBeVisible();
    await page.goto('/cases'); await expect(page.locator('.table-scroll-help')).toBeVisible(); await page.getByLabel('بحث عن حالة').fill('٣٢٤٠٢٢٩١٢٣٤٥٧٧');
    const memberMatch=page.getByRole('link',{name:'فتح الملف'});await expect(memberMatch).toHaveAttribute('href',/matchedMember=/);await memberMatch.click();await expect(page.locator('.matched-member')).toContainText('مطابقة البحث');await expect(page.locator('.matched-member')).toContainText(childName);
    await page.goto('/cases');await page.getByLabel('بحث عن حالة').fill(motherName);
    const parentMatch=page.getByRole('link',{name:'فتح الملف'});await expect(parentMatch).toHaveAttribute('href',/matchedContact=mother/);await parentMatch.click();
    await expect(page.locator('#contact-mother')).toContainText('مطابقة البحث');await expect(page.locator('#contact-mother')).toContainText(motherName);
    expect(pageErrors).toEqual([]);
  } finally {
    if (!employee) employee = sql(`select id from public.employees where employee_code='${employeeCode}'`);
    if (employee && !employeeAuth) employeeAuth = sql(`select auth_user_id from private.employee_auth where employee_id='${employee}'`);
    if (!caseFile) { const createdFile = await admin.from('families').select('id').eq('mother_name', motherName).maybeSingle(); caseFile = createdFile.data?.id ?? ''; }
    if (caseFile) sql(`begin; alter table public.families disable trigger user; delete from public.family_members where family_id='${caseFile}'; delete from public.people where name='${childName}'; delete from public.case_attachments where family_id='${caseFile}'; delete from public.case_file_history where family_id='${caseFile}'; delete from public.legacy_case_map where family_id='${caseFile}'; delete from public.case_file_categories where family_id='${caseFile}'; delete from public.legacy_family_names where family_id='${caseFile}'; delete from public.families where id='${caseFile}'; alter table public.families enable trigger user; commit;`);
    if (employee) sql(`delete from private.staff_audit where actor_id='${manager}' or employee_id='${employee}'; delete from private.employee_auth where employee_id='${employee}'; delete from public.employee_permissions where employee_id='${employee}'; delete from public.employees where id='${employee}';`);
    if (employeeAuth) await admin.auth.admin.deleteUser(employeeAuth);
    if (manager) { sql(`delete from private.employee_auth where employee_id='${manager}'; delete from public.employees where id='${manager}';`); await admin.auth.admin.deleteUser(manager); }
  }
});
