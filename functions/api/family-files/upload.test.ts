import {afterAll,beforeAll,expect,it} from 'vitest';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {onRequestPost as upload} from './upload';
import {onRequestPost as remove} from './delete';

let env:{SUPABASE_URL:string;SUPABASE_ANON_KEY:string;SUPABASE_SERVICE_ROLE_KEY:string};
let admin:SupabaseClient,user:SupabaseClient,token='',uid='',family='',path='',fileId='';
const sql=(s:string)=>execFileSync('docker',['exec','-i','supabase_db_charitable-case-system','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:s,stdio:['pipe','pipe','pipe']});
beforeAll(async()=>{
 const status=JSON.parse(execFileSync('npx',['supabase','status','-o','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL)) throw new Error('Local only');
 env={SUPABASE_URL:status.API_URL,SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY};
 admin=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});user=createClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 const email=`${crypto.randomUUID()}@staff.invalid`,password='synthetic-password-123';const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error||!created.data.user)throw created.error;uid=created.data.user.id;
 sql(`insert into public.employees(id,employee_code,display_name,role) values ('${uid}','F${uid.slice(0,8)}','Synthetic','employee'); insert into private.employee_auth(employee_id,auth_user_id) values ('${uid}','${uid}'); insert into public.employee_permissions(employee_id,cases_read,cases_write) values ('${uid}',true,true);`);
 const f=await admin.from('families').insert({name:'',mother_name:'أم وهمية'}).select('id').single();if(f.error)throw f.error;family=f.data.id;
 const login=await user.auth.signInWithPassword({email,password});if(login.error||!login.data.session)throw login.error;token=login.data.session.access_token;
});
afterAll(async()=>{if(fileId)await admin.from('case_attachments').delete().eq('id',fileId);if(path)await admin.storage.from('case-files').remove([path]);if(family)await admin.from('families').delete().eq('id',family);if(uid){sql(`delete from private.employee_auth where employee_id='${uid}'; delete from public.employee_permissions where employee_id='${uid}'; delete from public.employees where id='${uid}';`);await admin.auth.admin.deleteUser(uid);}});
function uploadRequest(name='arabic-sample.png',type='image/png'){return new Request('http://localhost/api/family-files/upload',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':type,'x-family-id':family,'x-file-name':'synthetic'},body:readFileSync(`tests/fixtures/${name}`)});}
it('requires write permission and rejects invalid or mismatched files',async()=>{
 expect((await upload({request:new Request('http://localhost/api/family-files/upload',{method:'POST'}),env})).status).toBe(401);
 expect((await remove({request:new Request('http://localhost/api/family-files/delete',{method:'POST'}),env})).status).toBe(401);
 sql(`update public.employee_permissions set cases_write=false where employee_id='${uid}';`);
 try {expect((await upload({request:uploadRequest(),env})).status).toBe(403);} finally {sql(`update public.employee_permissions set cases_write=true where employee_id='${uid}';`);}
 expect((await upload({request:uploadRequest('arabic-sample.png','application/pdf'),env})).status).toBe(400);
 expect((await upload({request:new Request('http://localhost/api/family-files/upload',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'image/png','x-family-id':'bad','x-file-name':'file.png'},body:new Uint8Array([1])}),env})).status).toBe(400);
});
it('stores only inspected family attachments in private storage and removes them on request',async()=>{
 const response=await upload({request:uploadRequest(),env});expect(response.status).toBe(201);const result=await response.json() as {id:string;family_id:string;storage_path:string;mime_type:string;size_bytes:number};fileId=result.id;path=result.storage_path;
 expect(result.family_id).toBe(family);expect(result.mime_type).toBe('image/png');expect(result.size_bytes).toBe(readFileSync('tests/fixtures/arabic-sample.png').length);
 expect((await user.storage.from('case-files').download(path)).error).toBeNull();
 const deleted=await remove({request:new Request('http://localhost/api/family-files/delete',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({fileId})}),env});expect(deleted.status).toBe(200);
 fileId='';path='';expect((await admin.from('case_attachments').select('id').eq('id',result.id)).data).toEqual([]);expect((await admin.storage.from('case-files').download(result.storage_path)).error).toBeTruthy();
});
