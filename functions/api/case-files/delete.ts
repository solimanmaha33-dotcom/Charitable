import { adminClient, body, json, staffContext, type Context } from '../../_shared/supabase';

export async function onRequestPost(context:Context):Promise<Response>{
 try{
  const staff=await staffContext(context);if(!staff)return json({error:'Access denied'},401);
  const permission=await staff.client.rpc('has_permission',{permission:'casesWrite'});if(permission.error||!permission.data)return json({error:'Access denied'},403);
  const input=await body(context.request,1024);const fileId=input?.fileId;
  if(typeof fileId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId))return json({error:'Invalid file'},400);
  const again=await staff.client.rpc('has_permission',{permission:'casesWrite'});if(again.error||!again.data)return json({error:'Access denied'},403);
  const begun=await staff.client.rpc('begin_case_attachment_delete',{p_id:fileId});if(begun.error)return json({error:'File not found'},404);
  const deletion=begun.data as {done?:boolean;storage_path?:string;deletion_token?:string}|null;
  if(!deletion||deletion.done)return json({ok:true});
  if(!deletion.storage_path||!deletion.deletion_token)return json({error:'Remove failed'},503);
  const removed=await adminClient(context.env).storage.from('case-files').remove([deletion.storage_path]);
  // Keep the metadata and its retry token on any failure; this also blocks
  // archiving until the same request can finish safely.
  if(removed.error)return json({error:'Remove failed'},503);
  const finished=await adminClient(context.env).rpc('finish_case_attachment_delete',{p_id:fileId,p_deletion_token:deletion.deletion_token});
  if(finished.error)return json({error:'Remove failed'},503);
  return json({ok:true});
 }catch{return json({error:'Remove failed'},503);}
}
