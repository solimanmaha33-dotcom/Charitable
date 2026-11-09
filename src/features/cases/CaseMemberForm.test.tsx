import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi,beforeEach} from 'vitest';
import {CaseMemberForm} from './CaseMemberForm';
import {ageOn} from './memberAge';
import {cairoToday} from './idExpiry';

const service=vi.hoisted(()=>({addMember:vi.fn(),updateMemberDemographics:vi.fn(),uploadCaseAttachment:vi.fn()}));
vi.mock('../../services/cases',()=>service);
vi.mock('../files/FilePreview',()=>({FilePreview:({onText}:{onText:(text:string)=>void})=><button type="button" onClick={()=>onText('الرقم القومي ٢٩٠٠١٠١١٢٣٤٥٦٧')}>قراءة بيانات تجريبية</button>}));

beforeEach(()=>{service.addMember.mockReset().mockResolvedValue(undefined);service.updateMemberDemographics.mockReset().mockResolvedValue(undefined);service.uploadCaseAttachment.mockReset().mockResolvedValue({id:'file-1'});});

it('suggests member birth date and gender from a local card scan and waits for staff confirmation',async()=>{
 const onAdded=vi.fn();render(<CaseMemberForm caseFileId="family-1" onAdded={onAdded}/>);
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
 await waitFor(()=>expect(service.addMember).toHaveBeenCalledWith('family-1','ريم','بنت','female','1990-01-01',null,null,null,null));
 expect(service.uploadCaseAttachment).toHaveBeenCalledWith('family-1',file);
 await waitFor(()=>expect(onAdded).toHaveBeenCalledOnce());
 expect(service.addMember.mock.calls[0]).not.toContain('29001011234567');
});

it('lets staff enter demographics manually and calculates age immediately',()=>{
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('تاريخ الميلاد'),{target:{value:'2000-01-01'}});
 fireEvent.change(screen.getByLabelText('النوع'),{target:{value:'male'}});
 expect(screen.getByText(new RegExp(`العمر: ${new Intl.NumberFormat('ar-EG').format(ageOn('2000-01-01',cairoToday()))} سنة`))).toBeVisible();
});

it('saves a health status and condition details for each family member',async()=>{
 const onAdded=vi.fn();render(<CaseMemberForm caseFileId="family-1" onAdded={onAdded}/>);
 fireEvent.change(screen.getByLabelText('اسم الفرد'),{target:{value:'ريم'}});
 fireEvent.change(screen.getByLabelText('صلة القرابة'),{target:{value:'بنت'}});
 fireEvent.change(screen.getByLabelText('الحالة الصحية للفرد'),{target:{value:'مرض'}});
 fireEvent.change(screen.getByLabelText('نوع المرض'),{target:{value:'حساسية صدر'}});
 fireEvent.click(screen.getByRole('button',{name:'إضافة الفرد'}));
 await waitFor(()=>expect(service.addMember).toHaveBeenCalledWith('family-1','ريم','بنت',null,null,'مرض','حساسية صدر',null,null));
});

it('loads and updates the health condition when editing a member',async()=>{
 const member={person_id:'person-2',relationship:'ابنة',people:{name:'ريم',gender:'female' as const,date_of_birth:'2010-01-01',health_condition:'ربو',health_status:'مرض',health_details:'ربو'}};
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()} member={member}/>);
 expect(screen.getByLabelText('الحالة الصحية للفرد')).toHaveValue('مرض');
 fireEvent.change(screen.getByLabelText('نوع المرض'),{target:{value:'حساسية صدر'}});
 fireEvent.click(screen.getByRole('button',{name:'حفظ بيانات الفرد'}));
 await waitFor(()=>expect(service.updateMemberDemographics).toHaveBeenCalledWith('person-2','female','2010-01-01','مرض','حساسية صدر',null,null));
});

it('shows and saves the work type when a member is employed',async()=>{
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('اسم الفرد'),{target:{value:'ريم'}});
 fireEvent.change(screen.getByLabelText('صلة القرابة'),{target:{value:'بنت'}});
 fireEvent.change(screen.getByLabelText('حالة العمل للفرد'),{target:{value:'يعمل'}});
 expect(screen.getByLabelText('نوع عمل الفرد')).toBeVisible();
 fireEvent.change(screen.getByLabelText('نوع عمل الفرد'),{target:{value:'مدرسة'}});
 fireEvent.click(screen.getByRole('button',{name:'إضافة الفرد'}));
 await waitFor(()=>expect(service.addMember).toHaveBeenCalledWith('family-1','ريم','بنت',null,null,null,null,'يعمل','مدرسة'));
});
