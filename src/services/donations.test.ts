import { expect, it, vi } from 'vitest';
import { countDonations } from './donations';

const query = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock('./supabase', () => ({ getSupabase: () => ({ from: vi.fn(() => query) }) }));

it('counts donations without loading donation records', async () => {
  query.select.mockResolvedValueOnce({ count: 12, error: null });
  expect(await countDonations()).toBe(12);
  expect(query.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
});

it('fails rather than reporting zero when the database omits the count', async () => {
  query.select.mockResolvedValueOnce({ count: null, error: null });
  await expect(countDonations()).rejects.toThrow('تعذّر تحميل العدد');
});
