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
  const s = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }));
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(s.API_URL)) throw Error('Local Supabase required');
  const admin = createClient(s.API_URL, s.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const sql = (input: string) => execFileSync('docker', ['exec', '-i', 'supabase_db_charitable-case-system', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const id = crypto.randomUUID(), managerCode = `M${id.slice(0, 8)}`, employeeCode = `E${id.slice(0, 8)}`, motherName = `أم وهمية ${id.slice(0, 8)}`, password = 'synthetic-password-123', email = `${id}@staff.invalid`;
  let manager = '', employee = '', employeeAuth = '', caseFile = '';
  try {
    const u = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (u.error || !u.data.user) throw u.error; manager = u.data.user.id;
    sql(`insert into public.employees(id,employee_code,display_name,role) values ('${manager}','${managerCode}','Synthetic manager','manager'); insert into private.employee_auth values ('${manager}','${manager}');`);
    await page.goto('/login'); await page.getByLabel('كود الموظف').fill(managerCode); await page.getByLabel('كلمة السر').fill(password); await page.getByRole('button', { name: 'دخول', exact: true }).click();
    await expect(page.getByRole('button', { name: 'تسجيل الخروج' })).toBeVisible();
    await page.goto('/staff'); await page.getByLabel('كود الموظف').fill(employeeCode); await page.getByLabel('اسم الموظف').fill('Synthetic employee'); await page.getByLabel('كلمة السر المؤقتة').fill(password); await page.getByRole('group', {name:'الصلاحيات'}).getByLabel('تعديل الحالات').check(); await page.getByRole('button', {name:'إنشاء الموظف'}).click();
    await expect(page.getByRole('group', {name:'Synthetic employee'})).toBeVisible();
    employee = sql(`select id from public.employees where employee_code='${employeeCode}'`);
    employeeAuth = sql(`select auth_user_id from private.employee_auth where employee_id='${employee}'`);
    await page.getByRole('button', {name:'تسجيل الخروج'}).click();
    await page.goto('/login'); await page.getByLabel('كود الموظف').fill(employeeCode); await page.getByLabel('كلمة السر').fill(password); await page.getByRole('button', { name: 'دخول', exact: true }).click();
    await expect(page.getByRole('button', { name: 'تسجيل الخروج' })).toBeVisible();
    await page.goto('/cases'); await page.getByRole('link', { name: 'إضافة حالة جديدة' }).click();
    await page.getByLabel('أرملة').check();
    await page.getByLabel('اسم الأم (مطلوب)').fill(motherName);
    await page.getByLabel('حالة الملف').selectOption('موقوف');
    await page.getByLabel('سبب الإيقاف').fill('استكمال مستند تجريبي');
    await page.getByRole('button', { name: 'حفظ ملف الحالة' }).click();
    await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+$/); caseFile = page.url().split('/').pop()!;
    const row = await admin.from('families').select('code,file_status,status_reason').eq('id', caseFile).single(); if (row.error) throw row.error;
    expect(row.data.code).toMatch(/^F-\d{4,}$/); expect(row.data.file_status).toBe('موقوف'); expect(row.data.status_reason).toBe('استكمال مستند تجريبي');
    await expect(page.getByText(row.data.code).first()).toBeVisible();
    await page.goto('/cases'); await page.getByLabel('بحث عن حالة').fill(row.data.code); await expect(page.getByRole('link', { name: new RegExp(row.data.code) })).toBeVisible();
  } finally {
    if (!employee) employee = sql(`select id from public.employees where employee_code='${employeeCode}'`);
    if (employee && !employeeAuth) employeeAuth = sql(`select auth_user_id from private.employee_auth where employee_id='${employee}'`);
    if (!caseFile) { const createdFile = await admin.from('families').select('id').eq('mother_name', motherName).maybeSingle(); caseFile = createdFile.data?.id ?? ''; }
    if (caseFile) sql(`begin; alter table public.families disable trigger user; delete from public.case_attachments where family_id='${caseFile}'; delete from public.case_file_history where family_id='${caseFile}'; delete from public.legacy_case_map where family_id='${caseFile}'; delete from public.case_file_categories where family_id='${caseFile}'; delete from public.legacy_family_names where family_id='${caseFile}'; delete from public.families where id='${caseFile}'; alter table public.families enable trigger user; commit;`);
    if (employee) sql(`delete from private.staff_audit where actor_id='${manager}' or employee_id='${employee}'; delete from private.employee_auth where employee_id='${employee}'; delete from public.employee_permissions where employee_id='${employee}'; delete from public.employees where id='${employee}';`);
    if (employeeAuth) await admin.auth.admin.deleteUser(employeeAuth);
    if (manager) { sql(`delete from private.employee_auth where employee_id='${manager}'; delete from public.employees where id='${manager}';`); await admin.auth.admin.deleteUser(manager); }
  }
});
