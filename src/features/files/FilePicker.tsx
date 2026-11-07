import {useState} from 'react';
import {openPdf,validateDocument} from './documentText';
import {FilePreview} from './FilePreview';
export function FilePicker({files,onChange,onText}:{files:File[];onChange:(files:File[])=>void;onText?:(text:string)=>void}) {
 const [error,setError]=useState('');
 async function select(list:FileList|null) {
  setError(''); if(!list) return; const next=Array.from(list);
  try {for(const file of next){validateDocument(file); if(file.type==='application/pdf'){const pdf=await openPdf(file);await pdf.cleanup();}} onChange([...files,...next]);} catch {setError('اختر صورة أو PDF صالحاً بحد ٢٠ ميجابايت و٢٠ صفحة للملف.');}
 }
 return <fieldset className="file-picker"><legend>مرفقات الحالة</legend><label>اختيار صور أو PDF<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple onChange={e=>{void select(e.target.files); e.currentTarget.value='';}} /></label><p className="form-help">تقدر تختار أكتر من ملف. الحد الأقصى ٢٠ ميجابايت للملف.</p>{error && <p className="error-message" role="alert">{error}</p>}{files.map((file,i)=><div className="selected-file" key={`${file.name}-${i}`}><FilePreview file={file} onText={onText}/><button type="button" className="secondary" onClick={()=>onChange(files.filter((_,j)=>j!==i))}>إزالة {file.name}</button></div>)}</fieldset>;
}
