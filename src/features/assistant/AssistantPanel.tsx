import {useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {postAssistant} from './api';
type Result={coverage:{partial:boolean;explanation:string};answer:string;sources:{familyCode:string;caseId:string;fileName?:string}[]};
const examples=['ابحث عن حالة فيها علاج','إيه الحالات المسجلة للأسرة بالكود؟','إيه التبرعات العينية المسجلة؟'];
export function AssistantPanel(){const [question,setQuestion]=useState('');const [result,setResult]=useState<Result|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');setResult(null);try{setResult(await postAssistant('/api/assistant',{question}) as Result)}catch{setError('تعذّر الحصول على إجابة. حاول تاني بعد شوية.')}finally{setBusy(false)}}
 return <section className="page-card assistant-page">
  <header className="page-heading"><div><h1>المساعد الذكي</h1><p>اسأل عن الحالات والتبرعات اللي مسموح لك تشوفها.</p></div></header>
  <aside className="assistant-guidance"><strong>خلي بالك</strong><p>الإجابة ممكن تكون ناقصة. راجع ملف الحالة قبل ما تعتمد على الإجابة، والمساعد مش بيحدد مين يستحق المساعدة.</p></aside>
  <div className="assistant-examples" aria-label="أمثلة لأسئلة"><span>ممكن تسأل:</span>{examples.map(example=><button type="button" className="secondary" key={example} onClick={()=>{setQuestion(example);setResult(null);setError('');}}>{example}</button>)}</div>
  <form className="assistant-form" onSubmit={submit}><label>سؤالك<textarea required maxLength={2000} value={question} onChange={e=>setQuestion(e.target.value)}/></label><button disabled={busy||!question.trim()}>{busy?'جاري البحث…':'اسأل المساعد'}</button>{busy?<p role="status">بدور في السجلات المسموح لك تشوفها…</p>:null}</form>
  {error && <p className="error-message" role="alert">{error}</p>}
  {result && <section className="assistant-result" aria-label="إجابة المساعد"><p className="assistant-coverage" role="status">{result.coverage.explanation}</p><div className="assistant-answer">{result.answer}</div><h2>المصادر المرتبطة بالإجابة ({result.sources.length})</h2>{result.sources.length?<ul className="record-list">{result.sources.map((s,i)=><li key={`${s.caseId}-${s.fileName??i}`}><Link to={`/cases/${s.caseId}`}>{s.familyCode}{s.fileName ? ` — ${s.fileName}` : ''}</Link></li>)}</ul>:<p className="form-help">مفيش ملفات حالة مرتبطة بالإجابة دي.</p>}</section>}
 </section>;
}
