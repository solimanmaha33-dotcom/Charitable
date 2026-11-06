import {
  adminClient,
  bearer,
  json,
  userClient,
  type Context,
} from '../../_shared/supabase';
export async function onRequestPost({
  request,
  env,
}: Context): Promise<Response> {
  const token = bearer(request);
  if (!token) return json({ error: 'Access denied' }, 401);
  try {
    const client = userClient(env, token);
    const revoked = await client.rpc('revoke_staff_session');
    if (revoked.error) return json({ error: 'Logout failed' }, 401);
    // RLS rejects this access token from the committed revocation onward, even if Auth invalidation fails.
    const result = await adminClient(env).auth.admin.signOut(token, 'local');
    if (result.error && result.error.status !== 404)
      return json({ error: 'Logout failed' }, 503);
    return json({ ok: true });
  } catch {
    return json({ error: 'Logout failed' }, 503);
  }
}
