import { beforeEach, expect, it, vi } from 'vitest';
import { addBranch, deactivateBranch, listBranches, listInactiveBranches, reactivateBranch } from './branches';

type BranchRow = { id: string; name: string; active: boolean };
const state = vi.hoisted(() => ({
  branches: [
    {id:'branch-fayoum',name:'الفيوم - جبل النجار',active:true},
    {id:'branch-cairo',name:'القاهرة - المرج',active:true},
    {id:'branch-old',name:'فرع قديم',active:false},
  ] as BranchRow[],
  inserted: [] as string[],
  insertError: null as { message: string; code?: string } | null,
}));

vi.mock('./supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      if (table !== 'case_branches') throw new Error('Unexpected table');
      let activeFilter: boolean | undefined;
      let branchId: string | undefined;
      const query = {
        select: () => query,
        eq: (column: string, value: string | boolean) => {
          if (column === 'is_active') activeFilter = value as boolean;
          if (column === 'id') branchId = value as string;
          return query;
        },
        order: () => query,
        insert: (row: { name: string }) => {
          state.inserted.push(row.name);
          return Promise.resolve({ error: state.insertError });
        },
        update: (row: { is_active: boolean }) => ({
          eq: (column: string, value: string | boolean) => {
            if (column === 'id') branchId = value as string;
            return { eq: () => ({ select: () => ({ maybeSingle: async () => {
              const branch = state.branches.find((item) => item.id === branchId && item.active !== row.is_active);
              if (branch) branch.active = row.is_active;
              return { data: branch ? { id: branch.id } : null, error: null };
            } }) }) };
          },
        }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({
          data: state.branches.filter((branch) => activeFilter === undefined || branch.active === activeFilter).map(({id,name}) => ({id,name})),
          error: null,
        }).then(resolve),
      };
      return query;
    },
  }),
}));

beforeEach(() => {
  state.branches = [
    {id:'branch-fayoum',name:'الفيوم - جبل النجار',active:true},
    {id:'branch-cairo',name:'القاهرة - المرج',active:true},
    {id:'branch-old',name:'فرع قديم',active:false},
  ];
  state.inserted.length = 0;
  state.insertError = null;
});

it('lists active and inactive branch names separately in a stable order', async () => {
  expect(await listBranches()).toEqual([{id:'branch-cairo',name:'القاهرة - المرج'}, {id:'branch-fayoum',name:'الفيوم - جبل النجار'}]);
  expect(await listInactiveBranches()).toEqual([{id:'branch-old',name:'فرع قديم'}]);
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

it('deactivates a branch without deleting its saved record', async () => {
  await deactivateBranch('branch-cairo');
  expect(state.branches.find(({id}) => id === 'branch-cairo')).toMatchObject({active:false});
  expect(await listBranches()).not.toContainEqual({id:'branch-cairo',name:'القاهرة - المرج'});
  expect(await listInactiveBranches()).toContainEqual({id:'branch-cairo',name:'القاهرة - المرج'});
});

it('reactivates an inactive branch so staff can choose it again', async () => {
  await reactivateBranch('branch-old');
  expect(state.branches.find(({id}) => id === 'branch-old')).toMatchObject({active:true});
  expect(await listBranches()).toContainEqual({id:'branch-old',name:'فرع قديم'});
  expect(await listInactiveBranches()).not.toContainEqual({id:'branch-old',name:'فرع قديم'});
});
