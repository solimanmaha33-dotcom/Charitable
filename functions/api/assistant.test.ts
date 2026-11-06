import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../_shared/supabase', async (importOriginal) => ({ ...(await importOriginal<typeof import('../_shared/supabase')>()), staffContext: vi.fn() }));
vi.mock('./aiProvider', () => ({ complete: vi.fn() }));
import { staffContext } from '../_shared/supabase';
import { complete } from './aiProvider';
import { onRequestPost } from './assistant';
const context = () => ({ request: new Request('http://local/api/assistant', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({question:'ما الحالات؟'}) }), env:{} as never });
beforeEach(() => vi.resetAllMocks());
describe('assistant authorization', () => {
 it('denies a missing session before calling the model', async () => {
  vi.mocked(staffContext).mockResolvedValue(null);
  expect((await onRequestPost(context())).status).toBe(401);
  expect(complete).not.toHaveBeenCalled();
 });
 it('denies staff without assistant permission', async () => {
  const client = {rpc: vi.fn().mockResolvedValue({data:false,error:null})};
  vi.mocked(staffContext).mockResolvedValue({client, profile:{}, token:'x'} as never);
  expect((await onRequestPost(context())).status).toBe(403);
  expect(complete).not.toHaveBeenCalled();
 });
});
it('queries only permitted case records using the staff client, with no writes', async () => {
 const queried:string[]=[];
 const client={rpc:vi.fn(async (_name:string,args:{permission:string})=>({data:args.permission!=='donationsRead',error:null})),from:vi.fn((table:string)=>{queried.push(table);return {select:()=>({limit:async()=>({data:[{id:'case-1',notes:'وهمي',families:{code:'F-0001'},case_categories:[],case_files:[]}],error:null})})}})};
 vi.mocked(staffContext).mockResolvedValue({client,profile:{},token:'x'} as never);
 vi.mocked(complete).mockResolvedValue('إجابة وهمية');
 const response=await onRequestPost(context());expect(response.status).toBe(200);expect(queried).toEqual(['cases']);expect(await response.json()).toEqual({answer:'إجابة وهمية',sources:[{familyCode:'F-0001',caseId:'case-1'}]});
});
it('returns a generic error when the model fails',async()=>{
 const client={rpc:vi.fn(async (_:string,args:{permission:string})=>({data:args.permission!=='donationsRead',error:null})),from:()=>({select:()=>({limit:async()=>({data:[{id:'c',families:{code:'F-0001'},case_files:[]}],error:null})})})};
 vi.mocked(staffContext).mockResolvedValue({client,profile:{},token:'x'} as never);vi.mocked(complete).mockRejectedValue(new Error('secret'));const response=await onRequestPost(context());expect(response.status).toBe(502);expect(JSON.stringify(await response.json())).not.toContain('secret');
});
it('uses donations without retrieving case records when only donations are readable',async()=>{
 const queried:string[]=[];const client={rpc:vi.fn(async (_:string,args:{permission:string})=>({data:args.permission!=='casesRead',error:null})),from:(table:string)=>{queried.push(table);return {select:()=>({limit:async()=>({data:[{description:'تبرع وهمي'}],error:null})})}}};
 vi.mocked(staffContext).mockResolvedValue({client,profile:{},token:'x'} as never);vi.mocked(complete).mockResolvedValue('تبرع');const res=await onRequestPost(context());expect(res.status).toBe(200);expect(queried).toEqual(['donations']);expect(JSON.stringify(vi.mocked(complete).mock.calls)).not.toContain('case_files');
});
it('does not contact the model if neither read permission is granted',async()=>{
 const client={rpc:vi.fn(async (_:string,args:{permission:string})=>({data:args.permission==='assistantUse',error:null})),from:vi.fn()};vi.mocked(staffContext).mockResolvedValue({client,profile:{},token:'x'} as never);const res=await onRequestPost(context());expect(res.status).toBe(200);expect(client.from).not.toHaveBeenCalled();expect(complete).not.toHaveBeenCalled();
});
it('does not list a file without reviewed search text as a source',async()=>{
 const client={rpc:vi.fn(async (_:string,args:{permission:string})=>({data:args.permission!=='donationsRead',error:null})),from:()=>({select:()=>({limit:async()=>({data:[{id:'c',families:{code:'F-0001'},case_files:[{file_name:'not-reviewed.png',case_file_search_text:[]}]}],error:null})})})};vi.mocked(staffContext).mockResolvedValue({client,profile:{},token:'x'} as never);vi.mocked(complete).mockResolvedValue('إجابة');const res=await onRequestPost(context());const payload=await res.json();expect(payload.sources).toEqual([{familyCode:'F-0001',caseId:'c'}]);
});
