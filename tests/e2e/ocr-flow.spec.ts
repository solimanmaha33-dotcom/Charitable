import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('case attachment: local Arabic PDF and image extraction', async ({page}) => {
 test.setTimeout(120000);
 const requests:string[]=[]; page.on('request',r=>requests.push(r.url()));
 await page.goto('/');
 for (const [name,source] of [['arabic-sample.pdf','pdf-text'],['arabic-scan.pdf','ocr'],['arabic-mixed.pdf','ocr'],['arabic-sample.png','ocr']] as const) {
  const base64=readFileSync(`tests/fixtures/${name}`).toString('base64');
  const result=await page.evaluate(async ({base64,name})=>{
   const bytes=Uint8Array.from(atob(base64), c=>c.charCodeAt(0));
   const file=new File([bytes],name,{type:name.endsWith('.pdf')?'application/pdf':'image/png'});
   // Vite serves this module locally in the browser under test.
   const modulePath='/src/features/files/ocr.ts'; const mod=await import(/* @vite-ignore */ modulePath);
   return mod.extractDocumentText(file);
  },{base64,name});
  expect(result.source).toBe(source); expect(result.pages[0].text).toContain('تجريبية');
 }
 const huge=readFileSync('tests/fixtures/arabic-sample.png'); huge.writeUInt32BE(100000,16);huge.writeUInt32BE(100000,20);
 const imageError=await page.evaluate(async base64=>{const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)); const path='/src/features/files/ocr.ts'; const mod=await import(/* @vite-ignore */ path);try{await mod.extractDocumentText(new File([bytes],'huge.png',{type:'image/png'}));return '';}catch(e){return (e as Error).message;}},huge.toString('base64'));
 expect(imageError).toContain('أبعاد');
 const tooMany=readFileSync('tests/fixtures/over-20-pages.pdf').toString('base64');
 const error=await page.evaluate(async base64=>{const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)); const path='/src/features/files/ocr.ts'; const mod=await import(/* @vite-ignore */ path); try { await mod.extractDocumentText(new File([bytes],'large.pdf',{type:'application/pdf'})); return ''; } catch(e) {return (e as Error).message;}},tooMany);
 expect(error).toContain('٢٠ صفحة');
 expect(requests.filter(url=>!url.startsWith('http://127.0.0.1:4173/') && !url.startsWith('http://127.0.0.1:54321/') && !url.startsWith('blob:http://127.0.0.1:4173/'))).toEqual([]);
});

test('case attachment: staged image is uploaded and protected', async ({page}) => {
 test.setTimeout(120000);
 const {execFileSync}=await import('node:child_process'); const {createClient}=await import('@supabase/supabase-js');
 const status=JSON.parse(execFileSync('npx',['supabase','status','-o','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL)) throw new Error('Local Supabase required');
 const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const email=`${crypto.randomUUID()}@staff.invalid`; const password='synthetic-password-123'; let userId='',deniedId='',familyId='',caseId='',path='';
 const sql=(input:string)=>execFileSync('docker',['exec','-i','supabase_db_charitable-case-system','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input,stdio:['pipe','pipe','pipe']});
 try {
  const user=await admin.auth.admin.createUser({email,password,email_confirm:true}); if(user.error || !user.data.user) throw user.error; userId=user.data.user.id;
  sql(`insert into public.employees(id,employee_code,display_name,role) values ('${userId}','A${userId.slice(0,8)}','Synthetic','employee'); insert into private.employee_auth(employee_id,auth_user_id) values ('${userId}','${userId}'); insert into public.employee_permissions(employee_id,cases_write) values ('${userId}',true);`);
  const family=await admin.from('families').insert({name:'أسرة وهمية مرفقات'}).select('id').single(); if(family.error)throw family.error;familyId=family.data.id;
  const login=await auth.auth.signInWithPassword({email,password});if(login.error || !login.data.session)throw login.error;
  const key=`sb-${new URL(status.API_URL).hostname.split('.')[0]}-auth-token`;
  await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session:login.data.session});
  await page.goto(`/cases/new?family=${familyId}`);
  await page.getByLabel('اختيار صور أو PDF').setInputFiles('tests/fixtures/arabic-sample.pdf');
  await expect(page.getByTitle('معاينة arabic-sample.pdf')).toBeVisible();
  await page.getByRole('button',{name:'إزالة arabic-sample.pdf'}).click();
  await page.getByLabel('اختيار صور أو PDF').setInputFiles('tests/fixtures/arabic-sample.png');
  await expect(page.getByAltText('معاينة arabic-sample.png')).toBeVisible();
  await page.getByRole('button',{name:'استخراج النص'}).click();
  await expect(page.getByLabel('النص المستخرج للمراجعة')).toContainText('تجريبية',{timeout:60000});
  await expect(page.getByLabel('ملاحظات')).toHaveValue('');
  let failOnce=true; await page.route('**/api/case-files/upload',async route=>{if(failOnce){failOnce=false;await route.fulfill({status:503,body:'temporary failure'});}else await route.continue();});
  await page.getByRole('button',{name:'حفظ الحالة'}).click();
  await expect(page.getByRole('alert')).toContainText('تعذّر حفظ الحالة أو بعض المرفقات');
  expect((await admin.from('cases').select('id').eq('family_id',familyId)).data).toHaveLength(1);
  await page.getByRole('button',{name:'حفظ الحالة'}).click(); await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+$/, {timeout:30000});
  caseId=page.url().split('/').pop()!; expect((await admin.from('cases').select('id').eq('family_id',familyId)).data).toHaveLength(1);
  const files=await admin.from('case_files').select('*').eq('case_id',caseId);if(files.error)throw files.error;expect(files.data).toHaveLength(1);path=files.data[0].storage_path;
  expect((await admin.from('cases').select('notes').eq('id',caseId).single()).data?.notes).toBe('');
  await page.getByRole('button',{name:'arabic-sample.png'}).click(); await expect(page.getByAltText('معاينة arabic-sample.png')).toBeVisible();
  const otherEmail=`${crypto.randomUUID()}@staff.invalid`; const other=await admin.auth.admin.createUser({email:otherEmail,password,email_confirm:true}); if(other.error || !other.data.user) throw other.error; deniedId=other.data.user.id;
  sql(`insert into public.employees(id,employee_code,display_name,role) values ('${deniedId}','N${deniedId.slice(0,8)}','Synthetic no access','employee'); insert into private.employee_auth(employee_id,auth_user_id) values ('${deniedId}','${deniedId}');`);
  const noAccess=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}); const otherLogin=await noAccess.auth.signInWithPassword({email:otherEmail,password}); if(otherLogin.error) throw otherLogin.error; expect((await noAccess.storage.from('case-files').download(path)).error).toBeTruthy();
  const anonymous=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false}});const denied=await anonymous.storage.from('case-files').download(path); expect(denied.error).toBeTruthy();
  await page.screenshot({path:'/tmp/case-attachment.png'});
 } finally {
  if(caseId) await admin.from('case_files').delete().eq('case_id',caseId);
  if(path) await admin.storage.from('case-files').remove([path]);
  if(caseId) await admin.from('cases').delete().eq('id',caseId);
  if(familyId) await admin.from('families').delete().eq('id',familyId);
  if(deniedId){sql(`delete from private.employee_auth where employee_id='${deniedId}'; delete from public.employees where id='${deniedId}';`);await admin.auth.admin.deleteUser(deniedId);}
  if(userId){sql(`delete from private.employee_auth where employee_id='${userId}'; delete from public.employee_permissions where employee_id='${userId}'; delete from public.employees where id='${userId}';`);await admin.auth.admin.deleteUser(userId);}
 }
});
