import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
vi.mock('../files/FilePicker',()=>({FilePicker:({onText}:{onText:(s:string)=>void})=><button type="button" onClick={()=>onText('تحتاج علاج')}>نص للمراجعة</button>}));
vi.mock('../assistant/api',()=>({postAssistant:vi.fn(async()=>({suggestions:[{field:'case_categories',value:'عجز أو مرض',evidence:'علاج'}]}))}));
import {CaseForm} from './CaseForm';
it('applies a selected allowed category to the unsaved case form',async()=>{render(<CaseForm families={[]} onSaved={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'نص للمراجعة'}));fireEvent.click(screen.getByRole('button',{name:'اقتراح حقول'}));expect(await screen.findByRole('combobox',{name:'القيمة المقترحة'})).toHaveValue('عجز أو مرض');const category=screen.getByRole('checkbox',{name:'عجز أو مرض'});expect(category).not.toBeChecked();fireEvent.click(screen.getByRole('button',{name:'استخدم في النموذج'}));expect(category).toBeChecked();});
