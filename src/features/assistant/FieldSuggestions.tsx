import {useEffect,useRef,useState} from 'react';
import {CASE_CATEGORIES} from '../cases/categories';
import {postAssistant} from './api';
import {parseSuggestions,type Suggestion} from './suggestions';
export function FieldSuggestions({text,onApply}:{text:string;onApply:(field:string,value:string)=>boolean}) {
 const revision=useRef({text,number:0}); if(revision.current.text!==text) revision.current={text,number:revision.current.number+1};
 useEffect(()=>()=>{revision.current.number++;},[]);
 const [suggestions,setSuggestions]=useState<Suggestion[]>([]); const [snapshot,setSnapshot]=useState(-1); const [error,setError]=useState('');
 useEffect(()=>{setSuggestions([]);setSnapshot(-1);setError('');},[text]);
 async function extract(){const current=++revision.current.number;try{setError('');const data=await postAssistant('/api/extract-fields',{text,targetFields:['notes','case_categories']});if(revision.current.number===current){setSuggestions(parseSuggestions(data,['notes','case_categories'],text));setSnapshot(current);}}catch{if(revision.current.number===current) setError('تعذّر اقتراح الحقول.');}}
 return <section><h3>اقتراح حقول من النص</h3><pre>{text}</pre><button type="button" onClick={()=>void extract()}>اقتراح حقول</button>{error && <p role="alert">{error}</p>}{(snapshot===revision.current.number ? suggestions : []).map((s,i)=><div key={i}><p>{s.field==='notes'?'ملاحظات':'تصنيف'} — المصدر: {s.evidence}</p><label>القيمة المقترحة{s.field==='case_categories' ? <select value={s.value} onChange={e=>setSuggestions(old=>old.map((x,j)=>j===i?{...x,value:e.target.value}:x))}>{CASE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select> : <input value={s.value} onChange={e=>setSuggestions(old=>old.map((x,j)=>j===i?{...x,value:e.target.value}:x))}/>}</label><button type="button" onClick={()=>{if(onApply(s.field,s.value)){setError('');setSuggestions(old=>old.filter((_,j)=>j!==i));}else setError('تعذّر استخدام القيمة في النموذج.');}}>استخدم في النموذج</button><button type="button" onClick={()=>setSuggestions(old=>old.filter((_,j)=>j!==i))}>تجاهل</button></div>)}</section>;
}
