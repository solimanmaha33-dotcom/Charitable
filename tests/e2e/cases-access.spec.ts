import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

test('signed-in employee without case access is denied by the page and direct API', async ({ page }) => {
 const status=JSON.parse(execFileSync('npx',['supabase','status','-o','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL)) throw new Error('Local Supabase required');
 const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const email=`${crypto.randomUUID()}@staff.invalid`; const password='synthetic-password-123';
 let userId=''; let familyId=''; let caseId='';
 try {
  const user=await admin.auth.admin.createUser({email,password,email_confirm:true}); if(user.error || !user.data.user) throw user.error ?? new Error('missing user'); userId=user.data.user.id;
  const sql=`insert into public.employees(id,employee_code,display_name,role) values ('${userId}','N${userId.slice(0,8)}','Synthetic no access','employee'); insert into private.employee_auth(employee_id,auth_user_id) values ('${userId}','${userId}');`;
  execFileSync('docker',['exec','-i','supabase_db_charitable-case-system','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','pipe','pipe']});
  const family=await admin.from('families').insert({name:'أسرة سرية وهمية'}).select('id').single(); if(family.error) throw family.error; familyId=family.data.id;
  const record=await admin.from('cases').insert({family_id:familyId,notes:'ملاحظة سرية وهمية'}).select('id').single(); if(record.error) throw record.error; caseId=record.data.id;
  const signedIn=await auth.auth.signInWithPassword({email,password}); if(signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error('missing session');
  const token=signedIn.data.session.access_token;
  const api=await fetch(`${status.API_URL}/rest/v1/cases?id=eq.${caseId}&select=id,notes`,{headers:{apikey:status.ANON_KEY,authorization:`Bearer ${token}`}});
  expect(api.status).toBe(200); expect(await api.json()).toEqual([]);
  const key=`sb-${new URL(status.API_URL).hostname.split('.')[0]}-auth-token`;
  await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session:signedIn.data.session});
  await page.goto(`/cases/${caseId}`);
  await expect(page.getByRole('button',{name:'تسجيل الخروج'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'معندكش صلاحية للصفحة دي'})).toBeVisible();
  await expect(page.getByText('ملاحظة سرية وهمية')).toHaveCount(0);
 } finally {
  if(caseId) await admin.from('cases').delete().eq('id',caseId);
  if(familyId) await admin.from('families').delete().eq('id',familyId);
  if(userId) {
   execFileSync('docker',['exec','-i','supabase_db_charitable-case-system','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:`delete from private.employee_auth where employee_id='${userId}'; delete from public.employees where id='${userId}';`,stdio:['pipe','pipe','pipe']});
   await admin.auth.admin.deleteUser(userId);
  }
 }
});
