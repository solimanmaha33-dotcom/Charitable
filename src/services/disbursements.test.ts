import { beforeEach, expect, it, vi } from 'vitest';
import { getSponsorshipFollowups, listCaseDisbursements, recordDisbursement, voidDisbursement } from './disbursements';

const state = vi.hoisted(() => ({
  select:vi.fn(), eq:vi.fn(), order:vi.fn(), range:vi.fn(), rpc:vi.fn(),
}));
vi.mock('./supabase', () => ({ getSupabase:()=>({
  from:()=>({select:state.select,eq:state.eq,order:state.order,range:state.range}),
  rpc:state.rpc,
}) }));

beforeEach(()=>{
  vi.clearAllMocks();
  state.select.mockReturnValue({eq:state.eq});
  state.eq.mockReturnValue({order:state.order});
  state.order.mockReturnValue({order:state.order,range:state.range});
  state.range.mockResolvedValue({data:[],error:null});
  state.rpc.mockResolvedValue({data:'disbursement-1',error:null});
});

it('lists the case payment history, including reversed rows for audit visibility',async()=>{
  await listCaseDisbursements('case-1');
  expect(state.select).toHaveBeenCalledWith('id,case_id,branch_id,disbursement_type,amount,items_summary,disbursed_on,created_by,created_at,notes,is_voided,void_reason,voided_at');
  expect(state.eq).toHaveBeenCalledWith('case_id','case-1');
});

it('saves a validated payout with a case and selected branch',async()=>{
  await recordDisbursement({caseId:'case-1',branchId:'branch-1',type:'مساعدة موسمية',amount:500,itemsSummary:'بطاطين',disbursedOn:'2026-11-09',notes:'ملاحظة'});
  expect(state.rpc).toHaveBeenCalledWith('record_case_disbursement',{
    p_case_id:'case-1',p_branch_id:'branch-1',p_type:'مساعدة موسمية',p_amount:500,p_items_summary:'بطاطين',p_disbursed_on:'2026-11-09',p_notes:'ملاحظة',
  });
  await expect(recordDisbursement({caseId:'case-1',branchId:'branch-1',type:'عيني',amount:0,itemsSummary:'',disbursedOn:'2026-11-09',notes:''})).rejects.toThrow('المبلغ لازم يكون أكبر من صفر');
  await expect(recordDisbursement({caseId:'case-1',branchId:'branch-1',type:'عيني',amount:10,itemsSummary:' ',disbursedOn:'2026-11-09',notes:''})).rejects.toThrow('اكتب وصف المساعدة العينية');
});

it('requires a reason before voiding a payout',async()=>{
  await voidDisbursement('disbursement-1','اتسجل بالغلط');
  expect(state.rpc).toHaveBeenCalledWith('void_case_disbursement',{p_id:'disbursement-1',p_reason:'اتسجل بالغلط'});
  await expect(voidDisbursement('disbursement-1',' ')).rejects.toThrow('سبب الإلغاء مطلوب');
});

it('returns late and next-30-day unpaid installments but skips received, canceled, and archived-file links',()=>{
  const result=getSponsorshipFollowups([
    {id:'late',sponsorship_id:'s1',due_date:'2026-10-31',amount_due:300,received_on:null,voided_at:null},
    {id:'soon',sponsorship_id:'s1',due_date:'2026-11-07',amount_due:300,received_on:null,voided_at:null},
    {id:'received',sponsorship_id:'s1',due_date:'2026-11-07',amount_due:300,received_on:'2026-11-01',voided_at:null},
    {id:'voided',sponsorship_id:'s1',due_date:'2026-11-07',amount_due:300,received_on:null,voided_at:'2026-11-02T00:00:00Z'},
    {id:'archived',sponsorship_id:'s2',due_date:'2026-11-07',amount_due:100,received_on:null,voided_at:null},
  ],[{id:'s1',family_id:'case-1'},{id:'s2',family_id:'case-archived'}],[{id:'case-1',code:'F-1',father_name:'أب',mother_name:'أم'}],'2026-11-01');
  expect(result).toEqual([
    expect.objectContaining({paymentId:'late',status:'late',daysUntilDue:-1,caseCode:'F-1'}),
    expect.objectContaining({paymentId:'soon',status:'upcoming',daysUntilDue:6,caseCode:'F-1'}),
  ]);
});
