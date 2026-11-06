import { getSupabase } from './supabase';
import type { CaseCategory } from '../features/cases/categories';
export type Family = { id: string; code: string; name: string; phone: string | null };
export type Member = { person_id: string; relationship: string; people: { name: string } };
export type FamilyMember = Member & { family_id: string };
export type CaseRecord = { id: string; family_id: string; notes: string; case_categories: { category: CaseCategory }[] };
function db() { const client = getSupabase(); if (!client) throw new Error('تعذّر الاتصال بقاعدة البيانات'); return client; }
function check(error: { message: string } | null) { if (error) throw new Error(error.message); }
const PAGE_SIZE = 500;
async function allPages<T>(fetchPage: (start: number, end: number) => PromiseLike<{data: T[] | null; error: {message:string} | null}>): Promise<T[]> {
 const result: T[]=[];
 for (let start=0;;start+=PAGE_SIZE) {
  const {data,error}=await fetchPage(start,start+PAGE_SIZE-1); check(error);
  const page=data ?? []; result.push(...page); if (page.length<PAGE_SIZE) return result;
 }
}
export async function listFamilies(): Promise<Family[]> {
 return allPages((start,end)=>db().from('families').select('id,code,name,phone').order('id').range(start,end));
}
export async function getFamily(id: string): Promise<Family | null> {
 const {data,error}=await db().from('families').select('id,code,name,phone').eq('id',id).maybeSingle(); check(error); return data;
}
export async function saveFamily(id: string | null, name: string, phone: string): Promise<string> {
 const query = id ? db().from('families').update({name,phone: phone || null}).eq('id',id) : db().from('families').insert({name,phone: phone || null});
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
