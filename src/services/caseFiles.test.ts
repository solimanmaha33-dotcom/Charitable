import { beforeEach, expect, it, vi } from 'vitest';
import { getCaseFile, listCaseAttachments, listCaseFiles, saveCaseFile } from './cases';

const state = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; columns: string }>,
  rpc: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rows: {
    families: [{ id: 'file-1', code: 'F-0001', father_name: 'أب', mother_name: 'أم', phone: '0100', phone_2: '0101', phone_3: null, address: 'عنوان', monthly_income: 1200, health_condition: 'متابعة', branch_area: 'الفرع', file_status: 'تحت المراجعة', status_reason: null, case_file_categories: [{ category: 'هجر' }] }],
    case_attachments: [{ id: 'att-1', family_id: 'file-1', storage_path: 'file-1/path', file_name: 'مستند.pdf', mime_type: 'application/pdf', size_bytes: 10, uploaded_by: 'staff-1', extracted_text: 'نص عربي', created_at: '2026-11-09' }],
  } as Record<string, Array<Record<string, unknown>>>,
}));

vi.mock('./supabase', () => ({
  getSupabase: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => { state.rpc.push({ name, args }); return { data: 'file-new', error: null }; },
    from: (table: string) => {
      let data = state.rows[table] ?? [];
      let start = 0; let end = 499;
      const query = {
        select: (columns = '*') => { state.calls.push({ table, columns }); return query; },
        eq: (column: string, value: unknown) => { data = data.filter((row) => row[column] === value); return query; },
        order: () => query,
        range: (first: number, last: number) => { start = first; end = last; return query; },
        maybeSingle: async () => ({ data: data[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: data.slice(start, end + 1), error: null }).then(resolve),
      };
      return query;
    },
  }),
}));

beforeEach(() => { state.calls.length = 0; state.rpc.length = 0; });

it('lists and loads a single case file with categories and no legacy family name', async () => {
  expect(await listCaseFiles()).toEqual(state.rows.families);
  expect(await getCaseFile('file-1')).toEqual(state.rows.families[0]);
  expect(state.calls[0]?.columns).toContain('case_file_categories(category)');
  expect(state.calls[0]?.columns).not.toContain(',name,');
});

it('saves the complete profile and categories through one atomic RPC', async () => {
  const id = await saveCaseFile(null, {
    fatherName: 'أب', motherName: 'أم', contactName: 'المسؤولة', contactRelationship: 'الأم', contactAge: 40,
    nationalId: '29001011234567', nationalIdExpiresOn: '2027-01-01', phones: ['0100', '0101', ''], notes: 'ملاحظات',
    address: 'عنوان', monthlyIncome: 1200, healthCondition: 'متابعة', branchArea: 'الفرع',
    fileStatus: 'موقوف', statusReason: 'مراجعة الأوراق', categories: ['هجر'],
  });
  expect(id).toBe('file-new');
  expect(state.rpc).toEqual([{ name: 'save_case_file', args: {
    p_id: null,
    p_profile: {
      father_name: 'أب', mother_name: 'أم', contact_name: 'المسؤولة', contact_relationship: 'الأم', contact_age: 40,
      national_id: '29001011234567', national_id_expires_on: '2027-01-01', phone: '0100', phone_2: '0101', phone_3: null,
      notes: 'ملاحظات', address: 'عنوان', monthly_income: 1200, health_condition: 'متابعة', branch_area: 'الفرع',
      file_status: 'موقوف', status_reason: 'مراجعة الأوراق',
    },
    p_categories: ['هجر'],
  } }]);
});

it('requires a reason for a held or rejected file before saving', async () => {
  const input = {
    fatherName: '', motherName: 'أم', contactName: '', contactRelationship: '', contactAge: null,
    nationalId: '', nationalIdExpiresOn: '', phones: [], notes: '', address: '', monthlyIncome: null,
    healthCondition: '', branchArea: '', fileStatus: 'مرفوض' as const, statusReason: '   ', categories: [],
  };
  await expect(saveCaseFile(null, input)).rejects.toThrow('سبب الإيقاف أو الرفض مطلوب');
  expect(state.rpc).toHaveLength(0);
});

it('lists all file attachments by the case-file ID', async () => {
  expect(await listCaseAttachments('file-1')).toEqual(state.rows.case_attachments);
  expect(state.calls.at(-1)).toEqual({ table: 'case_attachments', columns: '*' });
});
