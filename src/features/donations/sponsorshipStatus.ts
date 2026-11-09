import { cairoToday } from '../../shared/cairoDate';
/** Calendar dates only: an unpaid installment becomes late the day after its due date. */
export function getSponsorshipStatus(dueDate: string, receivedAt: string | null, today = cairoToday(), voidedAt: string|null = null): 'due' | 'received' | 'late' | 'voided' {
 for (const date of [dueDate,today,...(receivedAt ? [receivedAt] : []),...(voidedAt ? [voidedAt] : [])]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw new Error('Expected a valid calendar date');
 }
 return voidedAt ? 'voided' : receivedAt ? 'received' : dueDate < today ? 'late' : 'due';
}
