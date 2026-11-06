import { getSupabase } from './supabase';
import type { CaseCategory } from '../features/cases/categories';
export type Family = { id: string; code: string; name: string; phone: string | null };
export type Member = { person_id: string; relationship: string; people: { name: string } };
export type CaseRecord = { id: string; family_id: string; notes: string; case_categories: { category: CaseCategory }[] };
function db() { const client = getSupabase(); if (!client) throw new Error('تعذّر الاتصال بقاعدة البيانات'); return client; }
function check(error: { message: string } | null) { if (error) throw new Error(error.message); }
export async function listFamilies(): Promise<Family[]> { const {data,error} = await db().from('families').select('id,code,name,phone').order('code'); check(error); return data ?? []; }
export async function saveFamily(id: string | null, name: string, phone: string): Promise<string> {
 const query = id ? db().from('families').update({name,phone: phone || null}).eq('id',id) : db().from('families').insert({name,phone: phone || null});
 const {data,error}=await query.select('id').single(); check(error); if (!data) throw new Error('تعذّر حفظ الأسرة'); return data.id;
}
export async function listMembers(familyId: string): Promise<Member[]> {
 const {data,error}=await db().from('family_members').select('person_id,relationship,people(name)').eq('family_id',familyId); check(error); return (data ?? []) as unknown as Member[];
}
export async function addMember(familyId: string, name: string, relationship: string): Promise<void> {
 const {error}=await db().rpc('add_family_member',{p_family_id:familyId,p_name:name,p_relationship:relationship}); check(error);
}
export async function listCases(familyId?: string): Promise<CaseRecord[]> {
 let query=db().from('cases').select('id,family_id,notes,case_categories(category)').order('created_at',{ascending:false});
 if (familyId) query=query.eq('family_id',familyId);
 const {data,error}=await query; check(error); return (data ?? []) as CaseRecord[];
}
export async function saveCase(id: string | null, familyId: string, notes: string, categories: CaseCategory[]): Promise<string> {
 const {data,error}=await db().rpc('save_case',{p_id:id,p_family_id:familyId,p_notes:notes,p_categories:categories}); check(error); return data;
}
