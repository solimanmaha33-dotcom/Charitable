import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ArchivedCasesPage } from './ArchivedCasesPage';
import { listArchivedCaseFiles, restoreCaseFile } from '../../services/cases';

vi.mock('../../services/cases', () => ({
  listArchivedCaseFiles: vi.fn(),
  restoreCaseFile: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(listArchivedCaseFiles).mockResolvedValue([{
    id:'f-archive',code:'F-0042',father_name:'أب قديم',mother_name:'أم قديمة',phone:null,phone_2:null,phone_3:null,
    address:'عنوان قديم',branch_area:'الفرع',file_status:'نشط',archived_at:'2026-11-01T12:00:00Z',
  }]);
  vi.mocked(restoreCaseFile).mockResolvedValue(undefined);
});

it('shows archived case files and restores a selected file', async () => {
  render(<MemoryRouter><ArchivedCasesPage /></MemoryRouter>);
  expect(await screen.findByRole('heading',{name:'الحالات المؤرشفة'})).toBeVisible();
  expect(screen.getByText('F-0042')).toBeVisible();
  expect(screen.getByText(/تم الأرشفة/)).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'استعادة الحالة F-0042'}));
  await waitFor(()=>expect(restoreCaseFile).toHaveBeenCalledWith('f-archive'));
  expect(await screen.findByText('تم استرجاع الحالة F-0042.')).toBeVisible();
  expect(screen.queryByText('F-0042')).not.toBeInTheDocument();
});

it('shows a helpful empty message when no cases are archived', async () => {
  vi.mocked(listArchivedCaseFiles).mockResolvedValue([]);
  render(<MemoryRouter><ArchivedCasesPage /></MemoryRouter>);
  expect(await screen.findByText('مفيش حالات مؤرشفة.')).toBeVisible();
});
