import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CasePrintDocument } from './CasePrintDocument';

it('prints the case code, status, parents, contact details, profile fields, members, attachments and association stamp', () => {
  const { container } = render(<CasePrintDocument
    caseFile={{id:'file-1',code:'F-0001',archived_at:null,phone:'01000000000',phone_2:'01000000002',phone_3:null,father_name:'أحمد',mother_name:'منى',contact_name:'أم أحمد',contact_relationship:'الأم',contact_age:60,national_id:'29001011234567',national_id_expires_on:'2027-01-01',notes:'ملاحظة للملف',address:'شارع النيل',monthly_income:3500,health_condition:'متابعة دورية',branch_area:'فرع الجيزة',file_status:'موقوف',status_reason:'مراجعة البيانات',case_file_categories:[{category:'كبار السن (٦٠ سنة فأكثر)'}]}}
    members={[{person_id:'person-1',relationship:'ابنة',people:{name:'ريم',gender:'female',date_of_birth:'2000-01-01'}}]}
    attachments={[{id:'file-1',family_id:'file-1',storage_path:'file-1/file',file_name:'مستند.pdf',mime_type:'application/pdf',size_bytes:100,uploaded_by:'staff-1',extracted_text:null,created_at:'2026-11-08T00:00:00Z'}]}
  />);
  const sheet = container.querySelector('.case-print-document');
  for (const value of ['مرام الخير','F-0001','أحمد','منى','الأم','مستند.pdf','ريم','موقوف','مراجعة البيانات','شارع النيل','٣٬٥٠٠ جنيه','متابعة دورية','فرع الجيزة','مكان ختم الجمعية','01000000002']) expect(sheet).toHaveTextContent(value);
  expect(sheet?.querySelector('img[alt="شعار جمعية مرام الخير"]')).toHaveAttribute('src', '/brand/maram-logo.png');
  expect(sheet?.querySelector('.association-stamp')).toBeVisible();
});
