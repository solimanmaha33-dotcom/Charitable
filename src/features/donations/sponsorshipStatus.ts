/** Calendar dates only: an unpaid installment becomes late the day after its due date. */
export function getSponsorshipStatus(dueDate: string, receivedAt: string | null, today: string): 'due' | 'received' | 'late' {
 for (const date of [dueDate,today,...(receivedAt ? [receivedAt] : [])]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw new Error('Expected a valid calendar date');
 }
 return receivedAt ? 'received' : dueDate < today ? 'late' : 'due';
}
