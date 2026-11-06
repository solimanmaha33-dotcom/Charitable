import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { CaseDetailsPage } from './CaseDetailsPage';
import { saveCase } from '../../services/cases';
vi.mock('../../services/cases', () => ({
 listFamilies: vi.fn().mockResolvedValue([{id:'f1',code:'F-0001',name:'إِبراهيم',phone:null},{id:'f2',code:'F-0002',name:'عائلة أخرى',phone:null}]),
 listCaseFiles: vi.fn().mockResolvedValue([]),
 listCases: vi.fn().mockResolvedValue([{id:'c1',family_id:'f1',notes:'',case_categories:[{category:'أيتام'}]},{id:'c2',family_id:'f2',notes:'',case_categories:[{category:'وفاة'}]}]),
 getCase: vi.fn().mockResolvedValue({id:'c1',family_id:'f1',notes:'ملاحظة قديمة',case_categories:[{category:'أيتام'}]}),
 getFamily: vi.fn().mockResolvedValue({id:'f1',code:'F-0001',name:'إِبراهيم',phone:null}),
 saveCase: vi.fn().mockResolvedValue('c2'),
 listAllMembers: vi.fn().mockResolvedValue([{family_id:'f1',person_id:'p1',relationship:'ابن',people:{name:'أَحمد'}}]),
}));
it('searches cases by normalized family and member names, family code, and category', async () => {
 render(<MemoryRouter initialEntries={['/cases']}><Routes><Route path="/cases" element={<CaseDetailsPage canWrite={false} />} /></Routes></MemoryRouter>);
 await screen.findByRole('link',{name:/F-0001/});
 const search=screen.getByRole('textbox',{name:/بحث/});
 for (const term of ['ابراهيم','احمد','f-0001','ايتام']) {
  fireEvent.change(search,{target:{value:term}});
  expect(screen.getByRole('link',{name:/F-0001/})).toBeVisible();
  expect(screen.queryByRole('link',{name:/F-0002/})).toBeNull();
 }
 fireEvent.change(search,{target:{value:'وفاة'}});
 expect(screen.getByRole('link',{name:/F-0002/})).toBeVisible();
 expect(screen.queryByRole('link',{name:/F-0001/})).toBeNull();
});

function BackButton() { const navigate=useNavigate(); return <button onClick={()=>navigate(-1)}>رجوع</button>; }
it('creates a blank case after navigating back from a loaded case', async () => {
 render(<MemoryRouter initialEntries={['/cases/new','/cases/c1']} initialIndex={1}><BackButton /><Routes><Route path="/cases/:id" element={<CaseDetailsPage canWrite />} /></Routes></MemoryRouter>);
 expect(await screen.findByText(/ملاحظة قديمة/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'رجوع'}));
 const notes=await screen.findByLabelText('ملاحظات');
 expect(notes).toHaveValue('');
 expect(screen.getByLabelText('الأسرة')).toHaveValue('');
 expect(screen.getByLabelText('أيتام')).not.toBeChecked();
 fireEvent.change(screen.getByLabelText('الأسرة'),{target:{value:'f1'}});
 fireEvent.change(notes,{target:{value:'ملاحظة جديدة'}});
 fireEvent.click(screen.getByRole('button',{name:'حفظ الحالة'}));
 await waitFor(()=>expect(saveCase).toHaveBeenCalledWith(null,'f1','ملاحظة جديدة',[]));
});
