import { getSupabase } from './supabase';
import { validateDocument, openPdf } from '../features/files/documentText';
import type { CaseCategory } from '../features/cases/categories';
export type Family = { id: string; code: string; name: string; phone: string | null; phone_2?: string | null; phone_3?: string | null };
export type FamilyProfile = Family & { contact_name: string | null; contact_age: number | null; national_id: string | null; notes: string };
export type FamilyProfileInput = { name: string; contactName: string; contactAge: number | null; nationalId: string; phones: string[]; notes: string };
export type Member = { person_id: string; relationship: string; people: { name: string } };
export type FamilyMember = Member & { family_id: string };
export type CaseRecord = { id: string; family_id: string; notes: string; case_categories: { category: CaseCategory }[] };
function db() { const client = getSupabase(); if (!client) throw new Error('تعذّر الاتصال بقاعدة البيانات'); return client; }
function check(error: { message: string } | null) { if (error) throw new Error(error.message); }
async function countRows(table: 'families' | 'cases'): Promise<number> {
 const {count,error}=await db().from(table).select('id',{count:'exact',head:true});
 check(error);
 if(count===null) throw new Error('تعذّر تحميل العدد');
 return count;
}
const PAGE_SIZE = 500;
async function allPages<T>(fetchPage: (start: number, end: number) => PromiseLike<{data: T[] | null; error: {message:string} | null}>): Promise<T[]> {
 const result: T[]=[];
 for (let start=0;;start+=PAGE_SIZE) {
  const {data,error}=await fetchPage(start,start+PAGE_SIZE-1); check(error);
  const page=data ?? []; result.push(...page); if (page.length<PAGE_SIZE) return result;
 }
}
export async function listFamilies(): Promise<Family[]> {
 return allPages((start,end)=>db().from('families').select('id,code,name,phone,phone_2,phone_3').order('id').range(start,end));
}
export const countFamilies=()=>countRows('families');
export const countCases=()=>countRows('cases');
export async function getFamily(id: string): Promise<FamilyProfile | null> {
 const {data,error}=await db().from('families').select('id,code,name,phone,phone_2,phone_3,contact_name,contact_age,national_id,notes').eq('id',id).maybeSingle(); check(error); return data;
}
export async function saveFamily(id: string | null, input: FamilyProfileInput): Promise<string> {
 const values={name:input.name,phone:input.phones[0]||null,contact_name:input.contactName.trim()||null,contact_age:input.contactAge,national_id:input.nationalId||null,phone_2:input.phones[1]||null,phone_3:input.phones[2]||null,notes:input.notes};
 const query = id ? db().from('families').update(values).eq('id',id) : db().from('families').insert(values);
 const {data,error}=await query.select('id').single(); check(error); if (!data) throw new Error('تعذّر حفظ الأسرة'); return data.id;
}
export async function listMembers(familyId: string): Promise<Member[]> {
 return allPages((start,end)=>db().from('family_members').select('person_id,relationship,people(name)').eq('family_id',familyId).order('person_id').range(start,end)) as unknown as Promise<Member[]>;
}
export async function listAllMembers(): Promise<FamilyMember[]> {
 return allPages((start,end)=>db().from('family_members').select('family_id,person_id,relationship,people(name)').order('family_id').order('person_id').range(start,end)) as unknown as Promise<FamilyMember[]>;
}
export async function addMember(familyId: string, name: string, relationship: string): Promise<void> {
 const {error}=await db().rpc('add_family_member',{p_family_id:familyId,p_name:name,p_relationship:relationship}); check(error);
}
export async function listCases(familyId?: string): Promise<CaseRecord[]> {
 return allPages((start,end)=>{
  let query=db().from('cases').select('id,family_id,notes,case_categories(category)').order('id');
  if (familyId) query=query.eq('family_id',familyId);
  return query.range(start,end);
 }) as Promise<CaseRecord[]>;
}
export async function getCase(id: string): Promise<CaseRecord | null> {
 const {data,error}=await db().from('cases').select('id,family_id,notes,case_categories(category)').eq('id',id).maybeSingle(); check(error); return data as CaseRecord | null;
}
export async function saveCase(id: string | null, familyId: string, notes: string, categories: CaseCategory[]): Promise<string> {
 const {data,error}=await db().rpc('save_case',{p_id:id,p_family_id:familyId,p_notes:notes,p_categories:categories}); check(error); return data;
}
export type CaseFile = { id:string; case_id:string; storage_path:string; file_name:string; mime_type:string; size_bytes:number; uploaded_by:string; created_at:string };
export async function listCaseFiles(caseId:string):Promise<CaseFile[]> {
 return allPages((start,end)=>db().from('case_files').select('*').eq('case_id',caseId).order('created_at').order('id').range(start,end));
}
export async function downloadCaseFile(file:CaseFile):Promise<File> {
 const {data,error}=await db().storage.from('case-files').download(file.storage_path); check(error);
 if(!data) throw new Error('تعذّر تحميل الملف');
 return new File([data],file.file_name,{type:file.mime_type});
}
export async function uploadCaseFile(caseId:string,file:File):Promise<CaseFile> {
 validateDocument(file);
 if(file.type==='application/pdf') {const pdf=await openPdf(file); await pdf.cleanup();}
 const client=db(); const {data:{session},error:authError}=await client.auth.getSession(); check(authError);
 if(!session) throw new Error('يلزم تسجيل الدخول');
 const response=await fetch('/api/case-files/upload',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':file.type,'X-Case-Id':caseId,'X-File-Name':encodeURIComponent(file.name)},body:file});
 if(!response.ok) throw new Error('تعذّر رفع الملف');
 return await response.json() as CaseFile;
}
export type FamilyFile = { id:string; family_id:string; storage_path:string; file_name:string; mime_type:string; size_bytes:number; uploaded_by:string; created_at:string };
export async function listFamilyFiles(familyId:string):Promise<FamilyFile[]> {
 return allPages((start,end)=>db().from('family_files').select('*').eq('family_id',familyId).order('created_at').order('id').range(start,end));
}
export async function downloadFamilyFile(file:FamilyFile):Promise<File> {
 const {data,error}=await db().storage.from('case-files').download(file.storage_path); check(error);
 if(!data) throw new Error('تعذّر تحميل الملف');
 return new File([data],file.file_name,{type:file.mime_type});
}
export async function uploadFamilyFile(familyId:string,file:File):Promise<FamilyFile> {
 validateDocument(file);
 if(file.type==='application/pdf') {const pdf=await openPdf(file); await pdf.cleanup();}
 const client=db(); const {data:{session},error:authError}=await client.auth.getSession(); check(authError);
 if(!session) throw new Error('يلزم تسجيل الدخول');
 const response=await fetch('/api/family-files/upload',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':file.type,'X-Family-Id':familyId,'X-File-Name':encodeURIComponent(file.name)},body:file});
 if(!response.ok) throw new Error('تعذّر رفع الملف');
 return await response.json() as FamilyFile;
}
export async function removeFamilyFile(fileId:string):Promise<void> {
 const client=db(); const {data:{session},error:authError}=await client.auth.getSession(); check(authError);
 if(!session) throw new Error('يلزم تسجيل الدخول');
 const response=await fetch('/api/family-files/delete',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({fileId})});
 if(!response.ok) throw new Error('تعذّر حذف الملف');
}
