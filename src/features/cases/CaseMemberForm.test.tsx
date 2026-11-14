import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi,beforeEach} from 'vitest';
import {CaseMemberForm} from './CaseMemberForm';
import {ageOn} from './memberAge';
import {cairoToday} from './idExpiry';

const service=vi.hoisted(()=>({saveCaseMemberProfile:vi.fn(),uploadCaseAttachment:vi.fn()}));
vi.mock('../../services/cases',()=>service);
vi.mock('../files/FilePreview',()=>({FilePreview:({onText}:{onText:(text:string)=>void})=><><button type="button" onClick={()=>onText('الرقم القومي ٢٩٠٠١٠١١٢٣٤٥٦٧')}>قراءة بيانات تجريبية</button><button type="button" onClick={()=>onText('الرقم القومي ٢٩٠٠١٠١١٢٣٤٥٦٧ — مراجعة النص')}>تعديل نص OCR</button></>}));

beforeEach(()=>{service.saveCaseMemberProfile.mockReset().mockResolvedValue(undefined);service.uploadCaseAttachment.mockReset().mockResolvedValue({id:'file-1'});});

it('suggests member birth date and gender from a local card scan and waits for staff confirmation',async()=>{
 const onAdded=vi.fn();render(<CaseMemberForm caseFileId="family-1" onAdded={onAdded}/>);
 fireEvent.change(screen.getByLabelText('اسم الفرد'),{target:{value:'ريم'}});
 fireEvent.change(screen.getByLabelText('صلة القرابة'),{target:{value:'بنت'}});
 const file=new File(['image'],'بطاقة ريم.png',{type:'image/png'});
 fireEvent.change(screen.getByLabelText('صورة البطاقة أو PDF'),{target:{files:[file]}});
 fireEvent.click(await screen.findByRole('button',{name:'قراءة بيانات تجريبية'}));
 expect(screen.getByLabelText('الرقم القومي للفرد')).toHaveValue('29001011234567');
 expect(screen.getByLabelText('تاريخ الميلاد')).toHaveValue('1990-01-01');
 expect(screen.getByLabelText('النوع')).toHaveValue('female');
 expect(screen.getByText('المحافظة اللي باينة من الرقم القومي: الدقهلية (للمراجعة بس)')).toBeVisible();
 expect(screen.getByText(new RegExp(`العمر: ${new Intl.NumberFormat('ar-EG').format(ageOn('1990-01-01',cairoToday()))} سنة`))).toBeVisible();
 expect(service.saveCaseMemberProfile).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'إضافة الفرد'}));
 await waitFor(()=>expect(service.saveCaseMemberProfile).toHaveBeenCalledWith('family-1',null,{name:'ريم',relationship:'بنت',gender:'female',dateOfBirth:'1990-01-01',healthStatus:null,healthDetails:null,employmentStatus:null,occupation:null,nationalId:'29001011234567',fatherStatus:null}));
 expect(service.uploadCaseAttachment).toHaveBeenCalledWith('family-1',file);
 await waitFor(()=>expect(onAdded).toHaveBeenCalledOnce());
 expect(service.saveCaseMemberProfile.mock.calls[0]?.[2]).toMatchObject({ nationalId: '29001011234567' });
});

it('fills demographics from a typed valid ID and lets staff correct the suggestions',()=>{
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('الرقم القومي للفرد'),{target:{value:'32402291234577'}});
 expect(screen.getByLabelText('تاريخ الميلاد')).toHaveValue('2024-02-29');
 expect(screen.getByLabelText('النوع')).toHaveValue('male');
 fireEvent.change(screen.getByLabelText('تاريخ الميلاد'),{target:{value:'2024-03-01'}});
 fireEvent.change(screen.getByLabelText('النوع'),{target:{value:'female'}});
 expect(screen.getByLabelText('تاريخ الميلاد')).toHaveValue('2024-03-01');
 expect(screen.getByLabelText('النوع')).toHaveValue('female');
});

it('keeps staff demographic edits when OCR text changes but its ID stays the same',()=>{
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('اسم الفرد'),{target:{value:'ريم'}});
 fireEvent.change(screen.getByLabelText('صلة القرابة'),{target:{value:'بنت'}});
 fireEvent.change(screen.getByLabelText('صورة البطاقة أو PDF'),{target:{files:[new File(['image'],'id.png',{type:'image/png'})]}});
 fireEvent.click(screen.getByRole('button',{name:'قراءة بيانات تجريبية'}));
 fireEvent.change(screen.getByLabelText('تاريخ الميلاد'),{target:{value:'2001-02-03'}});
 fireEvent.change(screen.getByLabelText('النوع'),{target:{value:'male'}});
 fireEvent.click(screen.getByRole('button',{name:'تعديل نص OCR'}));
 expect(screen.getByLabelText('تاريخ الميلاد')).toHaveValue('2001-02-03');
 expect(screen.getByLabelText('النوع')).toHaveValue('male');
});

it('does not overwrite corrected demographics when an existing member ID is scanned again',()=>{
 const member={person_id:'person-saved',relationship:'ابنة',people:{name:'ريم',national_id:'29001011234567',gender:'female' as const,date_of_birth:'1990-01-01'}};
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()} member={member}/>);
 fireEvent.change(screen.getByLabelText('تاريخ الميلاد'),{target:{value:'1991-02-03'}});
 fireEvent.change(screen.getByLabelText('النوع'),{target:{value:'male'}});
 fireEvent.change(screen.getByLabelText('صورة البطاقة أو PDF'),{target:{files:[new File(['image'],'id.png',{type:'image/png'})]}});
 fireEvent.click(screen.getByRole('button',{name:'قراءة بيانات تجريبية'}));
 expect(screen.getByLabelText('تاريخ الميلاد')).toHaveValue('1991-02-03');
 expect(screen.getByLabelText('النوع')).toHaveValue('male');
});

it('keeps corrected member demographics when the same typed ID is entered again',()=>{
 const member={person_id:'person-saved',relationship:'ابنة',people:{name:'ريم',national_id:'29001011234567',gender:'female' as const,date_of_birth:'1990-01-01'}};
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()} member={member}/>);
 fireEvent.change(screen.getByLabelText('تاريخ الميلاد'),{target:{value:'1991-02-03'}});
 fireEvent.change(screen.getByLabelText('النوع'),{target:{value:'male'}});
 fireEvent.change(screen.getByLabelText('الرقم القومي للفرد'),{target:{value:'290'}});
 fireEvent.change(screen.getByLabelText('الرقم القومي للفرد'),{target:{value:'29001011234567'}});
 expect(screen.getByLabelText('تاريخ الميلاد')).toHaveValue('1991-02-03');
 expect(screen.getByLabelText('النوع')).toHaveValue('male');
});

it('restores the full saved member ID when its card is rescanned after a partial edit',()=>{
 const member={person_id:'person-saved',relationship:'ابنة',people:{name:'ريم',national_id:'29001011234567',gender:'female' as const,date_of_birth:'1990-01-01'}};
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()} member={member}/>);
 fireEvent.change(screen.getByLabelText('تاريخ الميلاد'),{target:{value:'1991-02-03'}});
 fireEvent.change(screen.getByLabelText('الرقم القومي للفرد'),{target:{value:'290'}});
 fireEvent.change(screen.getByLabelText('صورة البطاقة أو PDF'),{target:{files:[new File(['image'],'id.png',{type:'image/png'})]}});
 fireEvent.click(screen.getByRole('button',{name:'قراءة بيانات تجريبية'}));
 expect(screen.getByLabelText('الرقم القومي للفرد')).toHaveValue('29001011234567');
 expect(screen.getByLabelText('تاريخ الميلاد')).toHaveValue('1991-02-03');
});

it('keeps an invalid ID from being saved as a member profile',async()=>{
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('اسم الفرد'),{target:{value:'ريم'}});
 fireEvent.change(screen.getByLabelText('صلة القرابة'),{target:{value:'بنت'}});
 fireEvent.change(screen.getByLabelText('الرقم القومي للفرد'),{target:{value:'12345678901234'}});
 fireEvent.click(screen.getByRole('button',{name:'إضافة الفرد'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('اتأكد إن الرقم القومي ١٤ رقم وتاريخ الميلاد صحيح');
 expect(service.saveCaseMemberProfile).not.toHaveBeenCalled();
});

it('lets staff enter demographics manually and calculates age immediately',()=>{
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('تاريخ الميلاد'),{target:{value:'2000-01-01'}});
 fireEvent.change(screen.getByLabelText('النوع'),{target:{value:'male'}});
 expect(screen.getByText(new RegExp(`العمر: ${new Intl.NumberFormat('ar-EG').format(ageOn('2000-01-01',cairoToday()))} سنة`))).toBeVisible();
});

it('saves a health status and condition details for each family member',async()=>{
 const onAdded=vi.fn();render(<CaseMemberForm caseFileId="family-1" onAdded={onAdded}/>);
 expect(screen.getByLabelText('الحالة الصحية للفرد').querySelectorAll('option')).toHaveLength(4);
 expect([...screen.getByLabelText('الحالة الصحية للفرد').querySelectorAll('option')].map(option=>option.textContent)).toEqual(['اختار الحالة الصحية','عجز / إعاقة','مرض','حالة مستقرة']);
 fireEvent.change(screen.getByLabelText('اسم الفرد'),{target:{value:'ريم'}});
 fireEvent.change(screen.getByLabelText('صلة القرابة'),{target:{value:'بنت'}});
 fireEvent.change(screen.getByLabelText('الحالة الصحية للفرد'),{target:{value:'مرض'}});
 fireEvent.change(screen.getByLabelText('نوع المرض'),{target:{value:'حساسية صدر'}});
 fireEvent.click(screen.getByRole('button',{name:'إضافة الفرد'}));
 await waitFor(()=>expect(service.saveCaseMemberProfile).toHaveBeenCalledWith('family-1',null,{name:'ريم',relationship:'بنت',gender:null,dateOfBirth:null,healthStatus:'مرض',healthDetails:'حساسية صدر',employmentStatus:null,occupation:null,nationalId:null,fatherStatus:null}));
});

it('loads and updates the health condition and national ID when editing a member',async()=>{
 const member={person_id:'person-2',relationship:'ابنة',people:{name:'ريم',national_id:'29001011234567',gender:'female' as const,date_of_birth:'2010-01-01',health_condition:'ربو',health_status:'مرض' as const,health_details:'ربو'}};
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()} member={member}/>);
 expect(screen.getByLabelText('الرقم القومي للفرد')).toHaveValue('29001011234567');
 expect(screen.getByLabelText('الحالة الصحية للفرد')).toHaveValue('مرض');
 fireEvent.change(screen.getByLabelText('نوع المرض'),{target:{value:'حساسية صدر'}});
 fireEvent.click(screen.getByRole('button',{name:'حفظ بيانات الفرد'}));
 await waitFor(()=>expect(service.saveCaseMemberProfile).toHaveBeenCalledWith('family-1','person-2',{name:'ريم',relationship:'ابنة',gender:'female',dateOfBirth:'2010-01-01',healthStatus:'مرض',healthDetails:'حساسية صدر',employmentStatus:null,occupation:null,nationalId:'29001011234567',fatherStatus:null}));
});

it('does not upload the same selected member card again after it was saved',async()=>{
 const member={person_id:'person-3',relationship:'ابنة',people:{name:'ريم',national_id:null,gender:'female' as const,date_of_birth:'2010-01-01'}};
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()} member={member}/>);
 fireEvent.change(screen.getByLabelText('صورة البطاقة أو PDF'),{target:{files:[new File(['image'],'بطاقة ريم.png',{type:'image/png'})]}});
 fireEvent.click(await screen.findByRole('button',{name:'قراءة بيانات تجريبية'}));
 fireEvent.click(screen.getByRole('button',{name:'حفظ بيانات الفرد'}));
 await waitFor(()=>expect(service.uploadCaseAttachment).toHaveBeenCalledTimes(1));
 fireEvent.click(screen.getByRole('button',{name:'حفظ بيانات الفرد'}));
 await waitFor(()=>expect(service.saveCaseMemberProfile).toHaveBeenCalledTimes(2));
 expect(service.uploadCaseAttachment).toHaveBeenCalledTimes(1);
});

it('shows and saves the work type when a member is employed',async()=>{
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('اسم الفرد'),{target:{value:'ريم'}});
 fireEvent.change(screen.getByLabelText('صلة القرابة'),{target:{value:'بنت'}});
 fireEvent.change(screen.getByLabelText('حالة العمل للفرد'),{target:{value:'يعمل'}});
 expect(screen.getByLabelText('نوع عمل الفرد')).toBeVisible();
 fireEvent.change(screen.getByLabelText('نوع عمل الفرد'),{target:{value:'مدرسة'}});
 fireEvent.click(screen.getByRole('button',{name:'إضافة الفرد'}));
 await waitFor(()=>expect(service.saveCaseMemberProfile).toHaveBeenCalledWith('family-1',null,{name:'ريم',relationship:'بنت',gender:null,dateOfBirth:null,healthStatus:null,healthDetails:null,employmentStatus:'يعمل',occupation:'مدرسة',nationalId:null,fatherStatus:null}));
});

it('asks for a child father status only when the case type is other',async()=>{
 render(<CaseMemberForm caseFileId="family-1" onAdded={vi.fn()} showFatherStatus/>);
 fireEvent.change(screen.getByLabelText('اسم الفرد'),{target:{value:'ريم'}});fireEvent.change(screen.getByLabelText('صلة القرابة'),{target:{value:'بنت'}});
 expect(screen.getByLabelText('حالة الأب للطفل')).toBeRequired();
 fireEvent.click(screen.getByRole('button',{name:'إضافة الفرد'}));
 expect(service.saveCaseMemberProfile).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('حالة الأب للطفل'),{target:{value:'يتيم الأب'}});
 fireEvent.click(screen.getByRole('button',{name:'إضافة الفرد'}));
 await waitFor(()=>expect(service.saveCaseMemberProfile).toHaveBeenCalledWith('family-1',null,expect.objectContaining({fatherStatus:'يتيم الأب'})));
});
