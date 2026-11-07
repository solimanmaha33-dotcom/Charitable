import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '../../services/supabase';
export function LoginPage({ onSignedIn }: { onSignedIn: () => void }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await signIn(
        String(form.get('employeeCode')),
        String(form.get('password')),
      );
      onSignedIn();
      navigate('/');
    } catch {
      setError('تعذّر تسجيل الدخول. راجع الكود وكلمة السر وحاول تاني.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="page-card login-card">
      <div className="login-intro"><h1>تسجيل الدخول</h1><p>اكتب كود الموظف وكلمة السر عشان تدخل على نظام الجمعية.</p></div>
      <form onSubmit={submit} className="login-form">
        <label htmlFor="employee-code">كود الموظف</label>
        <input
          id="employee-code"
          name="employeeCode"
          autoComplete="username"
          required
          maxLength={32}
          dir="ltr"
        />
        <label htmlFor="staff-password">كلمة السر</label>
        <input
          id="staff-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? 'جاري الدخول…' : 'دخول'}
        </button>
        <p>لو نسيت كلمة السر، تواصل مع المدير العام لاستعادة الدخول.</p>
      </form>
    </section>
  );
}
