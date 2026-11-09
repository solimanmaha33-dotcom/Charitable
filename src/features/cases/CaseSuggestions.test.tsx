import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('../files/FilePicker', () => ({ FilePicker: ({ onText }: { onText: (value: string) => void }) => <button type="button" onClick={() => onText('تحتاج علاج')}>نص للمراجعة</button> }));
vi.mock('../assistant/api', () => ({ postAssistant: vi.fn(async () => ({ suggestions: [{ field: 'case_categories', value: 'عجز أو مرض', evidence: 'علاج' }] })) }));
vi.mock('../../services/cases', () => ({ saveCaseFile: vi.fn(), uploadCaseAttachment: vi.fn() }));
import { CaseIntakeForm } from './CaseIntakeForm';
it('applies a reviewed category suggestion to the one-file intake form', async () => {
  render(<CaseIntakeForm onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'نص للمراجعة' }));
  fireEvent.click(screen.getByRole('button', { name: 'اقتراح حقول' }));
  expect(await screen.findByRole('combobox', { name: 'القيمة المقترحة' })).toHaveValue('عجز أو مرض');
  const category = screen.getByRole('checkbox', { name: 'عجز أو مرض' }); expect(category).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'استخدم في النموذج' })); expect(category).toBeChecked();
});
