import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('general manager archives and restores a case without losing its records or sponsorship history', async ({ page }) => {
  const status=JSON.parse(execFileSync('npx',['supabase','status','-o','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));
  if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL))throw new Error('Local Supabase required');
  const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const sql=(input:string)=>execFileSync('docker',['exec','-i','supabase_db_charitable-case-system','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  const id=crypto.randomUUID(),password='synthetic-password-123',email=`${id}@staff.invalid`,employeeCode=`GM${id.slice(0,8)}`;
  const person=crypto.randomUUID(),history=crypto.randomUUID(),attachment=crypto.randomUUID(),donor=crypto.randomUUID(),sponsorship=crypto.randomUUID();
  let employee='',caseFile='',storagePath='';
  try {
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error||!created.data.user)throw created.error;employee=created.data.user.id;
    sql(`insert into public.employees(id,employee_code,display_name,role) values ('${employee}','${employeeCode}','Synthetic general manager','general_manager'); insert into private.employee_auth(employee_id,auth_user_id) values ('${employee}','${employee}');`);
    const saved=await admin.from('families').insert({name:'',phone:'01010000001',father_name:'أب أرشيف',mother_name:`أم أرشيف ${id.slice(0,8)}`,notes:'سجل محفوظ للاختبار'}).select('id,code').single();if(saved.error)throw saved.error;caseFile=saved.data.id;
    const personRow=await admin.from('people').insert({id:person,name:'طفل للاختبار',gender:'male',date_of_birth:'2018-01-01'});if(personRow.error)throw personRow.error;
    const memberRow=await admin.from('family_members').insert({family_id:caseFile,person_id:person,relationship:'ابن'});if(memberRow.error)throw memberRow.error;
    const historyRow=await admin.from('case_file_history').insert({family_id:caseFile,legacy_case_id:history,notes:'تاريخ محفوظ للاختبار',created_at:'2025-01-01T00:00:00Z'});if(historyRow.error)throw historyRow.error;
    storagePath=`${caseFile}/${attachment}`;
    const uploaded=await admin.storage.from('case-files').upload(storagePath,readFileSync('tests/fixtures/arabic-sample.png'),{contentType:'image/png'});if(uploaded.error)throw uploaded.error;
    const fileRow=await admin.from('case_attachments').insert({id:attachment,family_id:caseFile,storage_path:storagePath,file_name:'مستند الاختبار.png',mime_type:'image/png',size_bytes:readFileSync('tests/fixtures/arabic-sample.png').length,uploaded_by:employee});if(fileRow.error)throw fileRow.error;
    const donorRow=await admin.from('donors').insert({id:donor,name:`متبرع ${id.slice(0,8)}`});if(donorRow.error)throw donorRow.error;
    const sponsorshipRow=await admin.from('sponsorships').insert({id:sponsorship,donor_id:donor,family_id:caseFile,monthly_amount:300,start_date:'2026-01-01',end_date:'2026-02-01'});if(sponsorshipRow.error)throw sponsorshipRow.error;
    const payments=await admin.from('sponsorship_payments').insert([
      {sponsorship_id:sponsorship,installment_month:'2026-01-01',due_date:'2026-01-01',amount_due:300,received_on:'2026-01-03',amount_received:300},
      {sponsorship_id:sponsorship,installment_month:'2026-02-01',due_date:'2026-02-01',amount_due:300},
    ]);if(payments.error)throw payments.error;

    const auth=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false}});const signedIn=await auth.auth.signInWithPassword({email,password});if(signedIn.error||!signedIn.data.session)throw signedIn.error;
    await page.route('**/api/auth/login',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({session:signedIn.data.session})}));
    await page.goto('/login');await page.getByLabel('كود الموظف').fill(employeeCode);await page.getByLabel('كلمة السر').fill(password);await page.getByRole('button',{name:'دخول',exact:true}).click();
    await expect(page.getByRole('button',{name:'تسجيل الخروج'})).toBeVisible();
    await page.goto(`/cases/${caseFile}`);await expect(page.getByRole('heading',{name:new RegExp(saved.data.code)})).toBeVisible();
    await page.getByRole('button',{name:'حذف الحالة'}).click();
    const confirmation=page.getByRole('alertdialog');await expect(confirmation).toContainText(saved.data.code);await expect(confirmation).toContainText('يقدر يسترجعها');
    await confirmation.getByRole('button',{name:'تأكيد الأرشفة'}).click();await expect(page).toHaveURL(/\/cases$/);
    await expect(page.getByRole('link',{name:new RegExp(saved.data.code)})).toHaveCount(0);
    await page.goto('/donations');const sponsoredCase=page.locator('.sponsorship-record').filter({hasText:saved.data.code});
    await expect(sponsoredCase.first().getByText('ملف الحالة مؤرشف')).toBeVisible();
    await expect(sponsoredCase.getByTestId('installment-2026-01-01')).toContainText('مستلمة');

    await page.setViewportSize({width:360,height:800});await page.goto('/cases/archive');
    await expect(page.getByRole('heading',{name:'الحالات المؤرشفة'})).toBeVisible();await expect(page.getByText(saved.data.code)).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.getByRole('button',{name:`استعادة الحالة ${saved.data.code}`}).click();
    await expect(page.getByText(`تم استرجاع الحالة ${saved.data.code}.`)).toBeVisible();
    await page.goto('/cases');await expect(page.getByRole('link',{name:new RegExp(saved.data.code)})).toBeVisible();

    const root=await admin.from('families').select('archived_at').eq('id',caseFile).single();expect(root.data?.archived_at).toBeNull();
    expect((await admin.from('family_members').select('person_id').eq('family_id',caseFile)).data).toHaveLength(1);
    expect((await admin.from('case_attachments').select('id').eq('family_id',caseFile)).data).toHaveLength(1);
    expect((await admin.storage.from('case-files').download(storagePath)).error).toBeNull();
    expect((await admin.from('case_file_history').select('id').eq('family_id',caseFile)).data).toHaveLength(1);
    expect((await admin.from('sponsorships').select('id').eq('family_id',caseFile)).data).toHaveLength(1);
    expect((await admin.from('sponsorship_payments').select('id').eq('sponsorship_id',sponsorship)).data).toHaveLength(2);
  } finally {
    if(caseFile){
      if(storagePath)await admin.storage.from('case-files').remove([storagePath]);
      sql(`begin; alter table private.case_archive_audit disable trigger case_archive_audit_append_only; alter table public.families disable trigger user; alter table public.family_members disable trigger user; alter table public.case_file_categories disable trigger user; alter table public.case_attachments disable trigger user; delete from private.case_archive_audit where family_id='${caseFile}'; delete from public.sponsorship_payments where sponsorship_id='${sponsorship}'; delete from public.sponsorships where id='${sponsorship}'; delete from public.donors where id='${donor}'; delete from public.case_attachments where family_id='${caseFile}'; delete from public.case_file_history where family_id='${caseFile}'; delete from public.family_members where family_id='${caseFile}'; delete from public.case_file_categories where family_id='${caseFile}'; delete from public.families where id='${caseFile}'; delete from public.people where id='${person}'; alter table public.case_attachments enable trigger user; alter table public.case_file_categories enable trigger user; alter table public.family_members enable trigger user; alter table public.families enable trigger user; alter table private.case_archive_audit enable trigger case_archive_audit_append_only; commit;`);
    }
    if(employee){sql(`delete from private.employee_auth where employee_id='${employee}'; delete from public.employees where id='${employee}';`);await admin.auth.admin.deleteUser(employee);}
  }
});
