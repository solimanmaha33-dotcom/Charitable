import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi,beforeEach} from 'vitest';
import {FamilyMemberForm} from './FamilyMemberForm';
import {ageOn} from './memberAge';
import {cairoToday} from './idExpiry';

const service=vi.hoisted(()=>({addMember:vi.fn(),uploadFamilyFile:vi.fn()}));
vi.mock('../../services/cases',()=>service);
vi.mock('../files/FilePreview',()=>({FilePreview:({onText}:{onText:(text:string)=>void})=><button type="button" onClick={()=>onText('الرقم القومي ٢٩٠٠١٠١١٢٣٤٥٦٧')}>قراءة بيانات تجريبية</button>}));

beforeEach(()=>{service.addMember.mockReset().mockResolvedValue(undefined);service.uploadFamilyFile.mockReset().mockResolvedValue({id:'file-1'});});

it('suggests member birth date and gender from a local card scan and waits for staff confirmation',async()=>{
 const onAdded=vi.fn();render(<FamilyMemberForm familyId="family-1" onAdded={onAdded}/>);
 fireEvent.change(screen.getByLabelText('اسم الفرد'),{target:{value:'ريم'}});
 fireEvent.change(screen.getByLabelText('صلة القرابة'),{target:{value:'بنت'}});
 const file=new File(['image'],'بطاقة ريم.png',{type:'image/png'});
 fireEvent.change(screen.getByLabelText('صورة البطاقة أو PDF'),{target:{files:[file]}});
 fireEvent.click(await screen.findByRole('button',{name:'قراءة بيانات تجريبية'}));
 expect(screen.getByLabelText('الرقم القومي للمساعدة في قراءة البيانات')).toHaveValue('29001011234567');
 expect(screen.getByLabelText('تاريخ الميلاد')).toHaveValue('1990-01-01');
 expect(screen.getByLabelText('النوع')).toHaveValue('female');
 expect(screen.getByText(new RegExp(`العمر: ${new Intl.NumberFormat('ar-EG').format(ageOn('1990-01-01',cairoToday()))} سنة`))).toBeVisible();
 expect(service.addMember).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'إضافة الفرد'}));
 await waitFor(()=>expect(service.addMember).toHaveBeenCalledWith('family-1','ريم','بنت','female','1990-01-01'));
 expect(service.uploadFamilyFile).toHaveBeenCalledWith('family-1',file);
 await waitFor(()=>expect(onAdded).toHaveBeenCalledOnce());
 expect(service.addMember.mock.calls[0]).not.toContain('29001011234567');
});

it('lets staff enter demographics manually and calculates age immediately',()=>{
 render(<FamilyMemberForm familyId="family-1" onAdded={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('تاريخ الميلاد'),{target:{value:'2000-01-01'}});
 fireEvent.change(screen.getByLabelText('النوع'),{target:{value:'male'}});
 expect(screen.getByText(new RegExp(`العمر: ${new Intl.NumberFormat('ar-EG').format(ageOn('2000-01-01',cairoToday()))} سنة`))).toBeVisible();
});
