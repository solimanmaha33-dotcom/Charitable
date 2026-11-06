import { expect, it, vi } from 'vitest';
import { listDonors, listDonations, listSponsorships, listPayments } from '../../services/donations';
// The API caps each response; fake transport retains that behavior while exercising pagination.
vi.mock('../../services/supabase', () => ({ getSupabase: () => {
 const query = () => {
  let start=0, end=999;
  const q={select:()=>q,order:()=>q,range:(a:number,b:number)=>{start=a;end=b;return q;},then:(resolve:(r:unknown)=>unknown)=>Promise.resolve({data:Array.from({length:1001},(_,i)=>({id:String(i)})).slice(start,end+1),error:null}).then(resolve)};
  return q;
 };
 return {from:query,rpc:query};
}}));
it('includes rows after the default API cap for donors, donations, sponsorships, payments', async () => {
 for (const list of [listDonors,listDonations,listSponsorships,listPayments]) {
  const rows=await list(); expect(rows).toHaveLength(1001); expect(rows[1000].id).toBe('1000');
 }
});
