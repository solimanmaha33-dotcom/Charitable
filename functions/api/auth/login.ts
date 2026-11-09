import {
  adminClient,
  body,
  json,
  userClient,
  validCode,
  validPassword,
  type Context,
} from '../../_shared/supabase';
const failure = {
  error: 'تعذّر تسجيل الدخول. راجع الكود وكلمة السر وحاول تاني.',
};
const lockout = {
  error: 'محاولات دخول كتير غلط للحساب ده.. استنى شوية أو ارجع لمدير النظام',
};
const sourceLockout = {
  error: 'محاولات دخول كتير من نفس الشبكة.. استنى شوية وحاول تاني',
};
async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function onRequestPost({
  request,
  env,
}: Context): Promise<Response> {
  const input = await body(request);
  if (
    !input ||
    !validCode(input.employeeCode) ||
    !validPassword(input.password)
  )
    return json(failure, 400);
  try {
    const admin = adminClient(env);
    // Keep both limits: one account cannot be guessed repeatedly, and cycling
    // through employee codes cannot bypass the aggregate source limit.
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const [codeHash, ipHash] = await Promise.all([
      digest(input.employeeCode),
      digest(ip),
    ]);
    const limits = await Promise.all([
      admin.rpc('consume_login_attempt', {
        bucket: `code:${codeHash}`,
        maximum: 10,
      }),
      admin.rpc('consume_login_attempt', {
        bucket: `ip:${ipHash}`,
        maximum: 100,
      }),
    ]);
    if (limits.some((limit) => limit.error)) return json(failure, 503);
    if (!limits[1].data) return json(sourceLockout, 429);
    if (!limits[0].data) return json(lockout, 429);
    const lookup = await admin.rpc('lookup_staff_login', {
      code: input.employeeCode,
    });
    if (lookup.error) return json(failure, 503);
    // Unknown and inactive codes still take the Auth password path and get the same generic response.
    const email = lookup.data || `${crypto.randomUUID()}@staff.invalid`;
    const client = userClient(env);
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (error || !data.session || !lookup.data) return json(failure, 401);
    const caller = userClient(env, data.session.access_token);
    const profile = await caller.rpc('staff_profile');
    if (profile.error || !profile.data) {
      await caller.rpc('revoke_staff_session');
      await admin.auth.admin.signOut(data.session.access_token, 'local');
      return json(failure, 401);
    }
    const { access_token, refresh_token, expires_in, expires_at, token_type } =
      data.session;
    return json({
      session: {
        access_token,
        refresh_token,
        expires_in,
        expires_at,
        token_type,
      },
      profile: profile.data,
    });
  } catch {
    return json(failure, 503);
  }
}
