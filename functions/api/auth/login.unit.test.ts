import { beforeEach, expect, it, vi } from 'vitest';
import { onRequestPost } from './login';

const dependencies = vi.hoisted(() => ({
  adminClient: vi.fn(),
  userClient: vi.fn(),
  consumeAttempt: vi.fn(),
}));

vi.mock('../../_shared/supabase', () => ({
  adminClient: dependencies.adminClient,
  userClient: dependencies.userClient,
  body: async (request: Request) => request.json(),
  json: (value: unknown, status = 200) => Response.json(value, { status }),
  validCode: (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(value),
  validPassword: (value: unknown) => typeof value === 'string' && value.length > 0,
}));

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.consumeAttempt.mockImplementation(async (_name, { bucket }: { bucket: string }) => ({
    data: bucket.startsWith('ip:'),
    error: null,
  }));
  dependencies.adminClient.mockReturnValue({ rpc: dependencies.consumeAttempt });
});

it('limits by hashed employee code and shared client IP and gives an Egyptian Arabic lockout message', async () => {
  const response = await onRequestPost({
    request: new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '192.0.2.10' },
      body: JSON.stringify({ employeeCode: 'STAFF-1', password: 'synthetic-password' }),
    }),
    env: { SUPABASE_URL: 'http://localhost', SUPABASE_ANON_KEY: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' },
  });

  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: 'محاولات دخول كتير غلط للحساب ده.. استنى شوية أو ارجع لمدير النظام' });
  expect(dependencies.consumeAttempt).toHaveBeenCalledTimes(2);
  expect(dependencies.consumeAttempt).toHaveBeenCalledWith('consume_login_attempt', {
    bucket: expect.stringMatching(/^code:[a-f0-9]{64}$/),
    maximum: 10,
  });
  expect(dependencies.consumeAttempt).toHaveBeenCalledWith('consume_login_attempt', {
    bucket: expect.stringMatching(/^ip:[a-f0-9]{64}$/),
    maximum: 100,
  });
  expect(dependencies.userClient).not.toHaveBeenCalled();
});

it('keeps an aggregate IP limit when an attacker tries different employee codes', async () => {
  let ipCalls = 0;
  const allowedCodeBuckets: string[] = [];
  dependencies.consumeAttempt.mockImplementation(async (name, args: { bucket: string } | { code: string }) => {
    if (name === 'lookup_staff_login') return { data: null, error: null };
    const { bucket } = args as { bucket: string };
    if (bucket.startsWith('code:')) allowedCodeBuckets.push(bucket);
    return { data: bucket.startsWith('code:') || ipCalls++ === 0, error: null };
  });
  dependencies.userClient.mockReturnValue({ auth: { signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: new Error('unknown code') }) } });
  const request = (employeeCode: string) => onRequestPost({
    request: new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '192.0.2.10' },
      body: JSON.stringify({ employeeCode, password: 'synthetic-password' }),
    }),
    env: { SUPABASE_URL: 'http://localhost', SUPABASE_ANON_KEY: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' },
  });

  const first = await request('STAFF-1');
  const second = await request('STAFF-2');

  expect(first.status).toBe(401);
  expect(second.status).toBe(429);
  expect(await second.json()).toEqual({ error: 'محاولات دخول كتير من نفس الشبكة.. استنى شوية وحاول تاني' });
  expect(allowedCodeBuckets).toHaveLength(2);
  const calls = dependencies.consumeAttempt.mock.calls.filter(([name]) => name === 'consume_login_attempt').map(([, args]) => args.bucket);
  expect(calls.filter(bucket => bucket.startsWith('ip:'))).toHaveLength(2);
  expect(calls[1]).toBe(calls[3]);
  expect(dependencies.userClient).toHaveBeenCalledOnce();
});
