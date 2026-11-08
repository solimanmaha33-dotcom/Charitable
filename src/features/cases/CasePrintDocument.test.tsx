import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CasePrintDocument } from './CasePrintDocument';

it('prints the association identity, family profile, members, case details and attachments', () => {
  const { container } = render(<CasePrintDocument
    family={{id:'family-1',code:'F-0001',name:'أسرة تجريبية',phone:'01000000000',phone_2:null,phone_3:null,contact_name:'أم أحمد',contact_age:60,national_id:'29001011234567',national_id_expires_on:'2027-01-01',notes:'ملاحظة للأسرة'}}
    record={{id:'case-1',family_id:'family-1',notes:'ملاحظة الحالة',case_categories:[{category:'كبار السن (٦٠ سنة فأكثر)'}]}}
    members={[{person_id:'person-1',relationship:'ابنة',people:{name:'ريم',gender:'female',date_of_birth:'2000-01-01'}}]}
    attachments={[{id:'file-1',case_id:'case-1',storage_path:'case-1/file',file_name:'مستند.pdf',mime_type:'application/pdf',size_bytes:100,uploaded_by:'staff-1',created_at:'2026-11-08T00:00:00Z'}]}
  />);
  const sheet = container.querySelector('.case-print-document');
  expect(sheet).toHaveTextContent('مرام الخير');
  expect(sheet).toHaveTextContent('F-0001');
  expect(sheet).toHaveTextContent('أم أحمد');
  expect(sheet).toHaveTextContent('ريم');
  expect(sheet).toHaveTextContent('ملاحظة الحالة');
  expect(sheet).toHaveTextContent('مستند.pdf');
  expect(sheet?.querySelector('img[alt="شعار جمعية مرام الخير"]')).toHaveAttribute('src', '/brand/maram-logo.png');
});
