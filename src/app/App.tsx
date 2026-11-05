import { BrowserRouter } from 'react-router-dom';
import { Router } from './Router';
import { AppShell } from '../shared/AppShell';

export function App() {
  return <BrowserRouter><AppShell><Router /></AppShell></BrowserRouter>;
}
