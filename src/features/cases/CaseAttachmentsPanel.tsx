import {useEffect,useState} from 'react';
import {downloadCaseAttachment,listCaseAttachments,removeCaseAttachment,uploadCaseAttachment,type CaseAttachment} from '../../services/cases';
import {FilePicker} from '../files/FilePicker';
import {FilePreview} from '../files/FilePreview';
import {CaseIdScanner} from './CaseIdScanner';
import type {CaseFile} from '../../services/cases';

export function CaseAttachmentsPanel({caseFile,canWrite,onCaseFileUpdated,refreshKey=0}:{caseFile:CaseFile;canWrite:boolean;onCaseFileUpdated:()=>void;refreshKey?:number}) {
 const caseFileId=caseFile.id;
 const [files,setFiles]=useState<CaseAttachment[]>([]);const [selected,setSelected]=useState<File[]>([]);const [socialResearch,setSocialResearch]=useState<File[]>([]);const [preview,setPreview]=useState<File|null>(null);
 const [removeId,setRemoveId]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function refresh() { setFiles(await listCaseAttachments(caseFileId)); }
 useEffect(()=>{let active=true;setLoading(true);listCaseAttachments(caseFileId).then(rows=>{if(active)setFiles(rows);}).catch(()=>{if(active)setError('مش قادرين نحمّل المرفقات. حدّث الصفحة وجرب تاني.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[caseFileId,refreshKey]);
 async function upload() {
  setBusy(true);setError('');let remaining=[...selected];let changed=false;
  try {for(const file of selected){await uploadCaseAttachment(caseFileId,file);changed=true;remaining=remaining.slice(1);setSelected(remaining);}await refresh();}
  catch {setError('في ملفات ما اترفعتش. حاول تاني؛ الملفات اللي اترفعت هتظهر في القائمة.');try{await refresh();}catch{/* Keep the upload error visible. */}}
  finally {if(changed)onCaseFileUpdated();setBusy(false);}
 }
 async function uploadSocialResearch(){
  if(!socialResearch.length)return;
  let remaining=[...socialResearch];let changed=false;
  setBusy(true);setError('');
  try{for(const file of socialResearch){await uploadCaseAttachment(caseFileId,file,'social_research');changed=true;remaining=remaining.slice(1);setSocialResearch(remaining);}await refresh();}
  catch{setError('في ملفات ما اترفعتش. اللي اترفع هيظهر في القائمة؛ جرّب ترفع الباقي تاني.');try{await refresh();}catch{/* Keep the upload error visible. */}}
  finally{if(changed)onCaseFileUpdated();setBusy(false);}
 }
 async function remove(file:CaseAttachment) {
  setBusy(true);setError('');let changed=false;try {await removeCaseAttachment(file.id);changed=true;setRemoveId('');if(preview?.name===file.file_name)setPreview(null);await refresh();}
  catch {setError('ماعرفناش نحذف الملف. حاول تاني.');}finally{if(changed)onCaseFileUpdated();setBusy(false);}
 }
 const hasSocialResearch=files.some(file=>file.document_type==='social_research');
 return <section className="section-block family-files-panel" aria-labelledby="family-files-title">
  <div className="section-heading"><h2 id="family-files-title">مرفقات الحالة</h2><span>{files.length} مرفقات</span></div>
  <p className="form-help">الصور وملفات PDF بتفضل خاصة بملف الحالة، وبيشوفها الموظف المسموح له بس.</p>
  {error&&<p className="error-message" role="alert">{error}</p>}{loading&&<p role="status">بنحمّل المرفقات…</p>}
  {!loading&&<div className={`social-research-status ${hasSocialResearch?'social-research-present':'social-research-missing'}`} role="status"><span className="social-research-light" aria-hidden="true"/>{hasSocialResearch?'ملف البحث الاجتماعي مرفوع.':'ملف البحث الاجتماعي مش مرفوع. ارفعه لو موجود؛ ده مش هيمنع حفظ الحالة.'}</div>}
  {!loading&&!files.length&&<div className="empty-state">مفيش صور أو ملفات مضافة للحالة.</div>}
  {!!files.length&&<ul className="record-list">{files.map(file=><li key={file.id} className="family-file-row"><div><button type="button" className="secondary" disabled={busy} onClick={()=>void downloadCaseAttachment(file).then(setPreview).catch(()=>setError('مش قادرين نفتح الملف.'))}>{file.file_name}</button><small>{file.document_type==='social_research'?'البحث الاجتماعي':'مرفق عادي'} · {Math.max(1,Math.ceil(file.size_bytes/1024))} كيلوبايت</small></div>
   {canWrite&&<span className="family-file-actions">{removeId===file.id?<><button type="button" disabled={busy} onClick={()=>void remove(file)}>تأكيد الحذف</button><button type="button" className="secondary" disabled={busy} onClick={()=>setRemoveId('')}>إلغاء</button></>:<button type="button" className="secondary" disabled={busy} aria-label={`حذف ${file.file_name}`} onClick={()=>setRemoveId(file.id)}>حذف</button>}</span>}
  </li>)}</ul>}
  {preview&&<FilePreview file={preview}/>}
  {canWrite&&<CaseIdScanner caseFile={caseFile} onSaved={async()=>{onCaseFileUpdated();await refresh();}}/>}
  {canWrite&&<div className="family-file-upload"><FilePicker legend="البحث الاجتماعي" label="اختار البحث الاجتماعي (صورة أو PDF)" files={socialResearch} onChange={setSocialResearch}/>{socialResearch.length>0&&<button type="button" disabled={busy} onClick={()=>void uploadSocialResearch()}>{busy?'جاري رفع البحث…':'رفع البحث الاجتماعي'}</button>}<FilePicker legend="مرفقات تانية" label="إضافة صور أو PDF للحالة" files={selected} onChange={setSelected}/>{selected.length>0&&<button type="button" disabled={busy} onClick={()=>void upload()}>{busy?'جاري رفع الملفات…':'رفع المرفقات'}</button>}</div>}
 </section>;
}
