import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {CaseIdScanner} from './CaseIdScanner';
import type {CaseFile} from '../../services/cases';

const service=vi.hoisted(()=>({updateCaseFileIdentity:vi.fn(),uploadCaseAttachment:vi.fn()}));
vi.mock('../../services/cases',()=>service);
vi.mock('../files/FilePreview',()=>({FilePreview:()=>null}));

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
 await waitFor(()=>expect(service.updateCaseFileIdentity).toHaveBeenCalledWith('family-1','', '2027-01-01'));
});

it('updates identity without resaving or changing contact fields',async()=>{
 const caseFile={...profile(null,null),phone:'0100 123 4567',phone_2:'٠١٠٩٨٧٦٥٤٣٢'};
 service.updateCaseFileIdentity.mockResolvedValue(undefined);
 render(<CaseIdScanner caseFile={caseFile} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('تاريخ انتهاء البطاقة'),{target:{value:'2027-01-01'}});
 fireEvent.click(screen.getByRole('button',{name:'مراجعة البيانات وحفظها'}));
 await waitFor(()=>expect(service.updateCaseFileIdentity).toHaveBeenCalledWith('family-1','', '2027-01-01'));
});
