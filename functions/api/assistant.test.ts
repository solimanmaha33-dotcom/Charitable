import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../_shared/supabase', async (importOriginal) => ({ ...(await importOriginal<typeof import('../_shared/supabase')>()), staffContext: vi.fn() }));
vi.mock('./aiProvider', () => ({ complete: vi.fn() }));
import { staffContext } from '../_shared/supabase';
import { complete } from './aiProvider';
import { onRequestPost } from './assistant';
const context = () => ({ request: new Request('http://local/api/assistant', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({question:'ما الحالات؟'}) }), env:{} as never });
beforeEach(() => vi.resetAllMocks());
function adapt(client:any){return {...client,rpc:(name:string,args:unknown)=>name==='assistant_search_cases' || name==='assistant_search_donations' ? client.from(name==='assistant_search_cases'?'cases':'donations').select().limit(50) : client.rpc(name,args)}}
describe('assistant authorization', () => {
 it('denies a missing session before calling the model', async () => {
  vi.mocked(staffContext).mockResolvedValue(null);
  expect((await onRequestPost(context())).status).toBe(401);
  expect(complete).not.toHaveBeenCalled();
 });
 it('denies staff without assistant permission', async () => {
  const client = {rpc: vi.fn().mockResolvedValue({data:false,error:null})};
  vi.mocked(staffContext).mockResolvedValue({client:adapt(client), profile:{}, token:'x'} as never);
  expect((await onRequestPost(context())).status).toBe(403);
  expect(complete).not.toHaveBeenCalled();
 });
});
it('queries only permitted case records using the staff client, with no writes', async () => {
 const queried:string[]=[];
 const client={rpc:vi.fn(async (_name:string,args:{permission:string})=>({data:args.permission!=='donationsRead',error:null})),from:vi.fn((table:string)=>{queried.push(table);return {select:()=>({limit:async()=>({data:[{id:'case-1',notes:'وهمي',case_file:{code:'F-0001'},case_file_categories:[],case_attachments:[]}],error:null})})}})};
 vi.mocked(staffContext).mockResolvedValue({client:adapt(client),profile:{},token:'x'} as never);
 vi.mocked(complete).mockResolvedValue('إجابة وهمية');
 const response=await onRequestPost(context());expect(response.status).toBe(200);expect(queried).toEqual(['cases']);expect(await response.json()).toMatchObject({answer:'إجابة وهمية',sources:[{caseFileCode:'F-0001',caseId:'case-1'}],coverage:{partial:true}});
});
it('returns a generic error when the model fails',async()=>{
 const client={rpc:vi.fn(async (_:string,args:{permission:string})=>({data:args.permission!=='donationsRead',error:null})),from:()=>({select:()=>({limit:async()=>({data:[{id:'c',case_file:{code:'F-0001'},case_attachments:[]}],error:null})})})};
 vi.mocked(staffContext).mockResolvedValue({client:adapt(client),profile:{},token:'x'} as never);vi.mocked(complete).mockRejectedValue(new Error('secret'));const response=await onRequestPost(context());expect(response.status).toBe(502);expect(JSON.stringify(await response.json())).not.toContain('secret');
});
it('uses donations without retrieving case records when only donations are readable',async()=>{
 const queried:string[]=[];const client={rpc:vi.fn(async (_:string,args:{permission:string})=>({data:args.permission!=='casesRead',error:null})),from:(table:string)=>{queried.push(table);return {select:()=>({limit:async()=>({data:[{description:'تبرع وهمي'}],error:null})})}}};
 vi.mocked(staffContext).mockResolvedValue({client:adapt(client),profile:{},token:'x'} as never);vi.mocked(complete).mockResolvedValue('تبرع');const res=await onRequestPost(context());expect(res.status).toBe(200);expect(queried).toEqual(['donations']);expect(JSON.stringify(vi.mocked(complete).mock.calls)).not.toContain('case_attachments');
});
it('does not contact the model if neither read permission is granted',async()=>{
 const client={rpc:vi.fn(async (_:string,args:{permission:string})=>({data:args.permission==='assistantUse',error:null})),from:vi.fn()};vi.mocked(staffContext).mockResolvedValue({client:adapt(client),profile:{},token:'x'} as never);const res=await onRequestPost(context());expect(res.status).toBe(200);expect(client.from).not.toHaveBeenCalled();expect(complete).not.toHaveBeenCalled();
});
it('does not list a file without reviewed search text as a source',async()=>{
 const client={rpc:vi.fn(async (_:string,args:{permission:string})=>({data:args.permission!=='donationsRead',error:null})),from:()=>({select:()=>({limit:async()=>({data:[{id:'c',case_file:{code:'F-0001'},case_attachments:[{file_name:'not-reviewed.png',case_file_search_text:[]}]}],error:null})})})};vi.mocked(staffContext).mockResolvedValue({client:adapt(client),profile:{},token:'x'} as never);vi.mocked(complete).mockResolvedValue('إجابة');const res=await onRequestPost(context());const payload=await res.json();expect(payload.sources).toEqual([{caseFileCode:'F-0001',caseId:'c'}]);
});
it('instructs the model to decline aid allocation, ranking and claims of completed changes',async()=>{
 const client={rpc:vi.fn(async (_:string,args:{permission:string})=>({data:args.permission!=='donationsRead',error:null})),from:()=>({select:()=>({limit:async()=>({data:[{id:'c',notes:'وهمي',case_file:{code:'F-0001'},case_attachments:[]}],error:null})})})};vi.mocked(staffContext).mockResolvedValue({client:adapt(client),profile:{},token:'x'} as never);vi.mocked(complete).mockResolvedValue('تحتاج القرارات إلى موظف');await onRequestPost(context());const policy=vi.mocked(complete).mock.calls[0][1];expect(policy).toMatch(/recipient selection/i);expect(policy).toMatch(/ranking/i);expect(policy).toMatch(/eligibility/i);expect(policy).toMatch(/completed changes/i);expect(policy).toMatch(/decline/i);
});
it('passes the question to relevant retrieval and discloses incomplete context',async()=>{
 const rpc=vi.fn(async (name:string,args:Record<string,unknown>)=>name==='has_permission'?{data:args.permission==='assistantUse'||args.permission==='casesRead',error:null}:{data:[{id:'later',notes:'متأخر',case_file:{code:'F-0099'},case_attachments:[]}],error:null});const client={rpc,from:()=>({select:()=>({limit:async()=>({data:[],error:null})})})};vi.mocked(staffContext).mockResolvedValue({client,profile:{},token:'x'} as never);vi.mocked(complete).mockResolvedValue('بيانات جزئية');const res=await onRequestPost(context());expect(rpc).toHaveBeenCalledWith('assistant_search_cases',{p_question:'ما الحالات؟'});expect((await res.json()).coverage.partial).toBe(true);expect(JSON.stringify(vi.mocked(complete).mock.calls)).toMatch(/partial/i);
});
it('bounds oversized retrieved content before calling the model',async()=>{
 const row={id:'c',case_file:{code:'F-0001'},notes:'س'.repeat(100000),case_attachments:[]};const rpc=vi.fn(async(name:string,args:Record<string,unknown>)=>name==='has_permission'?{data:args.permission!=='donationsRead',error:null}:{data:[row],error:null});const client={rpc,from:()=>({select:()=>({limit:async()=>({data:[row],error:null})})})};vi.mocked(staffContext).mockResolvedValue({client,profile:{},token:'x'} as never);vi.mocked(complete).mockResolvedValue('بيانات');await onRequestPost(context());expect(vi.mocked(complete).mock.calls[0][2].length).toBeLessThanOrEqual(16000);
});
