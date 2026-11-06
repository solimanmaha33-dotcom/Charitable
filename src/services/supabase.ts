import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StaffProfile } from '../features/auth/permissions';
let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // Only public project configuration belongs in VITE_ variables.
  client ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
export async function currentStaff(): Promise<StaffProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('staff_profile');
  return error ? null : data;
}
export async function signIn(
  employeeCode: string,
  password: string,
): Promise<void> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeCode, password }),
  });
  if (!response.ok)
    throw new Error('تعذّر تسجيل الدخول. راجع الكود وكلمة السر وحاول تاني.');
  const { session } = await response.json();
  const supabase = getSupabase();
  if (!supabase) throw new Error('تعذّر تسجيل الدخول.');
  const { error } = await supabase.auth.setSession(session);
  if (error) throw new Error('تعذّر تسجيل الدخول.');
}
export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error('تعذّر تسجيل الخروج. حاول تاني.');
  await supabase.auth.signOut({ scope: 'local' });
}
