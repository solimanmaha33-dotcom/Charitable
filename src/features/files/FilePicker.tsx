import {useState} from 'react';
import {openPdf,validateDocument} from './documentText';
import {FilePreview} from './FilePreview';
export function FilePicker({files,onChange,onText,legend='مرفقات الحالة',label='اختيار صور أو PDF'}:{files:File[];onChange:(files:File[])=>void;onText?:(text:string)=>void;legend?:string;label?:string}) {
 const [error,setError]=useState('');
 async function select(list:FileList|null) {
  setError(''); if(!list) return; const next=Array.from(list);
  try {for(const file of next){validateDocument(file); if(file.type==='application/pdf'){const pdf=await openPdf(file);await pdf.cleanup();}} onChange([...files,...next]);} catch {setError('اختر صورة أو PDF صالحاً بحد ٢٠ ميجابايت و٢٠ صفحة للملف.');}
 }
 return <fieldset className="file-picker"><legend>{legend}</legend><label>{label}<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple onChange={e=>{void select(e.target.files); e.currentTarget.value='';}} /></label><p className="form-help">تقدر تختار أكتر من ملف. الحد الأقصى ٢٠ ميجابايت للملف.</p>{error && <p className="error-message" role="alert">{error}</p>}{files.map((file,i)=><div className="selected-file" key={`${file.name}-${i}`}><FilePreview file={file} onText={onText}/><button type="button" className="secondary" onClick={()=>onChange(files.filter((_,j)=>j!==i))}>إزالة {file.name}</button></div>)}</fieldset>;
}
