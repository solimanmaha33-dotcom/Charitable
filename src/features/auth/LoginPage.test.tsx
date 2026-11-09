import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
afterEach(() => vi.unstubAllGlobals());
it('submits employee code and password and shows a generic failure', async () => {
  let submitted: unknown;
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    submitted = JSON.parse(options.body as string);
    return Response.json({ error: 'Invalid login' }, { status: 401 });
  });
  render(
    <MemoryRouter>
      <LoginPage onSignedIn={() => {}} />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText('كود الموظف'), {
    target: { value: 'E0001' },
  });
  fireEvent.change(screen.getByLabelText('كلمة السر'), {
    target: { value: 'wrong-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'دخول' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
  expect(submitted).toEqual({
    employeeCode: 'E0001',
    password: 'wrong-password',
  });
  expect(screen.getByRole('alert')).toHaveTextContent('تعذّر تسجيل الدخول');
});

it('shows the server lockout instructions after too many attempts for one employee code', async () => {
  vi.stubGlobal('fetch', async () => Response.json(
    { error: 'محاولات دخول كتير غلط للحساب ده.. استنى شوية أو ارجع لمدير النظام' },
    { status: 429 },
  ));
  render(<MemoryRouter><LoginPage onSignedIn={() => {}} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('كود الموظف'), { target: { value: 'E0001' } });
  fireEvent.change(screen.getByLabelText('كلمة السر'), { target: { value: 'wrong-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'دخول' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('محاولات دخول كتير غلط للحساب ده'));
});
