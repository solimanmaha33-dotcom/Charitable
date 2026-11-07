import { expect, test } from '@playwright/test';

test('desktop navigation remains usable and fits the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('link', { name: 'الأسر', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  await page.getByRole('link', { name: 'الأسر', exact: true }).click();
  await expect(page).toHaveURL('/families');
});

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

test('manager creates an employee who signs in and creates a searchable family code', async ({ page }) => {
  const s = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }));
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(s.API_URL)) throw Error('Local Supabase required');
  const admin = createClient(s.API_URL, s.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const sql = (input: string) => execFileSync('docker', ['exec', '-i', 'supabase_db_charitable-case-system', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const id = crypto.randomUUID(), managerCode = `M${id.slice(0, 8)}`, employeeCode = `E${id.slice(0, 8)}`, password = 'synthetic-password-123', email = `${id}@staff.invalid`;
  let manager = '', employee = '', employeeAuth = '', family = '';
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
    await page.goto('/families'); await page.getByRole('button', { name: 'إضافة أسرة' }).click(); await page.getByLabel('اسم الأسرة').fill(`أسرة وهمية ${id.slice(0, 8)}`); await page.getByRole('button', { name: 'حفظ بيانات الأسرة' }).click();
    await expect(page).toHaveURL(/\/families\/[0-9a-f-]+$/); family = page.url().split('/').pop()!;
    const row = await admin.from('families').select('code').eq('id', family).single(); if (row.error) throw row.error;
    expect(row.data.code).toMatch(/^F-\d{4,}$/); await expect(page.getByRole('heading', { name: new RegExp(row.data.code) })).toBeVisible();
    await page.goto('/families'); await page.getByLabel('بحث بالاسم أو الكود').fill(row.data.code); await expect(page.getByRole('link', { name: new RegExp(row.data.code) })).toBeVisible();
  } finally {
    if (!employee) employee = sql(`select id from public.employees where employee_code='${employeeCode}'`);
    if (employee && !employeeAuth) employeeAuth = sql(`select auth_user_id from private.employee_auth where employee_id='${employee}'`);
    if (family) await admin.from('families').delete().eq('id', family);
    if (employee) sql(`delete from private.staff_audit where actor_id='${manager}' or employee_id='${employee}'; delete from private.employee_auth where employee_id='${employee}'; delete from public.employee_permissions where employee_id='${employee}'; delete from public.employees where id='${employee}';`);
    if (employeeAuth) await admin.auth.admin.deleteUser(employeeAuth);
    if (manager) { sql(`delete from private.employee_auth where employee_id='${manager}'; delete from public.employees where id='${manager}';`); await admin.auth.admin.deleteUser(manager); }
  }
});
