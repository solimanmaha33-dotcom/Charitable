import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it } from 'vitest';
import { CaseFileRedirect } from './CaseFileRedirect';

it('sends old family links to the unified case file route', async () => {
  render(<MemoryRouter initialEntries={['/families/family-1']}><Routes><Route path="/families/:id" element={<CaseFileRedirect />} /><Route path="/cases/:id" element={<h1>ملف الحالة الموحد</h1>} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('heading',{name:'ملف الحالة الموحد'})).toBeVisible();
});
