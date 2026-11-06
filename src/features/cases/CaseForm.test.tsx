import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CaseForm } from './CaseForm';
import { saveCase } from '../../services/cases';
vi.mock('../../services/cases', () => ({ saveCase: vi.fn().mockResolvedValue('case-1') }));
it('saves the chosen family, multiple categories and notes', async () => {
 const onSaved=vi.fn();
 render(<CaseForm families={[{id:'family-1',code:'F-0001',name:'أسرة وهمية',phone:null}]} onSaved={onSaved} />);
 fireEvent.change(screen.getByLabelText('الأسرة'), {target:{value:'family-1'}});
 fireEvent.click(screen.getByLabelText('هجر')); fireEvent.click(screen.getByLabelText('أيتام'));
 fireEvent.change(screen.getByLabelText('ملاحظات'), {target:{value:'ملاحظة وهمية'}});
 fireEvent.click(screen.getByRole('button',{name:'حفظ الحالة'}));
 await waitFor(()=>expect(onSaved).toHaveBeenCalledWith('case-1'));
 expect(saveCase).toHaveBeenCalledWith(null,'family-1','ملاحظة وهمية',['هجر','أيتام']);
});
