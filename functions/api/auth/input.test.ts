import { expect, it } from 'vitest';
import { onRequestPost as login } from './login';
import { onRequestPost as staff } from '../staff/index';
const env = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'synthetic',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic',
};
it('rejects malformed login without contacting Auth', async () => {
  const response = await login({
    request: new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"employeeCode":{},"password":[]}',
    }),
    env,
  });
  expect(response.status).toBe(400);
});
it('rejects staff changes without a bearer token', async () => {
  const response = await staff({
    request: new Request('http://localhost/api/staff', {
      method: 'POST',
      body: '{}',
    }),
    env,
  });
  expect(response.status).toBe(401);
});
