import { beforeEach, expect, it, vi } from 'vitest';
import { addBranch, listBranches, removeBranch } from './branches';

const state = vi.hoisted(() => ({
  names: ['الفيوم - جبل النجار', 'القاهرة - المرج'],
  inserted: [] as string[],
  deleted: [] as string[],
  insertError: null as { message: string; code?: string } | null,
}));

vi.mock('./supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      if (table !== 'case_branches') throw new Error('Unexpected table');
      const query = {
        select: () => query,
        order: () => query,
        insert: (row: { name: string }) => {
          state.inserted.push(row.name);
          return Promise.resolve({ error: state.insertError });
        },
        delete: () => ({
          eq: (_column: string, name: string) => {
            state.deleted.push(name);
            return Promise.resolve({ error: null });
          },
        }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: state.names.map((name) => ({ name })), error: null }).then(resolve),
      };
      return query;
    },
  }),
}));

beforeEach(() => {
  state.names = ['الفيوم - جبل النجار', 'القاهرة - المرج'];
  state.inserted.length = 0;
  state.deleted.length = 0;
  state.insertError = null;
});

it('lists branch names in Arabic alphabetical order', async () => {
  expect(await listBranches()).toEqual(['القاهرة - المرج', 'الفيوم - جبل النجار']);
});

it('trims a new branch name before saving', async () => {
  await addBranch('  فرع جديد  ');
  expect(state.inserted).toEqual(['فرع جديد']);
});

it('rejects blank and duplicate branch names before saving', async () => {
  await expect(addBranch('   ')).rejects.toThrow('اكتب اسم الفرع');
  await expect(addBranch('ف'.repeat(101))).rejects.toThrow('١٠٠ حرف');
  state.insertError = { code: '23505', message: 'duplicate key' };
  await expect(addBranch('القاهرة - المرج')).rejects.toThrow('الفرع موجود بالفعل');
  expect(state.inserted).toEqual(['القاهرة - المرج']);
});

it('removes only the selected branch from the branch catalog', async () => {
  await removeBranch('فرع قديم');
  expect(state.deleted).toEqual(['فرع قديم']);
});
