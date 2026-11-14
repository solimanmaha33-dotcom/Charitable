import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { CaseDisbursementsPanel } from './CaseDisbursementsPanel';
import type { CaseFile } from '../../services/cases';
import { cairoToday } from '../../shared/cairoDate';

const state=vi.hoisted(()=>({branches:vi.fn(),record:vi.fn(),void:vi.fn()}));
vi.mock('../../services/branches',()=>({listBranches:state.branches}));
vi.mock('../../services/disbursements',()=>({DISBURSEMENT_TYPES:['كفالة شهرية','مساعدة موسمية','علاج','عيني','طوارئ'],recordDisbursement:state.record,voidDisbursement:state.void}));
const caseFile={id:'case-1',code:'F-0001',branch_area:'القاهرة - المرج'} as CaseFile;

beforeEach(()=>{vi.clearAllMocks();state.branches.mockResolvedValue([{id:'branch-1',name:'القاهرة - المرج'}]);state.record.mockResolvedValue('row-1');state.void.mockResolvedValue(undefined);});

it('records an aid payment for the case using its active branch',async()=>{
 const onChanged=vi.fn(async()=>{});render(<CaseDisbursementsPanel caseFile={caseFile} records={[]} canWrite onChanged={onChanged}/>);
 fireEvent.click(screen.getByText('تسجيل مساعدة منصرفة'));
 fireEvent.change(screen.getByLabelText('المبلغ بالجنيه'),{target:{value:'500'}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'حفظ المساعدة'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'حفظ المساعدة'}));
 await waitFor(()=>expect(state.record).toHaveBeenCalledWith({caseId:'case-1',branchId:'branch-1',type:'مساعدة موسمية',amount:500,itemsSummary:'',disbursedOn:expect.any(String),notes:''}));
 expect(onChanged).toHaveBeenCalledOnce();
});

it('requires an item description for in-kind aid and keeps canceled history visible',async()=>{
 const onChanged=vi.fn(async()=>{});const {rerender}=render(<CaseDisbursementsPanel caseFile={caseFile} records={[]} canWrite onChanged={onChanged}/>);
 fireEvent.click(screen.getByText('تسجيل مساعدة منصرفة'));
 fireEvent.change(screen.getByLabelText('نوع المساعدة'),{target:{value:'عيني'}});
 expect(screen.getByLabelText('وصف المساعدة العينية')).toBeRequired();
 rerender(<CaseDisbursementsPanel caseFile={caseFile} records={[{id:'row-2',case_id:'case-1',branch_id:'branch-1',disbursement_type:'علاج',amount:200,items_summary:null,disbursed_on:'2026-11-01',created_by:'staff-1',created_at:'2026-11-01T10:00:00Z',notes:null,is_voided:true,void_reason:'اتسجل بالغلط',voided_at:'2026-11-02T00:00:00Z'}]} canWrite onChanged={onChanged}/>);
 expect(await screen.findByText('ملغي')).toBeVisible();expect(screen.getByText('سبب الإلغاء: اتسجل بالغلط')).toBeVisible();
});

it('shows a current-month total and explains the printed beneficiary signature',()=>{
 const today=cairoToday();const lastMonth=new Date(`${today}T00:00:00Z`);lastMonth.setUTCMonth(lastMonth.getUTCMonth()-1);const oldDate=lastMonth.toISOString().slice(0,10);
 render(<CaseDisbursementsPanel caseFile={caseFile} records={[
  {id:'active',case_id:'case-1',branch_id:'branch-1',disbursement_type:'علاج',amount:350.5,items_summary:null,disbursed_on:today,created_by:'staff',created_at:`${today}T10:00:00Z`,notes:null,is_voided:false,void_reason:null,voided_at:null},
  {id:'old',case_id:'case-1',branch_id:'branch-1',disbursement_type:'علاج',amount:900,items_summary:null,disbursed_on:oldDate,created_by:'staff',created_at:`${oldDate}T10:00:00Z`,notes:null,is_voided:false,void_reason:null,voided_at:null},
  {id:'void',case_id:'case-1',branch_id:'branch-1',disbursement_type:'علاج',amount:1000,items_summary:null,disbursed_on:today,created_by:'staff',created_at:`${today}T10:00:00Z`,notes:null,is_voided:true,void_reason:'ملغي',voided_at:`${today}T11:00:00Z`},
 ]} canWrite={false} onChanged={vi.fn(async()=>{})}/>);
 expect(screen.getByLabelText('ملخص مساعدات الشهر الحالي')).toHaveTextContent('عدد المساعدات: ١ · الإجمالي ٣٥٠٫٥ جنيه');
 expect(screen.getByLabelText('ملخص مساعدات الشهر الحالي')).toHaveTextContent('بعد الصرف، اطبع النموذج وخد توقيع المستفيد.');
});
