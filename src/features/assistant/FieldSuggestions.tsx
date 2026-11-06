import {useState} from 'react';
import {postAssistant} from './api';
import {parseSuggestions,type Suggestion} from './suggestions';
export function FieldSuggestions({text,onApply}:{text:string;onApply:(field:string,value:string)=>void}) {
 const [suggestions,setSuggestions]=useState<Suggestion[]>([]); const [error,setError]=useState('');
 async function extract(){try{setError('');const data=await postAssistant('/api/extract-fields',{text,targetFields:['notes','case_categories']});setSuggestions(parseSuggestions(data,['notes','case_categories'],text));}catch{setError('تعذّر اقتراح الحقول.');}}
 return <section><h3>اقتراح حقول من النص</h3><pre>{text}</pre><button type="button" onClick={()=>void extract()}>اقتراح حقول</button>{error && <p role="alert">{error}</p>}{suggestions.map((s,i)=><div key={i}><p>{s.field==='notes'?'ملاحظات':'تصنيف'} — المصدر: {s.evidence}</p><label>القيمة المقترحة<input value={s.value} onChange={e=>setSuggestions(old=>old.map((x,j)=>j===i?{...x,value:e.target.value}:x))}/></label><button type="button" onClick={()=>{onApply(s.field,s.value);setSuggestions(old=>old.filter((_,j)=>j!==i));}}>استخدم في النموذج</button><button type="button" onClick={()=>setSuggestions(old=>old.filter((_,j)=>j!==i))}>تجاهل</button></div>)}</section>;
}
