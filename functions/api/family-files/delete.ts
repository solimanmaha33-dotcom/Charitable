import {adminClient,body,json,staffContext,type Context} from '../../_shared/supabase';

export async function onRequestPost(context:Context):Promise<Response> {
 try {
  const staff=await staffContext(context); if(!staff) return json({error:'Access denied'},401);
  const permission=await staff.client.rpc('has_permission',{permission:'casesWrite'}); if(permission.error || !permission.data) return json({error:'Access denied'},403);
  const input=await body(context.request,1024); const fileId=input?.fileId;
  if(typeof fileId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) return json({error:'Invalid file'},400);
  const file=await staff.client.from('family_files').select('id,storage_path').eq('id',fileId).maybeSingle();
  if(file.error || !file.data) return json({error:'File not found'},404);
  const again=await staff.client.rpc('has_permission',{permission:'casesWrite'});if(again.error || !again.data) return json({error:'Access denied'},403);
  const admin=adminClient(context.env); const removed=await admin.storage.from('case-files').remove([file.data.storage_path]);
  if(removed.error) return json({error:'Remove failed'},503);
  const deleted=await admin.from('family_files').delete().eq('id',fileId);
  if(deleted.error) return json({error:'Remove failed'},503);
  return json({ok:true});
 } catch {return json({error:'Remove failed'},503);}
}
