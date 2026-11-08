import { BrowserRouter } from 'react-router-dom';
import { Router } from './Router';
import { AppShell } from '../shared/AppShell';
import { useState } from 'react';
import type { StaffProfile } from '../features/auth/permissions';
import { signOut } from '../services/supabase';

export function App() {
  const [staff, setStaff] = useState<StaffProfile | null | undefined>(undefined);
  const [logoutError, setLogoutError] = useState('');
  async function logout() {
    try { await signOut(); setStaff(null); setLogoutError(''); }
    catch { setLogoutError('تعذّر تسجيل الخروج. حاول تاني.'); }
  }
  return <BrowserRouter><AppShell staff={staff ?? null} onSignOut={logout} logoutError={logoutError}><Router session={staff} onStaffChange={setStaff} /></AppShell></BrowserRouter>;
}
