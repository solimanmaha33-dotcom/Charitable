import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listArchivedCaseFiles, restoreCaseFile, type ArchivedCaseFile } from '../../services/cases';

const formatDate=new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium'});

export function ArchivedCasesPage() {
  const [files,setFiles]=useState<ArchivedCaseFile[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState('');
  const [restoring,setRestoring]=useState('');

  useEffect(()=>{
    let alive=true;
    listArchivedCaseFiles().then(rows=>{if(alive){setFiles(rows);setError('');}})
      .catch(()=>{if(alive)setError('تعذّر تحميل الحالات المؤرشفة. حاول تحدّث الصفحة.');})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[]);

  async function restore(file:ArchivedCaseFile) {
    setRestoring(file.id);setError('');setSaved('');
    try {
      await restoreCaseFile(file.id);
      setFiles(current=>current.filter(item=>item.id!==file.id));
      setSaved(`تم استرجاع الحالة ${file.code}.`);
    } catch {
      setError(`تعذّرت استعادة الحالة ${file.code}. حاول تاني.`);
    } finally {setRestoring('');}
  }

  return <section className="page-card archived-cases-page">
    <p><Link to="/cases">رجوع للحالات</Link></p>
    <header className="page-heading"><div><h1>الحالات المؤرشفة</h1><p>الملفات دي محفوظة، وتقدر ترجعها لقائمة الحالات النشطة.</p></div></header>
    {saved&&<p className="success-message" role="status">{saved}</p>}
    {error&&<p className="error-message" role="alert">{error}</p>}
    {loading&&<p className="empty-state" role="status">جاري تحميل الأرشيف…</p>}
    {!loading&&!error&&!files.length&&<p className="empty-state">مفيش حالات مؤرشفة.</p>}
    {!loading&&files.length>0&&<ul className="record-list archived-case-list">{files.map(file=><li key={file.id}>
      <div className="case-summary"><strong><bdi dir="ltr">{file.code}</bdi> — {[file.father_name&&`الأب: ${file.father_name}`,file.mother_name&&`الأم: ${file.mother_name}`].filter(Boolean).join(' · ')||'الأسماء مش متسجلة'}</strong>
        <small>تم الأرشفة: <time dateTime={file.archived_at}>{formatDate.format(new Date(file.archived_at))}</time>{file.address?` — ${file.address}`:''}{file.branch_area?` — ${file.branch_area}`:''}</small>
      </div>
      <button type="button" className="secondary" disabled={restoring===file.id} onClick={()=>void restore(file)} aria-label={`استعادة الحالة ${file.code}`}>{restoring===file.id?'جاري الاستعادة…':'استعادة الحالة'}</button>
    </li>)}</ul>}
  </section>;
}
