import { afterEach, expect, it, vi } from 'vitest';
import { signOut } from './supabase';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  localStorage.clear();
});
it('keeps failed logout visible and retains the session until server revocation succeeds', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'synthetic-public-key');
  const { getSupabase, signOut: logout } = await import('./supabase');
  const supabase = getSupabase()!;
  // Supabase's persistence reader is the external dependency here, not the logout behavior.
  vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
    data: { session: { access_token: 'synthetic-token' } as never },
    error: null,
  });
  const localSignOut = vi.spyOn(supabase.auth, 'signOut');
  vi.stubGlobal('fetch', async () =>
    Response.json({ error: 'failed' }, { status: 503 }),
  );
  await expect(logout()).rejects.toThrow('تعذّر تسجيل الخروج');
  expect(localSignOut).not.toHaveBeenCalled();
});
it('succeeds when no Supabase configuration is present and no session exists', async () => {
  await expect(signOut()).resolves.toBeUndefined();
});
