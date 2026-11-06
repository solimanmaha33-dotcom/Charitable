import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { CaseDetailsPage } from './CaseDetailsPage';
vi.mock('../../services/cases', () => ({
 listFamilies: vi.fn().mockResolvedValue([{id:'f1',code:'F-0001',name:'إِبراهيم',phone:null},{id:'f2',code:'F-0002',name:'عائلة أخرى',phone:null}]),
 listCases: vi.fn().mockResolvedValue([{id:'c1',family_id:'f1',notes:'',case_categories:[{category:'أيتام'}]},{id:'c2',family_id:'f2',notes:'',case_categories:[{category:'وفاة'}]}]),
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
