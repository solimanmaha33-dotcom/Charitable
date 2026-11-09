import { getSupabase } from './supabase';

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

export async function listBranches(): Promise<string[]> {
  const { data, error } = await db().from('case_branches').select('name').order('name');
  check(error);
  const firstBranches = ['القاهرة - المرج', 'الفيوم - جبل النجار'];
  return (data ?? []).map((row) => row.name as string).sort((left, right) => {
    const leftIndex = firstBranches.indexOf(left);
    const rightIndex = firstBranches.indexOf(right);
    if (leftIndex >= 0 || rightIndex >= 0) return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
    return left.localeCompare(right, 'ar');
  });
}

export async function addBranch(name: string): Promise<void> {
  const normalized = name.trim();
  if (!normalized) throw new Error('اكتب اسم الفرع');
  if (normalized.length > 100) throw new Error('اسم الفرع لازم يكون ١٠٠ حرف أو أقل');
  const { error } = await db().from('case_branches').insert({ name: normalized });
  check(error);
}

export async function removeBranch(name: string): Promise<void> {
  const { error } = await db().from('case_branches').delete().eq('name', name);
  check(error);
}
