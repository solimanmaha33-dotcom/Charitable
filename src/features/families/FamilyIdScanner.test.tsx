import {render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {FamilyIdScanner} from './FamilyIdScanner';

const service=vi.hoisted(()=>({saveFamily:vi.fn(),uploadFamilyFile:vi.fn()}));
vi.mock('../../services/cases',()=>service);
vi.mock('../files/FilePreview',()=>({FilePreview:()=>null}));

const profile=(national_id:string|null,national_id_expires_on:string|null)=>({id:'family-1',code:'F-0001',name:'أسرة',phone:null,phone_2:null,phone_3:null,contact_name:null,contact_age:null,national_id,national_id_expires_on,notes:''});

it('syncs scanner values when the saved family ID profile changes',()=>{
 const view=render(<FamilyIdScanner family={profile('29001011234567','2027-01-01')} onSaved={vi.fn()}/>);
 expect(screen.getByLabelText('الرقم القومي')).toHaveValue('29001011234567');
 expect(screen.getByLabelText('تاريخ انتهاء البطاقة')).toHaveValue('2027-01-01');
 view.rerender(<FamilyIdScanner family={profile('29001011234568','2028-02-02')} onSaved={vi.fn()}/>);
 expect(screen.getByLabelText('الرقم القومي')).toHaveValue('29001011234568');
 expect(screen.getByLabelText('تاريخ انتهاء البطاقة')).toHaveValue('2028-02-02');
});
