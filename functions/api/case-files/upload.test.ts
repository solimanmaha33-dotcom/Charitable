import {beforeAll,afterAll,it,expect} from 'vitest';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {onRequestPost} from './upload';
let env:{SUPABASE_URL:string;SUPABASE_ANON_KEY:string;SUPABASE_SERVICE_ROLE_KEY:string}; let admin:SupabaseClient,user:SupabaseClient,token='',uid='',family='',caseId='',path='';
const sql=(s:string)=>execFileSync('docker',['exec','-i','supabase_db_charitable-case-system','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:s,stdio:['pipe','pipe','pipe']});
beforeAll(async()=>{
 const status=JSON.parse(execFileSync('npx',['supabase','status','-o','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL)) throw new Error('Local only');
 env={SUPABASE_URL:status.API_URL,SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY};
 admin=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}); user=createClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 const email=`${crypto.randomUUID()}@staff.invalid`,password='synthetic-password-123'; const created=await admin.auth.admin.createUser({email,password,email_confirm:true}); if(created.error || !created.data.user) throw created.error;uid=created.data.user.id;
 sql(`insert into public.employees(id,employee_code,display_name,role) values ('${uid}','U${uid.slice(0,8)}','Synthetic','employee'); insert into private.employee_auth(employee_id,auth_user_id) values ('${uid}','${uid}'); insert into public.employee_permissions(employee_id,cases_write) values ('${uid}',true);`);
 const f=await admin.from('families').insert({name:'وهمي'}).select('id').single();if(f.error)throw f.error;family=f.data.id; const c=await admin.from('cases').insert({family_id:family}).select('id').single();if(c.error)throw c.error;caseId=c.data.id;
 const login=await user.auth.signInWithPassword({email,password});if(login.error||!login.data.session)throw login.error;token=login.data.session.access_token;
});
afterAll(async()=>{if(caseId)await admin.from('case_files').delete().eq('case_id',caseId);if(path)await admin.storage.from('case-files').remove([path]);if(caseId)await admin.from('cases').delete().eq('id',caseId);if(family)await admin.from('families').delete().eq('id',family);if(uid){sql(`delete from private.employee_auth where employee_id='${uid}'; delete from public.employee_permissions where employee_id='${uid}'; delete from public.employees where id='${uid}';`);await admin.auth.admin.deleteUser(uid);}});
function request(name:string,type:string){return new Request('http://localhost/api/case-files/upload',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':type,'x-case-id':caseId,'x-file-name':'synthetic'},body:readFileSync(`tests/fixtures/${name}`)});}
it('blocks direct storage and metadata insertion by a writer',async()=>{
 expect((await user.storage.from('case-files').upload(`${caseId}/${crypto.randomUUID()}`,new Uint8Array([1]),{contentType:'image/png'})).error).toBeTruthy();
 expect((await user.from('case_files').insert({case_id:caseId,storage_path:`${caseId}/${crypto.randomUUID()}`,file_name:'fake',mime_type:'image/png',size_bytes:1,uploaded_by:uid})).error).toBeTruthy();
});
it('denies upload when the session lacks case-write permission',async()=>{
 sql(`update public.employee_permissions set cases_write=false where employee_id='${uid}';`);
 try {expect((await onRequestPost({request:request('arabic-sample.png','image/png'),env})).status).toBe(403);} finally {sql(`update public.employee_permissions set cases_write=true where employee_id='${uid}';`);}
});
it('rejects over-page and MIME-disguised files through the trusted route',async()=>{
 expect((await onRequestPost({request:request('over-20-pages.pdf','application/pdf'),env})).status).toBe(400);
 expect((await onRequestPost({request:request('arabic-sample.png','application/pdf'),env})).status).toBe(400);
});
it('finalizes only a verified uploaded object with actual size and type',async()=>{
 const res=await onRequestPost({request:request('arabic-sample.png','image/png'),env});expect(res.status).toBe(201);const result=await res.json();path=result.storage_path;
 expect(result.mime_type).toBe('image/png');expect(result.size_bytes).toBe(readFileSync('tests/fixtures/arabic-sample.png').length);
 const obj=await user.storage.from('case-files').download(path);expect(obj.error).toBeNull();expect(obj.data?.size).toBe(result.size_bytes);
});
