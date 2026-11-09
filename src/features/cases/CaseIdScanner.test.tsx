import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {CaseIdScanner} from './CaseIdScanner';
import type {CaseFile} from '../../services/cases';
import {ageOn} from './memberAge';
import {cairoToday} from './idExpiry';

const service=vi.hoisted(()=>({updateCaseFileIdentity:vi.fn(),uploadCaseAttachment:vi.fn()}));
vi.mock('../../services/cases',()=>service);
vi.mock('../files/FilePreview',()=>({FilePreview:({onText}:{onText:(text:string)=>void})=><><button type="button" onClick={()=>onText('الرقم القومي: ٣٢٤٠٢٢٩١٢٣٤٥٧٧')}>قراءة بطاقة تجريبية</button><button type="button" onClick={()=>onText('الرقم القومي: ٣٢٤٠٢٢٩١٢٣٤٥٧٧ — مراجعة النص')}>تعديل نص OCR</button></>}));

const profile=(national_id:string|null,national_id_expires_on:string|null):CaseFile=>({id:'family-1',code:'F-0001',archived_at:null,phone:null,phone_2:null,phone_3:null,father_name:null,mother_name:null,contact_name:null,contact_relationship:null,contact_age:null,national_id,national_id_expires_on,notes:'',address:null,monthly_income:null,health_condition:null,branch_area:null,file_status:'نشط',status_reason:null,case_file_categories:[]});

it('syncs scanner values when the saved family ID profile changes',()=>{
 const view=render(<CaseIdScanner caseFile={profile('29001011234567','2027-01-01')} onSaved={vi.fn()}/>);
 expect(screen.getByLabelText('الرقم القومي')).toHaveValue('29001011234567');
 expect(screen.getByLabelText('تاريخ انتهاء البطاقة')).toHaveValue('2027-01-01');
 view.rerender(<CaseIdScanner caseFile={profile('29001011234568','2028-02-02')} onSaved={vi.fn()}/>);
 expect(screen.getByLabelText('الرقم القومي')).toHaveValue('29001011234568');
 expect(screen.getByLabelText('تاريخ انتهاء البطاقة')).toHaveValue('2028-02-02');
});

it('does not resubmit read-only historical categories when saving scanned ID data',async()=>{
 const caseFile={...profile(null,null),case_file_categories:[{category:'أرملة' as const},{category:'وفاة' as const}]};
 service.updateCaseFileIdentity.mockResolvedValue(undefined);
 render(<CaseIdScanner caseFile={caseFile} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('تاريخ انتهاء البطاقة'),{target:{value:'2027-01-01'}});
 fireEvent.click(screen.getByRole('button',{name:'مراجعة البيانات وحفظها'}));
 await waitFor(()=>expect(service.updateCaseFileIdentity).toHaveBeenCalledWith('family-1','', '2027-01-01',{birthDate:null,gender:null,age:null}));
});

it('updates identity without resaving or changing contact fields',async()=>{
 const caseFile={...profile(null,null),phone:'0100 123 4567',phone_2:'٠١٠٩٨٧٦٥٤٣٢'};
 service.updateCaseFileIdentity.mockResolvedValue(undefined);
 render(<CaseIdScanner caseFile={caseFile} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('تاريخ انتهاء البطاقة'),{target:{value:'2027-01-01'}});
 fireEvent.click(screen.getByRole('button',{name:'مراجعة البيانات وحفظها'}));
 await waitFor(()=>expect(service.updateCaseFileIdentity).toHaveBeenCalledWith('family-1','', '2027-01-01',{birthDate:null,gender:null,age:null}));
});

it('uses OCR National ID details to fill the guardian profile before saving',async()=>{
 service.updateCaseFileIdentity.mockResolvedValue(undefined);
 render(<CaseIdScanner caseFile={profile(null,null)} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('صورة البطاقة أو ملف PDF'),{target:{files:[new File(['image'],'id.png',{type:'image/png'})]}});
 fireEvent.click(screen.getByRole('button',{name:'قراءة بطاقة تجريبية'}));
 expect(screen.getByLabelText('تاريخ ميلاد المسؤول')).toHaveValue('2024-02-29');
 expect(screen.getByLabelText('نوع المسؤول')).toHaveValue('male');
 expect(screen.getByText('المحافظة الظاهرة في الرقم: الدقهلية (للمراجعة بس)')).toBeVisible();
 expect(screen.getByLabelText('سن المسؤول')).toHaveValue(ageOn('2024-02-29',cairoToday()));
 fireEvent.click(screen.getByRole('button',{name:'مراجعة البيانات وحفظها'}));
 await waitFor(()=>expect(service.updateCaseFileIdentity).toHaveBeenCalledWith('family-1','32402291234577','',{birthDate:'2024-02-29',gender:'male',age:ageOn('2024-02-29',cairoToday())}));
});

it('keeps staff demographic edits when the OCR text changes but its ID stays the same',()=>{
 render(<CaseIdScanner caseFile={profile(null,null)} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('صورة البطاقة أو ملف PDF'),{target:{files:[new File(['image'],'id.png',{type:'image/png'})]}});
 fireEvent.click(screen.getByRole('button',{name:'قراءة بطاقة تجريبية'}));
 fireEvent.change(screen.getByLabelText('تاريخ ميلاد المسؤول'),{target:{value:'2001-02-03'}});
 fireEvent.change(screen.getByLabelText('نوع المسؤول'),{target:{value:'female'}});
 fireEvent.change(screen.getByLabelText('سن المسؤول'),{target:{value:'25'}});
 fireEvent.click(screen.getByRole('button',{name:'تعديل نص OCR'}));
 expect(screen.getByLabelText('تاريخ ميلاد المسؤول')).toHaveValue('2001-02-03');
 expect(screen.getByLabelText('نوع المسؤول')).toHaveValue('female');
 expect(screen.getByLabelText('سن المسؤول')).toHaveValue(25);
});

it('does not overwrite corrected demographics when the saved ID is scanned again',()=>{
 const saved={...profile('32402291234577','2027-01-01'),contact_date_of_birth:'2024-02-29',contact_gender:'male' as const,contact_age:2};
 render(<CaseIdScanner caseFile={saved} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('صورة البطاقة أو ملف PDF'),{target:{files:[new File(['image'],'id.png',{type:'image/png'})]}});
 fireEvent.change(screen.getByLabelText('تاريخ ميلاد المسؤول'),{target:{value:'2024-03-01'}});
 fireEvent.change(screen.getByLabelText('نوع المسؤول'),{target:{value:'female'}});
 fireEvent.click(screen.getByRole('button',{name:'قراءة بطاقة تجريبية'}));
 expect(screen.getByLabelText('تاريخ ميلاد المسؤول')).toHaveValue('2024-03-01');
 expect(screen.getByLabelText('نوع المسؤول')).toHaveValue('female');
});

it('restores a partially edited saved ID when its card is scanned again',()=>{
 const saved={...profile('32402291234577','2027-01-01'),contact_date_of_birth:'2024-02-29',contact_gender:'male' as const,contact_age:2};
 render(<CaseIdScanner caseFile={saved} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('تاريخ ميلاد المسؤول'),{target:{value:'2024-03-01'}});
 fireEvent.change(screen.getByLabelText('الرقم القومي'),{target:{value:'324'}});
 fireEvent.change(screen.getByLabelText('صورة البطاقة أو ملف PDF'),{target:{files:[new File(['image'],'id.png',{type:'image/png'})]}});
 fireEvent.click(screen.getByRole('button',{name:'قراءة بطاقة تجريبية'}));
 expect(screen.getByLabelText('الرقم القومي')).toHaveValue('32402291234577');
 expect(screen.getByLabelText('تاريخ ميلاد المسؤول')).toHaveValue('2024-03-01');
});

it('sends explicit null demographics when staff clears a saved scanner profile',async()=>{
 const caseFile={...profile('29001011234567','2027-01-01'),contact_date_of_birth:'1990-01-01',contact_gender:'male' as const,contact_age:36};
 service.updateCaseFileIdentity.mockResolvedValue(undefined);
 render(<CaseIdScanner caseFile={caseFile} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('تاريخ ميلاد المسؤول'),{target:{value:''}});
 fireEvent.change(screen.getByLabelText('نوع المسؤول'),{target:{value:''}});
 fireEvent.change(screen.getByLabelText('سن المسؤول'),{target:{value:''}});
 fireEvent.click(screen.getByRole('button',{name:'مراجعة البيانات وحفظها'}));
 await waitFor(()=>expect(service.updateCaseFileIdentity).toHaveBeenCalledWith('family-1','29001011234567','2027-01-01',{birthDate:null,gender:null,age:null}));
});
