import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {FieldSuggestions} from './FieldSuggestions';
it('requires a separate explicit action to apply a suggestion',async()=>{const apply=vi.fn();render(<FieldSuggestions text="أسرة تحتاج علاج" onApply={apply}/>);expect(apply).not.toHaveBeenCalled();expect(screen.getByText('أسرة تحتاج علاج')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'اقتراح حقول'}));expect(apply).not.toHaveBeenCalled();});
