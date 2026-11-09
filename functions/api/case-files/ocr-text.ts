import {adminClient,body,json,staffContext,type Context} from '../../_shared/supabase';
export async function onRequestPost(context:Context):Promise<Response> {
 try {
  const staff=await staffContext(context); if(!staff) return json({error:'Access denied'},401);
  const permission=await staff.client.rpc('has_permission',{permission:'casesWrite'}); if(permission.error || !permission.data) return json({error:'Access denied'},403);
  const input=await body(context.request,65536);
  if(!input || typeof input.fileId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.fileId) || typeof input.text!=='string' || input.text.length>30000) return json({error:'Invalid request'},400);
  const file=await staff.client.from('case_attachments').select('id').eq('id',input.fileId).maybeSingle(); if(file.error || !file.data) return json({error:'File not found'},404);
  const again=await staff.client.rpc('has_permission',{permission:'casesWrite'}); if(again.error || !again.data) return json({error:'Access denied'},403);
  const result=await adminClient(context.env).from('case_attachments').update({extracted_text:input.text}).eq('id',input.fileId);
  if(result.error) throw result.error; return json({saved:true});
 } catch {return json({error:'Save failed'},503);}
}
