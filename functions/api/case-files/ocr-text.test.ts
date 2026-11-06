import {expect,it,vi} from 'vitest';
vi.mock('../../_shared/supabase',async (original)=>({...await original<typeof import('../../_shared/supabase')>(),staffContext:vi.fn()}));
import {staffContext} from '../../_shared/supabase';
import {onRequestPost} from './ocr-text';
it('denies saving reviewed OCR without case write permission',async()=>{vi.mocked(staffContext).mockResolvedValue({client:{rpc:vi.fn().mockResolvedValue({data:false,error:null})},profile:{},token:'x'} as never);const response=await onRequestPost({request:new Request('http://local',{method:'POST'}),env:{} as never});expect(response.status).toBe(403)});
