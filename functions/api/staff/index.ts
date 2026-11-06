import {
  adminClient,
  body,
  json,
  staffContext,
  validCode,
  validPassword,
  validPermissions,
  type Context,
} from '../../_shared/supabase';
export async function onRequestPost(context: Context): Promise<Response> {
  try {
    const staff = await staffContext(context);
    if (!staff) return json({ error: 'Access denied' }, 401);
    if (staff.profile.role === 'employee')
      return json({ error: 'Access denied' }, 403);
    const input = await body(context.request);
    if (
      !input ||
      !validCode(input.employeeCode) ||
      typeof input.displayName !== 'string' ||
      !input.displayName.trim() ||
      input.displayName.length > 100 ||
      !validPassword(input.password, 12) ||
      !validPermissions(input.permissions) ||
      !['employee', 'manager', 'general_manager'].includes(String(input.role))
    )
      return json({ error: 'Invalid staff details' }, 400);
    if (staff.profile.role === 'manager' && input.role !== 'employee')
      return json({ error: 'Access denied' }, 403);
    const admin = adminClient(context.env);
    const created = await admin.auth.admin.createUser({
      email: `${crypto.randomUUID()}@staff.invalid`,
      password: input.password,
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      return json({ error: 'Unable to create staff' }, 400);
    const registered = await staff.client.rpc('register_employee', {
      p_auth_user_id: created.data.user.id,
      p_employee_code: input.employeeCode,
      p_display_name: input.displayName.trim(),
      p_role: input.role,
      p_permissions: input.permissions,
    });
    if (registered.error) {
      await admin.auth.admin.deleteUser(created.data.user.id);
      return json(
        { error: 'Unable to create staff' },
        registered.error.code === '42501' ? 403 : 409,
      );
    }
    return json(
      {
        id: registered.data,
        employeeCode: input.employeeCode,
        displayName: input.displayName.trim(),
        role: input.role,
      },
      201,
    );
  } catch {
    return json({ error: 'Unable to create staff' }, 503);
  }
}
export async function onRequestPatch(context: Context): Promise<Response> {
  try {
    const staff = await staffContext(context);
    if (!staff) return json({ error: 'Access denied' }, 401);
    const input = await body(context.request);
    if (
      !input ||
      typeof input.employeeId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(input.employeeId)
    )
      return json({ error: 'Invalid staff details' }, 400);
    if (input.active === false) {
      if (staff.profile.role !== 'general_manager')
        return json({ error: 'Access denied' }, 403);
      const result = await staff.client.rpc('deactivate_employee', {
        employee: input.employeeId,
      });
      return result.error
        ? json({ error: 'Unable to update staff' }, 403)
        : json({ ok: true });
    }
    if (!validPermissions(input.permissions))
      return json({ error: 'Invalid staff details' }, 400);
    const result = await staff.client.rpc('set_employee_permissions', {
      employee: input.employeeId,
      permissions: input.permissions,
    });
    return result.error
      ? json({ error: 'Unable to update staff' }, 403)
      : json({ ok: true });
  } catch {
    return json({ error: 'Unable to update staff' }, 503);
  }
}
