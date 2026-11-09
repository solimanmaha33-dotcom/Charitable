import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

test('sponsorship staff records donations, monthly receipt and inclusive end date with independent permissions', async ({page}) => {
 const status=JSON.parse(execFileSync('npx',['supabase','status','-o','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL))throw new Error('Local only');
 const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const sql=(input:string)=>execFileSync('docker',['exec','-i','supabase_db_charitable-case-system','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input,stdio:['pipe','pipe','pipe']});
 let userId='', familyId=''; const donorName=`متبرع وهمي ${crypto.randomUUID().slice(0,8)}`;
 const email=`${crypto.randomUUID()}@staff.invalid`,password='synthetic-password-123';
 try {
  const user=await admin.auth.admin.createUser({email,password,email_confirm:true}); if(user.error||!user.data.user)throw user.error; userId=user.data.user.id;
  sql(`insert into public.employees(id,employee_code,display_name) values('${userId}','D${userId.slice(0,8)}','Donation staff'); insert into private.employee_auth values('${userId}','${userId}'); insert into public.employee_permissions(employee_id,donations_write) values('${userId}',true);`);
  const family=await admin.from('families').insert({name:'أسرة كفالة وهمية',phone:'01010000003'}).select('id,code').single();if(family.error)throw family.error;familyId=family.data.id;
  const signed=await auth.auth.signInWithPassword({email,password});if(signed.error||!signed.data.session)throw signed.error;
  const key=`sb-${new URL(status.API_URL).hostname.split('.')[0]}-auth-token`;
  await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session:signed.data.session});
  await page.goto('/donations');
  await expect(page.getByRole('heading',{name:'التبرعات والكفالات'})).toBeVisible();
  await page.locator('summary').filter({hasText:'إضافة متبرع'}).click();
  await expect(page.getByLabel('اسم المتبرع')).toBeVisible();
  await page.getByLabel('اسم المتبرع').fill(donorName);
  await page.getByRole('button',{name:'حفظ المتبرع',exact:true}).click();
  await expect(page.getByLabel('متبرع التبرع').getByRole('option',{name:donorName})).toHaveCount(1);
  await page.locator('summary').filter({hasText:'تسجيل تبرع'}).click();
  await page.getByLabel('متبرع التبرع').selectOption({label:donorName});
  await page.getByLabel('مبلغ التبرع (جنيه مصري)').fill('125.50');
  await page.getByRole('button',{name:'حفظ التبرع',exact:true}).click();
  await expect(page.getByTestId('donation-list')).toContainText('125.5');
  await page.getByLabel('شكل التبرع').selectOption('in_kind');
  await page.getByLabel('نوع التبرع').selectOption('ramadan_food_bags');
  await page.getByLabel('الكمية').fill('10');await page.getByLabel('الوحدة').fill('شنطة');await page.getByLabel('وصف الأصناف').fill('أرز وزيت');
  await page.getByRole('button',{name:'حفظ التبرع',exact:true}).click();
  await expect(page.getByTestId('donation-list')).toContainText('10 شنطة');
  await expect(page.getByText(/عدد الكفالات مش متاح من غير صلاحية قراءة الحالات/)).toBeVisible();
  sql(`update public.employee_permissions set cases_read=true where employee_id='${userId}';`);
  await page.reload();
  await page.locator('summary').filter({hasText:'إضافة كفالة شهرية'}).click();
  await page.getByLabel('متبرع الكفالة').selectOption({label:donorName});
  await page.getByLabel('ملف الكفالة').selectOption(familyId);
  await page.getByLabel('مبلغ الكفالة الشهري (جنيه مصري)').fill('350');
  await page.getByLabel('بداية الكفالة').fill('2024-01-31');
  await page.getByLabel('نهاية الكفالة (اختياري)').fill('2024-03-31');
  await page.getByRole('button',{name:'حفظ الكفالة',exact:true}).click();
  const first=page.getByTestId('installment-2024-01-01');
  await expect(first).toContainText('2024-01-31');await expect(first).toContainText('350');await expect(first).toContainText('متأخرة');
  await first.getByLabel('تاريخ استلام الدفعة').fill('2024-02-10');
  await first.getByLabel('المبلغ المستلم (جنيه مصري)').fill('350');
  await first.getByRole('button',{name:'تسجيل الاستلام'}).click();
  await expect(first).toContainText('مستلمة');await expect(first.getByRole('button',{name:'تسجيل الاستلام'})).toHaveCount(0);await expect(first.getByRole('button',{name:'إلغاء الدفعة'})).toBeVisible();
  await page.getByLabel('تعديل نهاية الكفالة').fill('2024-02-29');await page.getByRole('button',{name:'حفظ نهاية الكفالة'}).click();
  await expect(page.getByTestId('installment-2024-03-01')).toHaveCount(0);
  await expect(page.getByTestId('installment-2024-02-01')).toContainText('2024-02-29');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await first.scrollIntoViewIfNeeded();
  await page.screenshot({path:'/tmp/donations-sponsorship.png'});
  // Read-only permission preserves history but removes all mutation controls.
  sql(`update public.employee_permissions set donations_write=false,donations_read=true where employee_id='${userId}';`);
  await page.reload();await expect(first).toContainText('مستلمة');await expect(page.getByRole('button',{name:'حفظ المتبرع',exact:true})).toHaveCount(0);
  const denied=await auth.from('donations').insert({donation_type:'cash',kind:'cash',amount:1,received_on:'2024-01-01'});expect(denied.error?.code).toBe('42501');
  sql(`update public.employee_permissions set donations_read=false,cases_write=true where employee_id='${userId}';`);
  await page.reload();await expect(page.getByRole('heading',{name:'معندكش صلاحية للصفحة دي'})).toBeVisible();
  for(const table of ['donors','donations','sponsorships','sponsorship_payments']) {const read=await auth.from(table).select('id');expect(read.error).toBeNull();expect(read.data).toEqual([]);}
 } finally {
  if(familyId)sql(`delete from public.sponsorship_payments where sponsorship_id in(select id from public.sponsorships where family_id='${familyId}'); delete from public.sponsorships where family_id='${familyId}'; delete from public.families where id='${familyId}';`);
  const donors=await admin.from('donors').select('id').eq('name',donorName);for(const d of donors.data??[]) {await admin.from('donations').delete().eq('donor_id',d.id);await admin.from('donors').delete().eq('id',d.id);}
  if(userId) {sql(`delete from private.employee_auth where employee_id='${userId}';delete from public.employees where id='${userId}';`);await admin.auth.admin.deleteUser(userId);}
 }
});

test('sponsorship reader sees current and overdue installments across months without any writer visit', async ({page}) => {
 const s=JSON.parse(execFileSync('npx',['supabase','status','-o','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(s.API_URL))throw new Error('Local only');
 const admin=createClient(s.API_URL,s.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),reader=createClient(s.API_URL,s.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const sql=(input:string)=>execFileSync('docker',['exec','-i','supabase_db_charitable-case-system','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input,stdio:['pipe','pipe','pipe']});
 let uid='',family='',donor='',sponsorship='';const email=`${crypto.randomUUID()}@staff.invalid`,password='synthetic-password-123';
 try {
  const u=await admin.auth.admin.createUser({email,password,email_confirm:true});if(u.error||!u.data.user)throw u.error;uid=u.data.user.id;
  sql(`insert into public.employees(id,employee_code,display_name) values('${uid}','M${uid.slice(0,8)}','Synthetic monthly reader');insert into private.employee_auth values('${uid}','${uid}');insert into public.employee_permissions(employee_id,donations_read,cases_read) values('${uid}',true,true);`);
  const f=await admin.from('families').insert({name:'أسرة قارئ شهرية وهمية',phone:'01010000004'}).select('id').single();if(f.error)throw f.error;family=f.data.id;
  const d=await admin.from('donors').insert({name:'متبرع قارئ شهري وهمي'}).select('id').single();if(d.error)throw d.error;donor=d.data.id;
  const sp=await admin.from('sponsorships').insert({family_id:family,donor_id:donor,monthly_amount:450,start_date:'2024-01-31'}).select('id').single();if(sp.error)throw sp.error;sponsorship=sp.data.id;
  const signed=await reader.auth.signInWithPassword({email,password});if(signed.error||!signed.data.session)throw signed.error;
  const key=`sb-${new URL(s.API_URL).hostname.split('.')[0]}-auth-token`;await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session:signed.data.session});
  await page.clock.setFixedTime(new Date('2024-01-31T12:00:00Z'));await page.goto('/donations');
  await expect(page.getByTestId('installment-2024-01-01')).toContainText('مستحقة');await expect(page.getByTestId('installment-2024-02-01')).toHaveCount(1);
  await page.clock.setFixedTime(new Date('2024-02-29T12:00:00Z'));await page.reload();
  await expect(page.getByTestId('installment-2024-01-01')).toContainText('متأخرة');await expect(page.getByTestId('installment-2024-02-01')).toContainText('2024-02-29');await expect(page.getByTestId('installment-2024-02-01')).toContainText('مستحقة');
  await page.clock.setFixedTime(new Date('2024-03-01T12:00:00Z'));await page.reload();
  await expect(page.getByTestId('installment-2024-02-01')).toContainText('متأخرة');await expect(page.getByTestId('installment-2024-03-01')).toContainText('2024-03-31');
  await expect(page.getByRole('button',{name:'تسجيل الاستلام'})).toHaveCount(0);
 } finally {
  if(sponsorship){await admin.from('sponsorship_payments').delete().eq('sponsorship_id',sponsorship);await admin.from('sponsorships').delete().eq('id',sponsorship);}if(donor)await admin.from('donors').delete().eq('id',donor);if(family)await admin.from('families').delete().eq('id',family);
  if(uid){sql(`delete from private.employee_auth where employee_id='${uid}';delete from public.employees where id='${uid}';`);await admin.auth.admin.deleteUser(uid);}
 }
});
