import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { CaseIntakeForm } from './CaseIntakeForm';
import { saveCaseFile } from '../../services/cases';
import { ageOn } from './memberAge';
import { cairoToday } from './idExpiry';

const branchState = vi.hoisted(() => ({
  branches: [{id:'branch-cairo',name:'القاهرة - المرج'}, {id:'branch-fayoum',name:'الفيوم - جبل النجار'}],
  inactiveBranches: [{id:'branch-old',name:'فرع قديم'}],
  listBranches: vi.fn(async () => [...branchState.branches]),
  listInactiveBranches: vi.fn(async () => [...branchState.inactiveBranches]),
  addBranch: vi.fn(async (name: string) => { branchState.branches.push({id:`branch-${branchState.branches.length}`,name}); }),
  deactivateBranch: vi.fn(async (id: string) => { const branch = branchState.branches.find((item) => item.id === id); if (branch) { branchState.branches = branchState.branches.filter((item) => item.id !== id); branchState.inactiveBranches.push(branch); } }),
  reactivateBranch: vi.fn(async (id: string) => { const branch = branchState.inactiveBranches.find((item) => item.id === id); if (branch) { branchState.inactiveBranches = branchState.inactiveBranches.filter((item) => item.id !== id); branchState.branches.push(branch); } }),
}));
vi.mock('../../services/cases', () => ({ saveCaseFile: vi.fn().mockResolvedValue('file-1'), uploadCaseAttachment: vi.fn() }));
vi.mock('../files/FilePicker', () => ({ FilePicker: ({ onText }: { onText: (text:string)=>void }) => <button type="button" onClick={() => onText('الرقم القومي: ٣٢٤٠٢٢٩١٢٣٤٥٧٧')}>قراءة رقم قومي تجريبي</button> }));
vi.mock('../../services/branches', () => ({ listBranches: branchState.listBranches, listInactiveBranches: branchState.listInactiveBranches, addBranch: branchState.addBranch, deactivateBranch: branchState.deactivateBranch, reactivateBranch: branchState.reactivateBranch }));
beforeEach(() => { vi.clearAllMocks(); branchState.branches = [{id:'branch-cairo',name:'القاهرة - المرج'}, {id:'branch-fayoum',name:'الفيوم - جبل النجار'}]; branchState.inactiveBranches = [{id:'branch-old',name:'فرع قديم'}]; });

it('creates one file without a family-name field and saves status, reason and profile in one call', async () => {
  const onSaved = vi.fn(); render(<CaseIntakeForm onSaved={onSaved} />);
  expect(screen.queryByLabelText(/اسم الأسرة/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('أرملة'));
  fireEvent.change(screen.getByLabelText('اسم الأم (مطلوب)'), { target: { value: 'منى' } });
  fireEvent.change(screen.getByLabelText('حالة الملف'), { target: { value: 'موقوف' } });
  fireEvent.change(screen.getByLabelText('سبب الإيقاف'), { target: { value: 'مراجعة الأوراق' } });
  fireEvent.change(screen.getByLabelText('العنوان'), { target: { value: 'شارع النيل' } });
  fireEvent.change(screen.getByLabelText('الدخل الشهري بالجنيه'), { target: { value: '2500' } });
  fireEvent.change(screen.getByLabelText('الحالة الصحية العامة للأسرة'), { target: { value: 'تحتاج متابعة' } });
  fireEvent.change(screen.getByLabelText('رقم الموبايل 2'), { target: { value: '01000000002' } });
 fireEvent.click(screen.getByRole('button', { name: 'حفظ ملف الحالة' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('file-1'));
  expect(saveCaseFile).toHaveBeenCalledWith(null, expect.objectContaining({ motherName: 'منى', fatherName: '', address: 'شارع النيل', monthlyIncome: 2500, healthCondition: 'تحتاج متابعة', phones: ['', '01000000002', ''], fileStatus: 'موقوف', statusReason: 'مراجعة الأوراق', categories: ['أرملة'] }));
});

it('offers another case type and makes abandonment, widowhood and divorce mutually exclusive',()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 expect(screen.getByLabelText('أخرى')).toBeInTheDocument();
 fireEvent.click(screen.getByLabelText('هجر'));
 expect(screen.getByLabelText('هجر')).toBeChecked();
 fireEvent.click(screen.getByLabelText('أرملة'));
 expect(screen.getByLabelText('أرملة')).toBeChecked();
 expect(screen.getByLabelText('هجر')).not.toBeChecked();
 fireEvent.click(screen.getByLabelText('مطلقة'));
 expect(screen.getByLabelText('مطلقة')).toBeChecked();
 expect(screen.getByLabelText('أرملة')).not.toBeChecked();
});

it('shows exactly the requested three health options for each parent',()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 for(const label of ['الحالة الصحية للأب','الحالة الصحية للأم']){
  expect(within(screen.getByLabelText(label)).getAllByRole('option').map(option=>option.textContent)).toEqual(['اختار الحالة الصحية','عجز / إعاقة','مرض','حالة مستقرة']);
 }
});

it('hides father fields for a widow and saves both parent national IDs and individual health notes',async()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 fireEvent.click(screen.getByLabelText('أرملة'));
 expect(screen.queryByLabelText('اسم الأب (اختياري)')).not.toBeInTheDocument();
 expect(screen.queryByLabelText('الرقم القومي للأب')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('اسم الأم (مطلوب)'),{target:{value:'منى'}});
 fireEvent.change(screen.getByLabelText('الرقم القومي للأم'),{target:{value:'٢٩٠٠١٠١١٢٣٤٥٦٧'}});
 fireEvent.change(screen.getByLabelText('الحالة الصحية للأم'),{target:{value:'مرض'}});
 fireEvent.change(screen.getByLabelText('نوع العجز أو الإعاقة أو المرض للأم'),{target:{value:'ضغط'}});
 fireEvent.change(screen.getByLabelText('الحالة الصحية العامة للأسرة'),{target:{value:'متابعة دورية'}});
 fireEvent.change(screen.getByLabelText('رقم الموبايل 1'),{target:{value:'01012345678'}});
 fireEvent.click(screen.getByRole('button',{name:'حفظ ملف الحالة'}));
 await waitFor(()=>expect(saveCaseFile).toHaveBeenCalledWith(null,expect.objectContaining({motherName:'منى',motherNationalId:'29001011234567',motherHealthStatus:'مرض',motherHealthCondition:'ضغط',fatherName:'',fatherNationalId:'',healthCondition:'متابعة دورية'})));
});

it('fills the mother birth date and gender from a valid typed national ID',()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('الرقم القومي للأم'),{target:{value:'٣٢٠٠١٠٢٢١٣٤٥٦٨'}});
 expect(screen.getByLabelText('تاريخ ميلاد الأم')).toHaveValue('2020-01-02');
 expect(screen.getByLabelText('نوع الأم')).toHaveValue('female');
 expect(screen.getByText('المحافظة الظاهرة في الرقم: الجيزة (للمراجعة بس)')).toBeVisible();
 expect(screen.getByText(new RegExp(`العمر: ${new Intl.NumberFormat('ar-EG').format(ageOn('2020-01-02',cairoToday()))} سنة`))).toBeVisible();
 fireEvent.change(screen.getByLabelText('نوع الأم'),{target:{value:'male'}});
 expect(screen.getByLabelText('نوع الأم')).toHaveValue('male');
});

it('keeps corrected parent demographics when the saved ID is entered again',()=>{
 const initial={id:'f1',code:'F-0001',archived_at:null,phone:'01012345678',phone_2:null,phone_3:null,father_name:null,mother_name:'منى',father_national_id:null,mother_national_id:'29001011234567',father_date_of_birth:null,father_gender:null,mother_date_of_birth:'1990-01-01',mother_gender:'female' as const,contact_name:null,contact_relationship:null,contact_age:null,national_id:null,national_id_expires_on:null,notes:'',address:null,monthly_income:null,health_condition:null,branch_area:null,file_status:'نشط' as const,status_reason:null,case_file_categories:[{category:'أرملة' as const}]};
 render(<CaseIntakeForm initial={initial} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('تاريخ ميلاد الأم'),{target:{value:'2001-02-03'}});
 fireEvent.change(screen.getByLabelText('نوع الأم'),{target:{value:'male'}});
 fireEvent.change(screen.getByLabelText('الرقم القومي للأم'),{target:{value:'290'}});
 fireEvent.change(screen.getByLabelText('الرقم القومي للأم'),{target:{value:'29001011234567'}});
 expect(screen.getByLabelText('تاريخ ميلاد الأم')).toHaveValue('2001-02-03');
 expect(screen.getByLabelText('نوع الأم')).toHaveValue('male');
});

it('fills the guardian age, birth date, and gender from the case ID',()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('الرقم القومي (اختياري)'),{target:{value:'29001011234577'}});
 expect(screen.getByLabelText('تاريخ ميلاد المسؤول')).toHaveValue('1990-01-01');
 expect(screen.getByLabelText('نوع المسؤول')).toHaveValue('male');
 expect(screen.getByLabelText('سن المسؤول (اختياري)')).toHaveValue(ageOn('1990-01-01',cairoToday()));
});

it('lets staff assign a scanned ID to a household person before applying it',()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'قراءة رقم قومي تجريبي'}));
 expect(screen.getByLabelText('دي بطاقة مين؟')).toBeVisible();
 fireEvent.change(screen.getByLabelText('دي بطاقة مين؟'),{target:{value:'guardian'}});
 fireEvent.click(screen.getByRole('button',{name:'استخدم البيانات المقروءة'}));
 expect(screen.getByLabelText('الرقم القومي (اختياري)')).toHaveValue('32402291234577');
 expect(screen.getByLabelText('تاريخ ميلاد المسؤول')).toHaveValue('2024-02-29');
 expect(screen.getByLabelText('نوع المسؤول')).toHaveValue('male');
});

it('restores father name and national ID fields when widow category is removed without losing their values',()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('اسم الأب (اختياري)'),{target:{value:'محمود'}});
 fireEvent.change(screen.getByLabelText('الرقم القومي للأب'),{target:{value:'٢٨٠٠١٠١١٢٣٤٥٦٧'}});
 fireEvent.click(screen.getByLabelText('أرملة'));
 expect(screen.queryByLabelText('اسم الأب (اختياري)')).not.toBeInTheDocument();
 fireEvent.click(screen.getByLabelText('أرملة'));
 expect(screen.getByLabelText('اسم الأب (اختياري)')).toHaveValue('محمود');
 expect(screen.getByLabelText('الرقم القومي للأب')).toHaveValue('28001011234567');
});

it.each(['أرملة', 'هجر', 'مطلقة'])('hides the whole guardian section for %s and restores entered values when removed', (category) => {
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('اسم المسؤول'), {target:{value:'الجدة'}});
 fireEvent.change(screen.getByLabelText('صلة القرابة'), {target:{value:'الجدة'}});
 fireEvent.click(screen.getByLabelText(category));
 expect(screen.queryByLabelText('اسم المسؤول')).not.toBeInTheDocument();
 expect(screen.queryByLabelText('صلة القرابة')).not.toBeInTheDocument();
 expect(screen.queryByLabelText('سن المسؤول (اختياري)')).not.toBeInTheDocument();
 expect(screen.queryByLabelText('الرقم القومي (اختياري)')).not.toBeInTheDocument();
 fireEvent.click(screen.getByLabelText(category));
 expect(screen.getByLabelText('اسم المسؤول')).toHaveValue('الجدة');
 expect(screen.getByLabelText('صلة القرابة')).toHaveValue('الجدة');
});

it('saves employment status and shows work type only for employed parents',async()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('اسم الأم (مطلوب)'),{target:{value:'منى'}});
 fireEvent.click(screen.getByLabelText('أرملة'));
 fireEvent.change(screen.getByLabelText('حالة عمل الأم'),{target:{value:'يعمل'}});
 expect(screen.getByLabelText('نوع عمل الأم')).toBeVisible();
 fireEvent.change(screen.getByLabelText('نوع عمل الأم'),{target:{value:'خياطة'}});
 fireEvent.change(screen.getByLabelText('رقم الموبايل 1'),{target:{value:'01012345678'}});
 fireEvent.click(screen.getByRole('button',{name:'حفظ ملف الحالة'}));
 await waitFor(()=>expect(saveCaseFile).toHaveBeenCalledWith(null,expect.objectContaining({motherEmploymentStatus:'يعمل',motherOccupation:'خياطة'})));
 fireEvent.change(screen.getByLabelText('حالة عمل الأم'),{target:{value:'طفلة'}});
 expect(screen.queryByLabelText('نوع عمل الأم')).not.toBeInTheDocument();
});

it('requires at least one phone and accepts digits only with the correct lengths',async()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 fireEvent.click(screen.getByLabelText('أرملة'));
 fireEvent.change(screen.getByLabelText('اسم الأم (مطلوب)'),{target:{value:'منى'}});
 fireEvent.click(screen.getByRole('button',{name:'حفظ ملف الحالة'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('اكتب رقم موبايل أو رقم منزل واحد على الأقل');
 expect(saveCaseFile).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('رقم الموبايل 1'),{target:{value:'٠١٠١٢٣٤٥٦٧٨abc'}});
 expect(screen.getByLabelText('رقم الموبايل 1')).toHaveValue('01012345678');
 fireEvent.change(screen.getByLabelText('رقم الموبايل 2'),{target:{value:'0101234567'}});
 fireEvent.click(screen.getByRole('button',{name:'حفظ ملف الحالة'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('رقم الموبايل لازم يكون ١١ رقم');
 fireEvent.change(screen.getByLabelText('رقم المنزل'),{target:{value:'2233445566'}});
 fireEvent.change(screen.getByLabelText('رقم الموبايل 2'),{target:{value:''}});
 fireEvent.click(screen.getByRole('button',{name:'حفظ ملف الحالة'}));
 await waitFor(()=>expect(saveCaseFile).toHaveBeenCalledWith(null,expect.objectContaining({phones:['01012345678','','2233445566']})));
});

it('manages shared branch choices in a dialog and keeps a deactivated branch on an existing file',async()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 const select=await screen.findByLabelText('الفرع أو المنطقة');
 expect(select).toHaveTextContent('القاهرة - المرج');
 expect(select).toHaveTextContent('الفيوم - جبل النجار');
 fireEvent.change(select,{target:{value:'__manage_branches__'}});
 expect(screen.getByRole('dialog',{name:'إدارة الفروع'})).toBeVisible();
 fireEvent.change(screen.getByLabelText('اسم الفرع الجديد'),{target:{value:'فرع جديد'}});
 fireEvent.click(screen.getByRole('button',{name:'إضافة الفرع'}));
 await waitFor(()=>expect(branchState.addBranch).toHaveBeenCalledWith('فرع جديد'));
 expect(await within(screen.getByRole('dialog')).findByText('فرع جديد')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'إيقاف فرع القاهرة - المرج'}));
 await waitFor(()=>expect(branchState.deactivateBranch).toHaveBeenCalledWith('branch-cairo'));
 expect(screen.queryByRole('button',{name:'إيقاف فرع القاهرة - المرج'})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'إعادة تشغيل فرع القاهرة - المرج'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'إعادة تشغيل فرع القاهرة - المرج'}));
 await waitFor(()=>expect(branchState.reactivateBranch).toHaveBeenCalledWith('branch-cairo'));
 expect(screen.getByRole('button',{name:'إيقاف فرع القاهرة - المرج'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'إغلاق'}));
 expect(screen.queryByRole('dialog',{name:'إدارة الفروع'})).not.toBeInTheDocument();
});

it('uses a non-destructive action label for a branch',async()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 fireEvent.change(await screen.findByLabelText('الفرع أو المنطقة'),{target:{value:'__manage_branches__'}});
 expect(await screen.findByRole('button',{name:'إيقاف فرع القاهرة - المرج'})).toBeVisible();
 expect(await screen.findByRole('button',{name:'إعادة تشغيل فرع فرع قديم'})).toBeVisible();
 expect(screen.queryByRole('button',{name:'حذف فرع القاهرة - المرج'})).not.toBeInTheDocument();
});

it('preserves a saved branch missing from the shared branch list',async()=>{
 const initial={id:'f1',code:'F-0001',archived_at:null,phone:'01012345678',phone_2:null,phone_3:null,father_name:null,mother_name:'منى',contact_name:null,contact_relationship:null,contact_age:null,national_id:null,national_id_expires_on:null,notes:'',address:null,monthly_income:null,health_condition:null,branch_area:'فرع قديم',file_status:'نشط' as const,status_reason:null,case_file_categories:[{category:'أرملة' as const}]};
 render(<CaseIntakeForm initial={initial} onSaved={vi.fn()}/>);
 const select=await screen.findByLabelText('الفرع أو المنطقة');
 expect(select).toHaveValue('فرع قديم');
 expect(select).toHaveTextContent('فرع قديم (فرع محفوظ)');
});

it('allows digits only in monthly income',async()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 const income=screen.getByLabelText('الدخل الشهري بالجنيه');
 fireEvent.change(income,{target:{value:'٢٥٠٠,abc.٥'}});
 expect(income).toHaveValue('25005');
});

it('saves a case review date and only calculates temporary per-person net income',async()=>{
 render(<CaseIntakeForm onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('اسم الأب (اختياري)'),{target:{value:'أحمد'}});
 fireEvent.change(screen.getByLabelText('اسم الأم (مطلوب)'),{target:{value:'منى'}});
 fireEvent.click(screen.getByLabelText('أرملة'));
 fireEvent.change(screen.getByLabelText('الدخل الشهري بالجنيه'),{target:{value:'٥٠٠٠'}});
 fireEvent.change(screen.getByLabelText('مصروفات الأسرة الشهرية الثابتة (للحساب بس)'),{target:{value:'٢٠٠٠'}});
 fireEvent.change(screen.getByLabelText('ميعاد إعادة بحث الحالة'),{target:{value:'2026-12-01'}});
 expect(screen.queryByText(/متوسط دخل الفرد الصافي/)).not.toBeInTheDocument();
 expect(screen.getByText(/سجّل أفراد الأسرة الأول/)).toBeVisible();
 expect(screen.getByText(/مش بتتسجل/)).toBeVisible();
 fireEvent.change(screen.getByLabelText('رقم الموبايل 1'),{target:{value:'01012345678'}});
 fireEvent.click(screen.getByRole('button',{name:'حفظ ملف الحالة'}));
 await waitFor(()=>expect(saveCaseFile).toHaveBeenCalledWith(null,expect.objectContaining({nextReviewDate:'2026-12-01',monthlyIncome:5000})));
 expect(vi.mocked(saveCaseFile).mock.calls[0]?.[1]).not.toHaveProperty('fixedExpenses');
});

it('calculates the estimate from recorded household members while editing a case',()=>{
 const initial={id:'f1',code:'F-0001',archived_at:null,phone:'01012345678',phone_2:null,phone_3:null,father_name:'أحمد',mother_name:'منى',contact_name:null,contact_relationship:null,contact_age:null,national_id:null,national_id_expires_on:null,notes:'',address:null,monthly_income:5000,health_condition:null,branch_area:null,file_status:'نشط' as const,status_reason:null,case_file_categories:[{category:'أرملة' as const}]};
 const initialMembers=[
  {family_id:'f1',person_id:'p1',relationship:'ابن',people:{name:'علي',national_id:null,gender:'male' as const,date_of_birth:'2010-01-01'}},
  {family_id:'f1',person_id:'p2',relationship:'بنت',people:{name:'سلمى',national_id:null,gender:'female' as const,date_of_birth:'2015-01-01'}},
 ];
 render(<CaseIntakeForm initial={initial} initialMembers={initialMembers} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('مصروفات الأسرة الشهرية الثابتة (للحساب بس)'),{target:{value:'2000'}});
 expect(screen.getByRole('status')).toHaveTextContent('متوسط دخل الفرد الصافي: ١٬٠٠٠ جنيه في الشهر');
});

it('counts different people with the same name separately in the income estimate',()=>{
 const initial={id:'f2',code:'F-0002',archived_at:null,phone:'01012345678',phone_2:null,phone_3:null,father_name:'سامح',mother_name:'منى',contact_name:null,contact_relationship:null,contact_age:null,national_id:null,national_id_expires_on:null,notes:'',address:null,monthly_income:2000,health_condition:null,branch_area:null,file_status:'نشط' as const,status_reason:null,case_file_categories:[{category:'عجز أو مرض' as const}]};
 const initialMembers=[
  {family_id:'f2',person_id:'p1',relationship:'ابن',people:{name:'سارة',national_id:null,gender:'female' as const,date_of_birth:'2010-01-01'}},
  {family_id:'f2',person_id:'p2',relationship:'بنت',people:{name:'سارة',national_id:null,gender:'female' as const,date_of_birth:'2015-01-01'}},
 ];
 render(<CaseIntakeForm initial={initial} initialMembers={initialMembers} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('مصروفات الأسرة الشهرية الثابتة (للحساب بس)'),{target:{value:'0'}});
 expect(screen.getByRole('status')).toHaveTextContent('متوسط دخل الفرد الصافي: ٥٠٠ جنيه في الشهر');
});

it('requires a category and makes a reason mandatory for hold or rejection', async () => {
  render(<CaseIntakeForm onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('اسم الأم (مطلوب)'), { target: { value: 'منى' } });
  fireEvent.change(screen.getByLabelText('حالة الملف'), { target: { value: 'نشط' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ ملف الحالة' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('اختار نوع حالة واحد على الأقل.');
  fireEvent.click(screen.getByLabelText('أرملة'));
  fireEvent.change(screen.getByLabelText('حالة الملف'), { target: { value: 'مرفوض' } });
  expect(screen.getByLabelText('سبب الرفض')).toBeRequired();
  fireEvent.change(screen.getByLabelText('سبب الرفض'), { target: { value: 'بيانات ناقصة' } });
  fireEvent.change(screen.getByLabelText('رقم الموبايل 1'), { target: { value: '01012345678' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ ملف الحالة' }));
  await waitFor(() => expect(saveCaseFile).toHaveBeenCalledWith(null, expect.objectContaining({ fileStatus:'مرفوض',statusReason:'بيانات ناقصة' })));
});

it('edits the current file instead of creating a second one', async () => {
  const initial = { id:'f1',code:'F-0001',archived_at:null,phone:null,phone_2:null,phone_3:null,father_name:null,mother_name:null,contact_name:null,contact_relationship:null,contact_age:null,national_id:null,national_id_expires_on:null,notes:'',address:null,monthly_income:null,health_condition:null,branch_area:null,file_status:'تحت المراجعة' as const,status_reason:null,case_file_categories:[{category:'يتيم الأب' as const}] };
  const onSaved = vi.fn(); render(<CaseIntakeForm initial={initial} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText('حالة الملف'), { target: { value: 'مرفوض' } });
  fireEvent.change(screen.getByLabelText('سبب الرفض'), { target: { value: 'مستند ناقص' } });
  fireEvent.change(screen.getByLabelText('رقم الموبايل 1'), { target: { value: '01012345678' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  await waitFor(() => expect(saveCaseFile).toHaveBeenCalledWith('f1', expect.objectContaining({ fileStatus:'مرفوض',statusReason:'مستند ناقص',categories:['يتيم الأب'] })));
  expect(onSaved).toHaveBeenCalledWith('file-1');
});

it('shows the retired maternal orphan label as historical and does not submit it as a new choice', async () => {
  const initial = { id:'f1',code:'F-0001',archived_at:null,phone:'01012345678',phone_2:null,phone_3:null,father_name:null,mother_name:'منى',contact_name:null,contact_relationship:null,contact_age:null,national_id:null,national_id_expires_on:null,notes:'',address:null,monthly_income:null,health_condition:null,branch_area:null,file_status:'نشط' as const,status_reason:null,case_file_categories:[{category:'يتيم الأم' as const}] };
  render(<CaseIntakeForm initial={initial} onSaved={vi.fn()} />);
  expect(screen.getByText('تصنيف قديم محفوظ: يتيم الأم')).toBeVisible();
  fireEvent.click(screen.getByRole('button', {name:'حفظ التعديلات'}));
  await waitFor(() => expect(saveCaseFile).toHaveBeenCalledWith('f1', expect.objectContaining({categories:[]})));
});

it('keeps removed historical categories visible but never resubmits them as new choices', async () => {
  const initial = { id:'f1',code:'F-0001',archived_at:null,phone:null,phone_2:null,phone_3:null,father_name:null,mother_name:'منى',contact_name:null,contact_relationship:null,contact_age:null,national_id:null,national_id_expires_on:null,notes:'',address:null,monthly_income:null,health_condition:null,branch_area:null,file_status:'نشط' as const,status_reason:null,case_file_categories:[{category:'وفاة' as const},{category:'أرملة' as const}] };
  render(<CaseIntakeForm initial={initial} onSaved={vi.fn()} />);
  expect(screen.getByText('تصنيف قديم محفوظ: وفاة')).toBeVisible();
  fireEvent.change(screen.getByLabelText('رقم الموبايل 1'),{target:{value:'01012345678'}});
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  await waitFor(() => expect(saveCaseFile).toHaveBeenCalledWith('f1', expect.objectContaining({ categories:['أرملة'] })));
});
