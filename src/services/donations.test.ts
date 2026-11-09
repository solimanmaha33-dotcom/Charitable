import { expect, it, vi } from 'vitest';
import { cancelDonation, countDonations, generateInstallments, utcToday, voidPayment } from './donations';

const query = vi.hoisted(() => ({ select: vi.fn(), is: vi.fn(), rpc: vi.fn() }));
vi.mock('./supabase', () => ({ getSupabase: () => ({ from: vi.fn(() => query), rpc: query.rpc }) }));

it('counts only active donations without loading donation records', async () => {
  query.select.mockImplementationOnce(() => query);
  query.is.mockResolvedValueOnce({ count: 12, error: null });
  expect(await countDonations()).toBe(12);
  expect(query.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
  expect(query.is).toHaveBeenCalledWith('voided_at', null);
});

it('fails rather than reporting zero when the database omits the count', async () => {
  query.select.mockImplementationOnce(() => query);
  query.is.mockResolvedValueOnce({ count: null, error: null });
  await expect(countDonations()).rejects.toThrow('تعذّر تحميل العدد');
});

it('records cancellations and voids only with a clear reason', async () => {
 query.rpc.mockResolvedValue({ error:null });
 await cancelDonation('donation-1','تم التسجيل بالخطأ');
 await voidPayment('payment-1','الدفعة اتسجلت مرتين');
 expect(query.rpc).toHaveBeenNthCalledWith(1,'cancel_donation',{p_id:'donation-1',p_reason:'تم التسجيل بالخطأ'});
 expect(query.rpc).toHaveBeenNthCalledWith(2,'void_sponsorship_payment',{p_id:'payment-1',p_reason:'الدفعة اتسجلت مرتين'});
 await expect(cancelDonation('donation-1','   ')).rejects.toThrow('سبب الإلغاء مطلوب');
 await expect(voidPayment('payment-1','   ')).rejects.toThrow('سبب الإلغاء مطلوب');
});

it('uses the Cairo date when generating donation dates before Cairo midnight', async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-01-31T22:30:00.000Z'));
    query.rpc.mockResolvedValueOnce({ error: null });
    expect(utcToday()).toBe('2026-02-01');
    await generateInstallments();
    expect(query.rpc).toHaveBeenCalledWith('generate_sponsorship_installments', { p_through: '2026-03-03' });
  } finally {
    vi.useRealTimers();
  }
});
