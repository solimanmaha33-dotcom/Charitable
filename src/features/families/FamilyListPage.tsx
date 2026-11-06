import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addMember, listCases, listFamilies, listMembers, type Family, type Member, type CaseRecord } from '../../services/cases';
import { normalizeArabicSearch } from '../cases/arabicSearch';
import { FamilyForm } from './FamilyForm';
export function FamilyListPage({ canWrite }: { canWrite: boolean }) {
 const [families,setFamilies]=useState<Family[]>([]); const [search,setSearch]=useState(''); const [error,setError]=useState(''); const [adding,setAdding]=useState(false);
 const navigate=useNavigate();
 useEffect(()=>{ let alive=true; listFamilies().then(data=>{if(alive)setFamilies(data);}).catch(()=>{if(alive)setError('تعذّر تحميل الأسر.');}); return ()=>{alive=false;}; },[]);
 const matches=families.filter(f=>normalizeArabicSearch(`${f.name} ${f.code}`).includes(normalizeArabicSearch(search)));
 return <section className="page-card"><h1>الأسر</h1><label>بحث بالاسم أو الكود<input value={search} onChange={e=>setSearch(e.target.value)} /></label>{canWrite && <button onClick={()=>setAdding(!adding)}>إضافة أسرة</button>}{adding && <FamilyForm onSaved={id=>navigate(`/families/${id}`)} />}{error && <p role="alert">{error}</p>}<ul>{matches.map(f=><li key={f.id}><Link to={`/families/${f.id}`}>{f.code} — {f.name}</Link></li>)}</ul></section>;
}
export function FamilyDetailsPage({ canWrite }: { canWrite: boolean }) {
 const {id}=useParams(); const [family,setFamily]=useState<Family>(); const [members,setMembers]=useState<Member[]>([]); const [cases,setCases]=useState<CaseRecord[]>([]); const [error,setError]=useState(''); const [editing,setEditing]=useState(false); const [name,setName]=useState(''); const [relationship,setRelationship]=useState(''); const [busy,setBusy]=useState(false);
 async function refresh() { if (!id) return; const [families,people,records]=await Promise.all([listFamilies(),listMembers(id),listCases(id)]); setFamily(families.find(f=>f.id===id)); setMembers(people); setCases(records); }
 useEffect(()=>{void refresh().catch(()=>setError('تعذّر تحميل الأسرة.'));},[id]);
 async function submit(e: React.FormEvent) { e.preventDefault(); if(!id)return; setBusy(true); setError(''); try { await addMember(id,name.trim(),relationship.trim()); setName(''); setRelationship(''); await refresh(); } catch { setError('تعذّر إضافة الفرد.'); } finally { setBusy(false); } }
 return <section className="page-card"><h1>ملف الأسرة</h1>{error && <p role="alert">{error}</p>}{family && <><h2>{family.code} — {family.name}</h2>{family.phone && <p>الهاتف: {family.phone}</p>}{canWrite && <button onClick={()=>setEditing(!editing)}>تعديل الأسرة</button>}{editing && <FamilyForm family={family} onSaved={()=>{setEditing(false); void refresh().catch(()=>setError('تعذّر تحميل الأسرة.'));}} />}<h2>أفراد الأسرة</h2><ul>{members.map(m=><li key={m.person_id}>{m.people.name} — {m.relationship}</li>)}</ul>{canWrite && <form className="domain-form" onSubmit={submit}><label>اسم الفرد<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)} /></label><label>صلة القرابة<input required maxLength={100} value={relationship} onChange={e=>setRelationship(e.target.value)} /></label><button disabled={busy || !name.trim() || !relationship.trim()}>إضافة فرد</button></form>}<h2>الحالات</h2>{canWrite && <Link to={`/cases/new?family=${family.id}`}>إضافة حالة</Link>}<ul>{cases.map(c=><li key={c.id}><Link to={`/cases/${c.id}`}>{c.case_categories.map(x=>x.category).join('، ') || 'حالة'} </Link></li>)}</ul></>}</section>;
}
