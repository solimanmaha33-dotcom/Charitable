import {act,fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {FieldSuggestions} from './FieldSuggestions';
it('requires a separate explicit action to apply a suggestion',async()=>{const apply=vi.fn();render(<FieldSuggestions text="أسرة تحتاج علاج" onApply={apply}/>);expect(apply).not.toHaveBeenCalled();expect(screen.getByText('أسرة تحتاج علاج')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'اقتراح حقول'}));expect(apply).not.toHaveBeenCalled();});
it('clears suggestions after the draft changes and ignores late results',async()=>{
 let resolve!:(value:unknown)=>void; const api=await import('./api');const spy=vi.spyOn(api,'postAssistant');spy.mockResolvedValueOnce({suggestions:[{field:'notes',value:'قديم',evidence:'علاج'}]}).mockImplementationOnce(()=>new Promise(r=>{resolve=r}));
 const apply=vi.fn();const {rerender}=render(<FieldSuggestions text="أسرة تحتاج علاج" onApply={apply}/>);fireEvent.click(screen.getByRole('button',{name:'اقتراح حقول'}));expect(await screen.findByDisplayValue('قديم')).toBeInTheDocument();rerender(<FieldSuggestions text="نص جديد" onApply={apply}/>);expect(screen.queryByDisplayValue('قديم')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'اقتراح حقول'}));rerender(<FieldSuggestions text="نص آخر" onApply={apply}/>);await act(async()=>resolve({suggestions:[{field:'notes',value:'متأخر',evidence:'جديد'}]}));expect(screen.queryByDisplayValue('متأخر')).not.toBeInTheDocument();spy.mockRestore();
});
it('keeps a category suggestion and shows an error when application fails',async()=>{
 const api=await import('./api');const spy=vi.spyOn(api,'postAssistant').mockResolvedValue({suggestions:[{field:'case_categories',value:'عجز أو مرض',evidence:'علاج'}]});render(<FieldSuggestions text="تحتاج علاج" onApply={()=>false}/>);fireEvent.click(screen.getByRole('button',{name:'اقتراح حقول'}));expect(await screen.findByRole('combobox',{name:'القيمة المقترحة'})).toHaveValue('عجز أو مرض');fireEvent.click(screen.getByRole('button',{name:'استخدم في النموذج'}));expect(screen.getByRole('alert')).toBeInTheDocument();expect(screen.getByRole('combobox',{name:'القيمة المقترحة'})).toBeInTheDocument();spy.mockRestore();
});
it('shows partial coverage to the employee alongside the answer',async()=>{
 const {AssistantPanel}=await import('./AssistantPanel');const {MemoryRouter}=await import('react-router-dom');const api=await import('./api');const spy=vi.spyOn(api,'postAssistant').mockResolvedValue({answer:'إجابة',sources:[],coverage:{partial:true,explanation:'النتائج جزئية'}});render(<MemoryRouter><AssistantPanel/></MemoryRouter>);fireEvent.change(screen.getByLabelText('سؤالك'),{target:{value:'سؤال'}});fireEvent.click(screen.getByRole('button',{name:'اسأل'}));expect(await screen.findByRole('status')).toHaveTextContent('النتائج جزئية');spy.mockRestore();
});
