import { createClient } from '@supabase/supabase-js';
import type { StaffProfile } from '../../src/features/auth/permissions';
export type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};
export type Context = { request: Request; env: Env };
const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};
export function adminClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: authOptions,
  });
}
export function userClient(env: Env, token?: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: authOptions,
    ...(token
      ? { global: { headers: { Authorization: `Bearer ${token}` } } }
      : {}),
  });
}
export function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export function bearer(request: Request) {
  return request.headers
    .get('Authorization')
    ?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
}
export async function staffContext({ request, env }: Context) {
  const token = bearer(request);
  if (!token) return null;
  const client = userClient(env, token);
  // PostgREST verifies signature; staff_profile enforces live staff/session policy in PostgreSQL.
  const { data, error } = await client.rpc('staff_profile');
  if (error || !data) return null;
  return { client, profile: data as StaffProfile, token };
}
export async function body(
  request: Request,
): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    return null;
  if (Number(request.headers.get('Content-Length')) > 4096) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0;
  let text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const data: unknown = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
export const validCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(value);
export const validPassword = (value: unknown, min = 1): value is string =>
  typeof value === 'string' && value.length >= min && value.length <= 256;
const permissionNames = [
  'casesRead',
  'casesWrite',
  'donationsRead',
  'donationsWrite',
  'assistantUse',
];
export function validPermissions(
  value: unknown,
): value is Record<string, boolean> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([k, v]) => permissionNames.includes(k) && typeof v === 'boolean',
    )
  );
}
