import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
test('assistant permissions: anonymous visitor cannot open assistant',async({page})=>{await page.goto('/assistant');await expect(page.getByRole('heading',{name:'سجّل دخولك الأول'})).toBeVisible();});
test('field suggestions: reviewed text stays unsaved until staff applies and saves',async({page})=>{
 test.setTimeout(120000);
 const status=JSON.parse(execFileSync('npx',['supabase','status','-o','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL))throw new Error('Local Supabase required');
 const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false}});const auth=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false}});
 const email=`${crypto.randomUUID()}@staff.invalid`,password='synthetic-password-123'; let uid='',familyId='';
 const sql=(input:string)=>execFileSync('docker',['exec','-i','supabase_db_charitable-case-system','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input,stdio:['pipe','pipe','pipe']});
 try {
  const user=await admin.auth.admin.createUser({email,password,email_confirm:true});if(user.error || !user.data.user)throw user.error;uid=user.data.user.id;
  sql(`insert into public.employees(id,employee_code,display_name,role) values ('${uid}','Q${uid.slice(0,8)}','Synthetic','employee'); insert into private.employee_auth(employee_id,auth_user_id) values ('${uid}','${uid}'); insert into public.employee_permissions(employee_id,cases_write,assistant_use) values ('${uid}',true,true);`);
  const family=await admin.from('families').insert({name:'أسرة وهمية'}).select('id').single();if(family.error)throw family.error;familyId=family.data.id;
  const login=await auth.auth.signInWithPassword({email,password});if(login.error || !login.data.session)throw login.error;
  const key=`sb-${new URL(status.API_URL).hostname.split('.')[0]}-auth-token`;await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session:login.data.session});
  await page.route('**/api/extract-fields',route=>route.fulfill({json:{suggestions:[{field:'notes',value:'ملاحظة وهمية',evidence:'تجريبية'}]}}));
  await page.goto('/cases/new');await page.getByLabel('الأسرة').selectOption(familyId);await page.getByLabel('اختيار صور أو PDF').setInputFiles('tests/fixtures/arabic-sample.pdf');await page.getByRole('button',{name:'استخراج النص'}).click();await expect(page.getByLabel('النص المستخرج للمراجعة')).toContainText('تجريبية',{timeout:60000});
  await page.getByRole('button',{name:'اقتراح حقول'}).click();await expect(page.getByLabel('القيمة المقترحة')).toHaveValue('ملاحظة وهمية');await expect(page.getByLabel('ملاحظات')).toHaveValue('');expect((await admin.from('cases').select('id').eq('family_id',familyId)).data).toHaveLength(0);
  await page.getByRole('button',{name:'استخدم في النموذج'}).click();await expect(page.getByLabel('ملاحظات')).toHaveValue('ملاحظة وهمية');expect((await admin.from('cases').select('id').eq('family_id',familyId)).data).toHaveLength(0);
 } finally {if(familyId)await admin.from('families').delete().eq('id',familyId);if(uid){sql(`delete from private.employee_auth where employee_id='${uid}'; delete from public.employee_permissions where employee_id='${uid}'; delete from public.employees where id='${uid}';`);await admin.auth.admin.deleteUser(uid);}}
});
test('limited staff sees a partial assistant answer with a mocked model response',async({page})=>{
 const status=JSON.parse(execFileSync('npx',['supabase','status','-o','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL))throw Error('Local Supabase required');
 const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false}}), auth=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false}});
 const email=`${crypto.randomUUID()}@staff.invalid`,password='synthetic-password-123';let uid='';
 const sql=(input:string)=>execFileSync('docker',['exec','-i','supabase_db_charitable-case-system','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input,stdio:['pipe','pipe','pipe']});
 try{
  const u=await admin.auth.admin.createUser({email,password,email_confirm:true});if(u.error||!u.data.user)throw u.error;uid=u.data.user.id;
  sql(`insert into public.employees(id,employee_code,display_name) values ('${uid}','L${uid.slice(0,8)}','Synthetic limited');insert into private.employee_auth values ('${uid}','${uid}');insert into public.employee_permissions(employee_id,cases_read,assistant_use) values ('${uid}',true,true);`);
  const login=await auth.auth.signInWithPassword({email,password});if(login.error||!login.data.session)throw login.error;
  const key=`sb-${new URL(status.API_URL).hostname.split('.')[0]}-auth-token`;await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session:login.data.session});
  await page.route('**/api/assistant',route=>route.fulfill({json:{answer:'إجابة وهمية عن الحالات المتاحة',coverage:{partial:true,explanation:'النتائج جزئية'},sources:[]}}));
  await page.goto('/assistant');await page.getByLabel('سؤالك').fill('ما الحالات؟');await page.getByRole('button',{name:'اسأل'}).click();
  await expect(page.getByText('إجابة وهمية عن الحالات المتاحة')).toBeVisible();await expect(page.getByRole('status')).toHaveText('النتائج جزئية');
  await page.goto('/donations');await expect(page.getByRole('heading',{name:'معندكش صلاحية للصفحة دي'})).toBeVisible();
 }finally{if(uid){sql(`delete from private.employee_auth where employee_id='${uid}';delete from public.employee_permissions where employee_id='${uid}';delete from public.employees where id='${uid}';`);await admin.auth.admin.deleteUser(uid);}}
});
