import {act,fireEvent,render,screen} from '@testing-library/react';
import {beforeAll,expect,it,vi} from 'vitest';
vi.mock('./ocr',()=>({extractDocumentText:vi.fn()}));
import {extractDocumentText} from './ocr';
import {FilePreview} from './FilePreview';
beforeAll(()=>{URL.createObjectURL=vi.fn(()=> 'blob:test');URL.revokeObjectURL=vi.fn();});
it('ignores OCR completed for a previously selected attachment',async()=>{
 let resolve!:(v:never)=>void;vi.mocked(extractDocumentText).mockImplementation(()=>new Promise(r=>{resolve=r}));
 const a=new File(['a'],'a.png',{type:'image/png'}),b=new File(['b'],'b.png',{type:'image/png'});const onText=vi.fn();
 const {rerender}=render(<FilePreview file={a} fileId="a" canWrite onText={onText}/>);fireEvent.click(screen.getByRole('button',{name:'استخراج النص'}));rerender(<FilePreview file={b} fileId="b" canWrite onText={onText}/>);
 await act(async()=>resolve({pages:[{page:1,text:'نص أ'}]} as never));expect(screen.queryByLabelText('النص المستخرج للمراجعة')).not.toBeInTheDocument();expect(onText).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'حفظ النص للبحث بعد المراجعة'})).not.toBeInTheDocument();
});
it('invalidates pending OCR even if the same file is selected again',async()=>{
 let resolve!:(v:never)=>void;vi.mocked(extractDocumentText).mockImplementation(()=>new Promise(r=>{resolve=r}));const a=new File(['a'],'a.png',{type:'image/png'}),b=new File(['b'],'b.png',{type:'image/png'});const onText=vi.fn();const {rerender}=render(<FilePreview file={a} fileId="a" onText={onText}/>);fireEvent.click(screen.getByRole('button',{name:'استخراج النص'}));rerender(<FilePreview file={b} fileId="b" onText={onText}/>);rerender(<FilePreview file={a} fileId="a" onText={onText}/>);await act(async()=>resolve({pages:[{page:1,text:'قديم'}]} as never));expect(onText).not.toHaveBeenCalled();expect(screen.queryByLabelText('النص المستخرج للمراجعة')).not.toBeInTheDocument();
});
