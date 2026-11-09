import { afterEach, expect, it, vi } from 'vitest';
import { signOut } from './supabase';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  localStorage.clear();
});
it.each(['network error', 'server error'] as const)(
  'clears the persisted local session when logout has a %s',
  async (failure) => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'synthetic-public-key');
    const { getSupabase, signOut: logout } = await import('./supabase');
    const supabase = getSupabase()!;
    const storageKey = 'sb-localhost-auth-token';
    const expiry = 4_102_444_800;
    const payload = btoa(JSON.stringify({
      sub: '51000000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      exp: expiry,
    })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: `e30.${payload}.synthetic-signature`,
      refresh_token: 'synthetic-refresh-token',
      token_type: 'bearer',
      expires_in: expiry,
      expires_at: expiry,
      user: {
        id: '51000000-0000-0000-0000-000000000001',
        aud: 'authenticated',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        created_at: '2026-01-01T00:00:00.000Z',
      },
    }));
    expect((await supabase.auth.getSession()).data.session).not.toBeNull();
    if (failure === 'network error') {
      vi.stubGlobal('fetch', async () => { throw new TypeError('offline'); });
    } else {
      vi.stubGlobal('fetch', async () => Response.json({ error: 'failed' }, { status: 503 }));
    }

    await expect(logout()).rejects.toThrow('تعذّر تسجيل الخروج');
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect((await supabase.auth.getSession()).data.session).toBeNull();
  },
);
it('succeeds when no Supabase configuration is present and no session exists', async () => {
  await expect(signOut()).resolves.toBeUndefined();
});
