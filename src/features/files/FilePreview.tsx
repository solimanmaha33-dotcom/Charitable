import {useEffect,useState} from 'react';
import {extractDocumentText} from './ocr';
import {copyExtractedText} from './useClipboard';
export function FilePreview({file}:{file:File}) {
 const [url,setUrl]=useState(''); const [text,setText]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [copied,setCopied]=useState(false);
 useEffect(()=>{const next=URL.createObjectURL(file); setUrl(next); setText(''); setError(''); return ()=>URL.revokeObjectURL(next);},[file]);
 async function extract(){setBusy(true);setError('');try {const result=await extractDocumentText(file);setText(result.pages.map(p=>`صفحة ${p.page}:\n${p.text}`).join('\n\n'));}catch {setError('تعذّر استخراج النص. راجع الملف وحاول تاني.');}finally{setBusy(false);}}
 return <div><p>{file.name}</p>{url && (file.type==='application/pdf' ? <iframe title={`معاينة ${file.name}`} src={url} style={{width:'100%',height:400}} /> : <img src={url} alt={`معاينة ${file.name}`} style={{maxWidth:'100%',maxHeight:400}} />)}<p>استخراج النص محلي على جهازك. راجع النص بنفسك قبل استخدامه؛ قد يحتوي على أخطاء.</p><button type="button" disabled={busy} onClick={()=>void extract()}>{busy ? 'جاري استخراج النص…' : 'استخراج النص'}</button>{text && <><label>النص المستخرج للمراجعة<textarea value={text} onChange={e=>setText(e.target.value)} rows={8}/></label><button type="button" onClick={()=>void copyExtractedText(text).then(()=>setCopied(true)).catch(()=>setError('تعذّر النسخ'))}>نسخ النص</button>{copied && <span>تم النسخ</span>}</>}{error && <p role="alert">{error}</p>}</div>;
}
