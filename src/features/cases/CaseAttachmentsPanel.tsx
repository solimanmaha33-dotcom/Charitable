import {useEffect,useState} from 'react';
import {downloadCaseAttachment,listCaseAttachments,removeCaseAttachment,uploadCaseAttachment,type CaseAttachment} from '../../services/cases';
import {FilePicker} from '../files/FilePicker';
import {FilePreview} from '../files/FilePreview';
import {CaseIdScanner} from './CaseIdScanner';
import type {CaseFile} from '../../services/cases';

export function CaseAttachmentsPanel({caseFile,canWrite,onCaseFileUpdated,refreshKey=0}:{caseFile:CaseFile;canWrite:boolean;onCaseFileUpdated:()=>void;refreshKey?:number}) {
 const caseFileId=caseFile.id;
 const [files,setFiles]=useState<CaseAttachment[]>([]);const [selected,setSelected]=useState<File[]>([]);const [preview,setPreview]=useState<File|null>(null);
 const [removeId,setRemoveId]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function refresh() { setFiles(await listCaseAttachments(caseFileId)); }
 useEffect(()=>{let active=true;setLoading(true);listCaseAttachments(caseFileId).then(rows=>{if(active)setFiles(rows);}).catch(()=>{if(active)setError('تعذّر تحميل المرفقات. حاول تحدّث الصفحة.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[caseFileId,refreshKey]);
 async function upload() {
  setBusy(true);setError('');let remaining=[...selected];
  try {for(const file of selected){await uploadCaseAttachment(caseFileId,file);remaining=remaining.slice(1);setSelected(remaining);}await refresh();}
  catch {setError('تعذّر رفع بعض الملفات. حاول تاني؛ الملفات اللي اترفعت هتظهر في القائمة.');try{await refresh();}catch{/* Keep the upload error visible. */}}
  finally {setBusy(false);}
 }
 async function remove(file:CaseAttachment) {
  setBusy(true);setError('');try {await removeCaseAttachment(file.id);setRemoveId('');if(preview?.name===file.file_name)setPreview(null);await refresh();}
  catch {setError('تعذّر حذف الملف. حاول تاني.');}finally{setBusy(false);}
 }
 return <section className="section-block family-files-panel" aria-labelledby="family-files-title">
  <div className="section-heading"><h2 id="family-files-title">مرفقات الحالة</h2><span>{files.length} مرفقات</span></div>
  <p className="form-help">صور وملفات PDF خاصة بملف الحالة، يقدر يشوفها الموظف المسموح له بقراءة الحالات.</p>
  {error&&<p className="error-message" role="alert">{error}</p>}{loading&&<p role="status">جاري تحميل المرفقات…</p>}
  {!loading&&!files.length&&<div className="empty-state">مفيش صور أو ملفات مضافة للحالة.</div>}
  {!!files.length&&<ul className="record-list">{files.map(file=><li key={file.id} className="family-file-row"><div><button type="button" className="secondary" disabled={busy} onClick={()=>void downloadCaseAttachment(file).then(setPreview).catch(()=>setError('تعذّر فتح الملف.'))}>{file.file_name}</button><small>{Math.max(1,Math.ceil(file.size_bytes/1024))} كيلوبايت</small></div>
   {canWrite&&<span className="family-file-actions">{removeId===file.id?<><button type="button" disabled={busy} onClick={()=>void remove(file)}>تأكيد الحذف</button><button type="button" className="secondary" disabled={busy} onClick={()=>setRemoveId('')}>إلغاء</button></>:<button type="button" className="secondary" disabled={busy} aria-label={`حذف ${file.file_name}`} onClick={()=>setRemoveId(file.id)}>حذف</button>}</span>}
  </li>)}</ul>}
  {preview&&<FilePreview file={preview}/>}
  {canWrite&&<CaseIdScanner caseFile={caseFile} onSaved={async()=>{onCaseFileUpdated();await refresh();}}/>}
  {canWrite&&<div className="family-file-upload"><FilePicker legend="صور ومستندات الحالة" label="إضافة صور أو PDF للحالة" files={selected} onChange={setSelected}/>{selected.length>0&&<button type="button" disabled={busy} onClick={()=>void upload()}>{busy?'جاري رفع الملفات…':'رفع المرفقات'}</button>}</div>}
 </section>;
}
