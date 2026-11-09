import {adminClient,json,staffContext,type Context} from '../../_shared/supabase';
import {inspectUpload,MAX_BYTES} from './inspection';
async function readBounded(request:Request):Promise<Uint8Array> {
 if(Number(request.headers.get('content-length'))>MAX_BYTES) throw new Error('Too large');
 const reader=request.body?.getReader(); if(!reader) throw new Error('Missing body');
 const chunks:Uint8Array[]=[]; let total=0;
 while(true){const {done,value}=await reader.read(); if(done)break; total+=value.byteLength; if(total>MAX_BYTES){await reader.cancel();throw new Error('Too large');} chunks.push(value);}
 const bytes=new Uint8Array(total); let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}return bytes;
}
export async function onRequestPost(context:Context):Promise<Response> {
 try {
  const staff=await staffContext(context); if(!staff) return json({error:'Access denied'},401);
  const permission=await staff.client.rpc('has_permission',{permission:'casesWrite'}); if(permission.error || !permission.data) return json({error:'Access denied'},403);
  const caseFileId=context.request.headers.get('x-case-file-id') ?? context.request.headers.get('x-family-id') ?? ''; const encoded=context.request.headers.get('x-file-name') ?? '';
  let name='';try{name=decodeURIComponent(encoded);}catch{return json({error:'Invalid file'},400);}
  const mime=context.request.headers.get('content-type') ?? '';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseFileId) || !name || name.length>255 || /[\u0000-\u001f\u007f]/.test(name)) return json({error:'Invalid file'},400);
  const record=await staff.client.from('families').select('id,archived_at').eq('id',caseFileId).maybeSingle();if(record.error || !record.data || record.data.archived_at!==null) return json({error:'Case file not found'},404);
  let bytes:Uint8Array;try{bytes=await readBounded(context.request);await inspectUpload(bytes,mime);}catch{return json({error:'Invalid file'},400);}
  const {data:{user},error:userError}=await staff.client.auth.getUser(staff.token);if(userError || !user) return json({error:'Access denied'},401);
  const again=await staff.client.rpc('has_permission',{permission:'casesWrite'});if(again.error || !again.data) return json({error:'Access denied'},403);
  const admin=adminClient(context.env); const path=`${caseFileId}/${crypto.randomUUID()}`; const bucket=admin.storage.from('case-files');
  const uploaded=await bucket.upload(path,bytes,{contentType:mime,upsert:false});if(uploaded.error) return json({error:'Upload failed'},503);
  const metadata=await admin.from('case_attachments').insert({family_id:caseFileId,storage_path:path,file_name:name,mime_type:mime,size_bytes:bytes.byteLength,uploaded_by:user.id}).select().single();
  if(metadata.error || !metadata.data){await bucket.remove([path]);return json({error:'Upload failed'},503);}
  return json(metadata.data,201);
 } catch {return json({error:'Upload failed'},503);}
}
