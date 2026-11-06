import { useState, type FormEvent } from 'react';
import { saveFamily, type Family } from '../../services/cases';
export function FamilyForm({ family, onSaved }: { family?: Family; onSaved: (id: string) => void }) {
 const [name,setName]=useState(family?.name ?? ''); const [phone,setPhone]=useState(family?.phone ?? '');
 const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { onSaved(await saveFamily(family?.id ?? null,name.trim(),phone.trim())); } catch { setError('تعذّر حفظ الأسرة. حاول تاني.'); } finally { setBusy(false); } }
 return <form className="domain-form" onSubmit={submit}><label>اسم الأسرة<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)} /></label><label>رقم الهاتف (اختياري)<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} /></label><button disabled={busy || !name.trim()}>حفظ الأسرة</button>{error && <p role="alert">{error}</p>}</form>;
}
