import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { downloadCaseFile, listCaseFiles, type CaseFile, getCase, getFamily, listAllMembers, listCases, listFamilies, type CaseRecord, type Family, type FamilyMember } from '../../services/cases';
import { normalizeArabicSearch } from './arabicSearch';
import { FilePreview } from '../files/FilePreview';
import { CaseForm } from './CaseForm';
export function CaseDetailsPage({ canWrite }: { canWrite: boolean }) {
 const {id}=useParams(); const [params]=useSearchParams(); const navigate=useNavigate();
 const [families,setFamilies]=useState<Family[]>([]); const [members,setMembers]=useState<FamilyMember[]>([]); const [records,setRecords]=useState<CaseRecord[]>([]); const [record,setRecord]=useState<CaseRecord | null>(null); const [family,setFamily]=useState<Family | null>(null);
 const [attachments,setAttachments]=useState<CaseFile[]>([]); const [preview,setPreview]=useState<File | null>(null); const [previewId,setPreviewId]=useState('');
 const [search,setSearch]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(true); const [editing,setEditing]=useState(id==='new');
 useEffect(()=>{
  let alive=true; setLoading(true); setError(''); setRecord(null); setFamily(null); setAttachments([]); setPreview(null); setEditing(id==='new');
  async function load() {
   if (!id) { const [f,c,m]=await Promise.all([listFamilies(),listCases(),listAllMembers()]); if(alive){setFamilies(f);setRecords(c);setMembers(m);} }
   else if (id==='new') { const f=await listFamilies(); if(alive)setFamilies(f); }
   else { const c=await getCase(id); const [f,options,files]=await Promise.all([c ? getFamily(c.family_id) : Promise.resolve(null),canWrite ? listFamilies() : Promise.resolve([]),c ? listCaseFiles(c.id) : Promise.resolve([])]); if(alive){setRecord(c);setFamily(f);setFamilies(options);setAttachments(files);} }
   if(alive)setLoading(false);
  }
  void load().catch(()=>{if(alive){setError('تعذّر تحميل الحالات.');setLoading(false);}}); return ()=>{alive=false;};
 },[id,canWrite]);
 const familiesById=new Map(families.map(f=>[f.id,f]));
 const memberNames=new Map<string,string[]>(); for(const m of members) memberNames.set(m.family_id,[...(memberNames.get(m.family_id) ?? []),m.people.name]);
 const term=normalizeArabicSearch(search);
 const matches=records.filter(c=>{const f=familiesById.get(c.family_id); return [f?.name ?? '',f?.code ?? '',...(memberNames.get(c.family_id) ?? []),...c.case_categories.map(x=>x.category)].some(value=>normalizeArabicSearch(value).includes(term));});
 if (!id) return <section className="page-card"><h1>الحالات</h1>{canWrite && <Link to="/cases/new">إضافة حالة</Link>}<label>بحث باسم الأسرة أو الفرد أو الكود أو التصنيف<input value={search} onChange={e=>setSearch(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<ul>{matches.map(c=>{const f=familiesById.get(c.family_id);return <li key={c.id}><Link to={`/cases/${c.id}`}>{f?.code} — {f?.name} — {c.case_categories.map(x=>x.category).join('، ') || 'حالة'}</Link></li>;})}</ul></section>;
 return <section className="page-card"><h1>{id==='new' ? 'إضافة حالة' : 'تفاصيل الحالة'}</h1>{error && <p role="alert">{error}</p>}{!loading && !error && id!=='new' && !record && <p>الحالة غير موجودة.</p>}{!loading && id==='new' && !canWrite && <p>معندكش صلاحية للإضافة.</p>}{record && !editing && <><p><Link to={`/families/${record.family_id}`}>{family?.code} — {family?.name}</Link></p><p>التصنيفات: {record.case_categories.map(c=>c.category).join('، ') || 'لا يوجد'}</p><p>الملاحظات: {record.notes || 'لا يوجد'}</p><h2>المرفقات</h2><ul>{attachments.map(file=><li key={file.id}><button onClick={()=>void downloadCaseFile(file).then(result=>{setPreview(result);setPreviewId(file.id);}).catch(()=>setError('تعذّر تحميل المرفق.'))}>{file.file_name}</button></li>)}</ul>{preview && <FilePreview key={previewId} file={preview} fileId={previewId} canWrite={canWrite}/>} {canWrite && <button onClick={()=>setEditing(true)}>تعديل الحالة</button>}</>}{!loading && canWrite && editing && (id==='new' || record) && <CaseForm key={id} families={families} record={id==='new' ? undefined : record ?? undefined} initialFamily={params.get('family') ?? undefined} onSaved={saved=>{setEditing(false); if(saved===id){void getCase(saved).then(async c=>{setRecord(c);setFamily(c ? await getFamily(c.family_id) : null);setAttachments(await listCaseFiles(saved));}).catch(()=>setError('تعذّر تحميل الحالات.'));} else navigate(`/cases/${saved}`);}} />}</section>;
}
