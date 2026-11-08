import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { downloadCaseFile, listCaseFiles, type CaseFile, getCase, getFamily, listAllMembers, listMembers, listCases, listFamilies, type CaseRecord, type FamilyProfile, type Family, type FamilyMember, type Member } from '../../services/cases';
import { normalizeArabicSearch } from './arabicSearch';
import { FilePreview } from '../files/FilePreview';
import { CaseForm } from './CaseForm';
import { CasePrintDocument } from './CasePrintDocument';
import { CaseIntakeForm } from './CaseIntakeForm';
export function CaseDetailsPage({ canWrite }: { canWrite: boolean }) {
 const {id}=useParams(); const [params]=useSearchParams(); const navigate=useNavigate();
 const [families,setFamilies]=useState<Family[]>([]); const [members,setMembers]=useState<FamilyMember[]>([]); const [records,setRecords]=useState<CaseRecord[]>([]); const [record,setRecord]=useState<CaseRecord | null>(null); const [family,setFamily]=useState<FamilyProfile | null>(null); const [caseMembers,setCaseMembers]=useState<Member[]>([]);
 const [attachments,setAttachments]=useState<CaseFile[]>([]); const [preview,setPreview]=useState<File | null>(null); const [previewId,setPreviewId]=useState('');
 const [search,setSearch]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(true); const [editing,setEditing]=useState(id==='new');
 const tableWrap=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  let alive=true; setLoading(true); setError(''); setRecord(null); setFamily(null); setCaseMembers([]); setAttachments([]); setPreview(null); setEditing(id==='new');
  async function load() {
   if (!id) { const [f,c,m]=await Promise.all([listFamilies(),listCases(),listAllMembers()]); if(alive){setFamilies(f);setRecords(c);setMembers(m);} }
   else if (id==='new') { const f=await listFamilies(); if(alive)setFamilies(f); }
   else { const c=await getCase(id); const [f,options,files,people]=await Promise.all([c ? getFamily(c.family_id) : Promise.resolve(null),canWrite ? listFamilies() : Promise.resolve([]),c ? listCaseFiles(c.id) : Promise.resolve([]),c ? listMembers(c.family_id) : Promise.resolve([])]); if(alive){setRecord(c);setFamily(f);setFamilies(options);setAttachments(files);setCaseMembers(people);} }
   if(alive)setLoading(false);
  }
  void load().catch(()=>{if(alive){setError('تعذّر تحميل الحالات.');setLoading(false);}}); return ()=>{alive=false;};
 },[id,canWrite]);
 const familiesById=new Map(families.map(f=>[f.id,f]));
 const memberNames=new Map<string,string[]>(); for(const m of members) memberNames.set(m.family_id,[...(memberNames.get(m.family_id) ?? []),m.people.name]);
 const term=normalizeArabicSearch(search);
 const matches=records.filter(c=>{const f=familiesById.get(c.family_id); return [f?.name ?? '',f?.code ?? '',...(memberNames.get(c.family_id) ?? []),...c.case_categories.map(x=>x.category)].some(value=>normalizeArabicSearch(value).includes(term));});
 useEffect(()=>{if(!loading && window.matchMedia?.('(max-width: 680px)').matches && tableWrap.current)tableWrap.current.scrollLeft=tableWrap.current.scrollWidth;},[loading,id,matches.length]);
 if (!id) return <section className="page-card">
  <header className="page-heading"><div><h1>الحالات</h1><p>دور على حالة باسم الأسرة أو الفرد أو التصنيف.</p></div>{canWrite && <Link className="primary-link" to="/cases/new">إضافة حالة</Link>}</header>
  <div className="toolbar"><label className="search-control">بحث عن حالة<input type="search" role="searchbox" aria-label="بحث عن حالة" placeholder="اكتب اسم الأسرة أو الفرد أو الكود أو التصنيف" value={search} onChange={e=>setSearch(e.target.value)} /></label></div>
  {loading && <p className="empty-state" role="status">جاري تحميل الحالات…</p>}{error && <p className="error-message" role="alert">{error}</p>}
  {!loading && !error && records.length===0 && <div className="empty-state"><strong>لسه مفيش حالات مسجلة</strong>{canWrite ? <Link to="/cases/new">ابدأ بإضافة حالة</Link> : 'الحالات الجديدة هتظهر هنا.'}</div>}
  {!loading && !error && records.length>0 && matches.length===0 && <div className="empty-state"><strong>ملقيناش حالات مطابقة</strong>جرّب كلمة تانية.</div>}
  {!loading && !error && matches.length>0 && <><div className="table-caption">الحالات المعروضة: {matches.length}</div><div className="data-table-wrap" ref={tableWrap}><table className="data-table" aria-label="قائمة الحالات">
   <thead><tr><th scope="col">كود الأسرة واسمها</th><th scope="col">أفراد الأسرة</th><th scope="col">نوع الحالة</th><th scope="col">ملاحظات</th><th scope="col"><span className="sr-only">فتح الحالة</span></th></tr></thead>
   <tbody>{matches.map(c=>{const f=familiesById.get(c.family_id);return <tr key={c.id}><td><Link to={`/cases/${c.id}`}><span className="family-code">{f?.code ?? '—'}</span>{f ? ` — ${f.name}` : ''}</Link></td><td>{(memberNames.get(c.family_id) ?? []).join('، ') || <span className="muted-cell">مش متسجل</span>}</td><td>{c.case_categories.length ? c.case_categories.map(x=><span className="category-label" key={x.category}>{x.category}</span>) : <span className="muted-cell">مفيش تصنيف</span>}</td><td>{c.notes || <span className="muted-cell">مفيش ملاحظات</span>}</td><td><Link className="table-action" to={`/cases/${c.id}`}>فتح الحالة</Link></td></tr>;})}</tbody>
  </table></div></>}
 </section>;
 return <section className="page-card">
  <p><Link to="/cases">رجوع لقائمة الحالات</Link></p>
  <header className="page-heading"><div><h1>{id==='new' ? 'إضافة حالة' : 'ملف الحالة'}</h1><p>{id==='new' ? 'سجّل ملف الأسرة والحالة مع بعض، خطوة بخطوة.' : 'بيانات الحالة والمستندات المرتبطة بيها.'}</p></div>{record && !editing && <div className="heading-actions"><button type="button" className="secondary" onClick={()=>window.print()}>طباعة الحالة</button>{canWrite && <button type="button" className="secondary" onClick={()=>setEditing(true)}>تعديل الحالة</button>}</div>}</header>
  {error && <p className="error-message" role="alert">{error}</p>}{loading && id!=='new' && <p role="status">جاري تحميل الحالة…</p>}{!loading && !error && id!=='new' && !record && <div className="empty-state"><strong>الحالة مش موجودة</strong><Link to="/cases">ارجع لقائمة الحالات</Link></div>}{!loading && id==='new' && !canWrite && <p className="error-message">معندكش صلاحية لإضافة حالة.</p>}
  {record && !editing && <>
   <div className="family-summary"><div><span className="muted-cell">ملف الأسرة</span><h2><Link to={`/cases/family/${record.family_id}`}>{family?.code} — {family?.name}</Link></h2></div><div><span className="muted-cell">نوع الحالة</span><div>{record.case_categories.map(c=><span className="category-label" key={c.category}>{c.category}</span>)}</div></div></div>
   {family&&<CasePrintDocument family={family} record={record} members={caseMembers} attachments={attachments}/>}
   <section className="section-block"><h2>ملاحظات الحالة</h2><p>{record.notes || 'مفيش ملاحظات متسجلة.'}</p></section>
   <section className="section-block"><div className="section-heading"><h2>الصور والمستندات</h2>{canWrite && <button type="button" className="secondary" onClick={()=>setEditing(true)}>إضافة مستند أو تعديل الحالة</button>}</div>
    {attachments.length ? <ul className="record-list">{attachments.map(file=><li key={file.id}><button type="button" className="secondary" onClick={()=>void downloadCaseFile(file).then(result=>{setPreview(result);setPreviewId(file.id);}).catch(()=>setError('تعذّر تحميل المرفق.'))}>{file.file_name}</button></li>)}</ul> : <div className="empty-state">مفيش صور أو مستندات مضافة للحالة.</div>}
    {preview && <FilePreview key={previewId} file={preview} fileId={previewId} canWrite={canWrite}/>}
   </section>
  </>}
  {!loading && canWrite && editing && id==='new' && !params.get('family') && <CaseIntakeForm onSaved={saved=>navigate(`/cases/${saved}`)} />}
  {!loading && canWrite && editing && (id==='new' && params.get('family') || id!=='new' && record) && <CaseForm key={id} families={families} record={id==='new' ? undefined : record ?? undefined} initialFamily={params.get('family') ?? undefined} onSaved={saved=>{setEditing(false); if(saved===id){void getCase(saved).then(async c=>{const [nextFamily,files,people]=await Promise.all([c ? getFamily(c.family_id) : Promise.resolve(null),listCaseFiles(saved),c ? listMembers(c.family_id):Promise.resolve([])]);setRecord(c);setFamily(nextFamily);setAttachments(files);setCaseMembers(people);}).catch(()=>setError('اتحفظت الحالة، بس تعذّر تحديث الملف.'));} else navigate(`/cases/${saved}`);}} />}
 </section>;
}
