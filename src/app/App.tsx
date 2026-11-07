import { BrowserRouter } from 'react-router-dom';
import { Router } from './Router';
import { AppShell } from '../shared/AppShell';
import { useState } from 'react';
import type { StaffProfile } from '../features/auth/permissions';

export function App() {
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  return <BrowserRouter><AppShell staff={staff}><Router onStaffChange={setStaff} /></AppShell></BrowserRouter>;
}
