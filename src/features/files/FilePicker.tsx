import {useState} from 'react';
import {openPdf,validateDocument} from './documentText';
import {FilePreview} from './FilePreview';
export function FilePicker({files,onChange,onText}:{files:File[];onChange:(files:File[])=>void;onText?:(text:string)=>void}) {
 const [error,setError]=useState('');
 async function select(list:FileList|null) {
  setError(''); if(!list) return; const next=Array.from(list);
  try {for(const file of next){validateDocument(file); if(file.type==='application/pdf'){const pdf=await openPdf(file);await pdf.cleanup();}} onChange([...files,...next]);} catch {setError('اختر صورة أو PDF صالحاً بحد ٢٠ ميجابايت و٢٠ صفحة للملف.');}
 }
 return <fieldset><legend>مرفقات الحالة</legend><label>اختيار صور أو PDF<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple onChange={e=>{void select(e.target.files); e.currentTarget.value='';}} /></label>{error && <p role="alert">{error}</p>}{files.map((file,i)=><div key={`${file.name}-${i}`}><FilePreview file={file} onText={onText}/><button type="button" onClick={()=>onChange(files.filter((_,j)=>i!==j))}>إزالة {file.name}</button></div>)}</fieldset>;
}
