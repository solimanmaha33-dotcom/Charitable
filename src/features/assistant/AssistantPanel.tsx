import {useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {postAssistant} from './api';
type Result={answer:string;sources:{familyCode:string;caseId:string;fileName?:string}[]};
export function AssistantPanel(){const [question,setQuestion]=useState('');const [result,setResult]=useState<Result|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');setResult(null);try{setResult(await postAssistant('/api/assistant',{question}) as Result)}catch{setError('تعذّر الحصول على إجابة.')}finally{setBusy(false)}}
 return <section className="page-card"><h1>المساعد</h1><form onSubmit={submit}><label>سؤالك<textarea required maxLength={2000} value={question} onChange={e=>setQuestion(e.target.value)}/></label><button disabled={busy}>اسأل</button></form>{error && <p role="alert">{error}</p>}{result && <><p>{result.answer}</p><h2>المصادر المتاحة</h2><ul>{result.sources.map((s,i)=><li key={i}><Link to={`/cases/${s.caseId}`}>{s.familyCode}{s.fileName ? ` — ${s.fileName}` : ''}</Link></li>)}</ul></>}</section>;
}
