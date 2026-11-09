import { getSupabase } from './supabase';

export type CaseBranch = { id: string; name: string };

const firstBranches = ['القاهرة - المرج', 'الفيوم - جبل النجار'];

function sortBranches(branches: CaseBranch[]): CaseBranch[] {
  return branches.sort((left, right) => {
    const leftIndex = firstBranches.indexOf(left.name);
    const rightIndex = firstBranches.indexOf(right.name);
    if (leftIndex >= 0 || rightIndex >= 0) return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
    return left.name.localeCompare(right.name, 'ar');
  });
}

function db() {
  const client = getSupabase();
  if (!client) throw new Error('تعذّر الاتصال بقاعدة البيانات');
  return client;
}

function check(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === '23505') throw new Error('الفرع موجود بالفعل');
  throw new Error(error.message || 'تعذّر حفظ الفرع');
}

export async function listBranches(): Promise<CaseBranch[]> {
  const { data, error } = await db().from('case_branches').select('id,name').eq('is_active', true).order('name');
  check(error);
  return sortBranches((data ?? []) as CaseBranch[]);
}

export async function listInactiveBranches(): Promise<CaseBranch[]> {
  const { data, error } = await db().from('case_branches').select('id,name').eq('is_active', false).order('name');
  check(error);
  return sortBranches((data ?? []) as CaseBranch[]);
}

export async function addBranch(name: string): Promise<void> {
  const normalized = name.trim();
  if (!normalized) throw new Error('اكتب اسم الفرع');
  if (normalized.length > 100) throw new Error('اسم الفرع لازم يكون ١٠٠ حرف أو أقل');
  const { error } = await db().from('case_branches').insert({ name: normalized });
  check(error);
}

export async function deactivateBranch(branchId: string): Promise<void> {
  const { data, error } = await db().from('case_branches').update({ is_active: false }).eq('id', branchId).eq('is_active', true).select('id').maybeSingle();
  check(error);
  if (!data) throw new Error('الفرع مش موجود أو متوقف بالفعل');
}

export async function reactivateBranch(branchId: string): Promise<void> {
  const { data, error } = await db().from('case_branches').update({ is_active: true }).eq('id', branchId).eq('is_active', false).select('id').maybeSingle();
  check(error);
  if (!data) throw new Error('الفرع مش موجود أو شغال بالفعل');
}
