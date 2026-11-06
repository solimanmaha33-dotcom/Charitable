import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { onRequestPost as login } from './login';
import { onRequestPost as logout } from './logout';
import {
  onRequestPost as createStaff,
  onRequestPatch as updateStaff,
} from '../staff/index';
import type { Env } from '../../_shared/supabase';
let env: Env;
let admin: SupabaseClient;
let managerToken: string;
let gmToken: string;
const suffix = crypto.randomUUID().slice(0, 8);
const created: string[] = [];
const request = (path: string, data: unknown, token?: string) =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'CF-Connecting-IP': `2001:db8::${suffix.slice(0, 4)}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
async function signIn(code: string, password = 'synthetic-password-123') {
  return login({
    request: request('/api/auth/login', { employeeCode: code, password }),
    env,
  });
}
async function fixture(role: string, code: string) {
  const email = `${crypto.randomUUID()}@staff.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'synthetic-password-123',
    email_confirm: true,
  });
  if (error || !data.user) throw new Error('Synthetic Auth fixture failed');
  created.push(data.user.id);
  // Private fixture insertion through local psql only; no real data or credentials printed.
  const sql = `insert into public.employees(id, employee_code, display_name, role) values ('${data.user.id}','${code}','Synthetic','${role}'); insert into private.employee_auth(employee_id,auth_user_id) values ('${data.user.id}','${data.user.id}');`;
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_charitable-case-system',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: sql, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const auth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await auth.auth.signInWithPassword({
    email,
    password: 'synthetic-password-123',
  });
  if (!signedIn.data.session)
    throw new Error(
      `Synthetic sign-in failed: ${signedIn.error?.code}: ${signedIn.error?.message}`,
    );
  return signedIn.data.session.access_token;
}
beforeAll(async () => {
  const status = JSON.parse(
    execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }),
  );
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL))
    throw new Error('Local Supabase required');
  env = {
    SUPABASE_URL: status.API_URL,
    SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  };
  admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  gmToken = await fixture('general_manager', `G${suffix}`);
  managerToken = await fixture('manager', `M${suffix}`);
}, 60000);
afterAll(async () => {
  if (!created.length) return;
  const ids = created.map((id) => `'${id}'`).join(',');
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_charitable-case-system',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
    ],
    {
      input: `delete from private.staff_audit where actor_id in (${ids}) or employee_id in (${ids}); delete from private.employee_auth where auth_user_id in (${ids}); delete from public.employees where id in (${ids});`,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  for (const id of created) await admin.auth.admin.deleteUser(id);
});
describe('local staff authentication boundary', () => {
  it('returns tokens and public profile without internal email/user mapping', async () => {
    const response = await signIn(`G${suffix}`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.profile.role).toBe('general_manager');
    expect(data.session.access_token).toBeTruthy();
    expect(data.session.refresh_token).toBeTruthy();
    expect(JSON.stringify(data)).not.toContain('@staff.invalid');
    expect(data.session.user).toBeUndefined();
    const claims = JSON.parse(
      Buffer.from(
        data.session.access_token.split('.')[1],
        'base64url',
      ).toString(),
    );
    expect(claims.email).toBe('');
  });
  it('uses the same failure for unknown codes and wrong passwords', async () => {
    const a = await signIn(`missing${suffix}`);
    const b = await signIn(`G${suffix}`, 'wrong');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(await a.json()).toEqual(await b.json());
  });
  it('rejects invalid input and unauthenticated staff creation', async () => {
    expect(
      (
        await login({
          request: request('/api/auth/login', {
            employeeCode: {},
            password: [],
          }),
          env,
        })
      ).status,
    ).toBe(400);
    expect(
      (await createStaff({ request: request('/api/staff', {}), env })).status,
    ).toBe(401);
  });
  it('manager cannot create managers or remove access', async () => {
    const body = {
      employeeCode: `BAD${suffix}`,
      displayName: 'Synthetic',
      password: 'synthetic-password-123',
      role: 'manager',
      permissions: {},
    };
    expect(
      (
        await createStaff({
          request: request('/api/staff', body, managerToken),
          env,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await updateStaff({
          request: request(
            '/api/staff',
            { employeeId: created[0], active: false },
            managerToken,
          ),
          env,
        })
      ).status,
    ).toBe(403);
  });
  it('manager can create only employee-level staff and general manager can deactivate without erasure', async () => {
    const response = await createStaff({
      request: request(
        '/api/staff',
        {
          employeeCode: `E${suffix}`,
          displayName: 'Synthetic employee',
          password: 'synthetic-password-123',
          role: 'employee',
          permissions: { casesRead: true },
        },
        managerToken,
      ),
      env,
    });
    expect(response.status).toBe(201);
    const employee = await response.json();
    expect(employee.role).toBe('employee');
    const signedIn = await signIn(`E${suffix}`);
    expect(signedIn.status).toBe(200);
    const { session } = await signedIn.json();
    const caller = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(
      (await caller.rpc('has_permission', { permission: 'casesRead' })).data,
    ).toBe(true);
    expect(
      (
        await updateStaff({
          request: request(
            '/api/staff',
            { employeeId: employee.id, active: false },
            gmToken,
          ),
          env,
        })
      ).status,
    ).toBe(200);
    expect(
      (await caller.rpc('has_permission', { permission: 'casesRead' })).data,
    ).toBe(false);
    expect((await signIn(`E${suffix}`)).status).toBe(401);
    expect(
      (
        await admin
          .from('employees')
          .select('id')
          .eq('id', employee.id)
          .single()
      ).data?.id,
    ).toBe(employee.id);
    // Created employee has a separate public ID. Cleanup uses database lookup without printing the mapping.
    execFileSync(
      'docker',
      [
        'exec',
        '-i',
        'supabase_db_charitable-case-system',
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
      ],
      {
        input: `delete from private.staff_audit where employee_id='${employee.id}'; delete from private.employee_auth where employee_id='${employee.id}'; delete from public.employees where id='${employee.id}'; delete from auth.users where id='${JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString()).sub}';`,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  });
  it('returns a conflict when permission snapshot is stale and preserves the revocation', async () => {
    await fixture('employee', `C${suffix}`); const employeeId=created[created.length-1];
    const update=(expectedPermissions:object, permissions:object)=>updateStaff({request:request('/api/staff',{employeeId,expectedPermissions,permissions},managerToken),env});
    expect((await update({}, {casesRead:true})).status).toBe(200);
    expect((await update({casesRead:true}, {})).status).toBe(200);
    expect((await update({casesRead:true}, {casesRead:true,donationsRead:true})).status).toBe(409);
    const result=await admin.from('employee_permissions').select('cases_read,donations_read').eq('employee_id',employeeId).single();
    expect(result.data).toEqual({cases_read:false,donations_read:false});
    expect((await updateStaff({request:request('/api/staff',{employeeId,permissions:{}},managerToken),env})).status).toBe(400);
  });
  it('logout rejects an already-issued access token immediately and revokes refresh', async () => {
    const { session } = await (await signIn(`G${suffix}`)).json();
    expect(
      (
        await logout({
          request: request('/api/auth/logout', {}, session.access_token),
          env,
        })
      ).status,
    ).toBe(200);
    const caller = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(
      (await caller.rpc('has_permission', { permission: 'casesRead' })).data,
    ).toBe(false);
    expect(
      (
        await caller.auth.refreshSession({
          refresh_token: session.refresh_token,
        })
      ).error,
    ).not.toBeNull();
  });
  it('preserves normal sessions across client recreation and rejects refresh at the original 30-day deadline', async () => {
    const { session } = await (await signIn(`M${suffix}`)).json();
    const storage = new Map<string, string>();
    const options = {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        storage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => {
            storage.set(key, value);
          },
          removeItem: (key: string) => {
            storage.delete(key);
          },
        },
      },
    };
    const first = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      options,
    );
    expect((await first.auth.setSession(session)).error).toBeNull();
    const reopened = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      options,
    );
    expect((await reopened.auth.getSession()).data.session?.access_token).toBe(
      session.access_token,
    );
    const refreshed = await reopened.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    const claims = JSON.parse(
      Buffer.from(session.access_token.split('.')[1], 'base64url').toString(),
    );
    const newClaims = JSON.parse(
      Buffer.from(
        refreshed.data.session!.access_token.split('.')[1],
        'base64url',
      ).toString(),
    );
    expect(newClaims.session_id).toBe(claims.session_id);
    execFileSync(
      'docker',
      [
        'exec',
        '-i',
        'supabase_db_charitable-case-system',
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      {
        input: `update auth.sessions set created_at=now()-interval '30 days',not_after=now() where id='${claims.session_id}';`,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    expect(
      (await reopened.rpc('has_permission', { permission: 'casesRead' })).data,
    ).toBe(false);
    expect((await reopened.auth.refreshSession()).error).not.toBeNull();
  });
  it('a general manager can create a manager while managers cannot grant general-manager access', async () => {
    expect(
      (
        await createStaff({
          request: request(
            '/api/staff',
            {
              employeeCode: `BADG${suffix}`,
              displayName: 'Synthetic',
              password: 'synthetic-password-123',
              role: 'general_manager',
              permissions: {},
            },
            managerToken,
          ),
          env,
        })
      ).status,
    ).toBe(403);
    const response = await createStaff({
      request: request(
        '/api/staff',
        {
          employeeCode: `NEWM${suffix}`,
          displayName: 'Synthetic manager',
          password: 'synthetic-password-123',
          role: 'manager',
          permissions: {},
        },
        gmToken,
      ),
      env,
    });
    expect(response.status).toBe(201);
    const employee = await response.json();
    expect(employee.role).toBe('manager');
    execFileSync(
      'docker',
      [
        'exec',
        '-i',
        'supabase_db_charitable-case-system',
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      {
        input: `delete from private.staff_audit where employee_id='${employee.id}'; with mapping as (delete from private.employee_auth where employee_id='${employee.id}' returning auth_user_id) delete from auth.users where id in (select auth_user_id from mapping); delete from public.employees where id='${employee.id}';`,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  });
  it('limits repeated login attempts per employee code', async () => {
    let last: Response | undefined;
    for (let i = 0; i < 12; i++) last = await signIn(`brute${suffix}`, 'wrong');
    expect(last!.status).toBe(429);
  });
});
