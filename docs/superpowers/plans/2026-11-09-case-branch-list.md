# Case Branch List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared branch options and a branch-management dialog to case intake, while accepting monthly income as digits only.

**Architecture:** Store selectable branch names in a small Supabase table protected by the existing case read/write permission check. Keep the selected branch name as text on each case so removing a branch affects future choices without changing old files. Sanitize monthly income at the form boundary and validate it again in the case service.

**Tech Stack:** React, TypeScript, Vitest, Supabase Postgres migrations and RLS.

**Spec:** `docs/superpowers/specs/2026-11-09-case-branch-list.md`

## Global Constraints

- Initial selectable branches are «القاهرة - المرج» and «الفيوم - جبل النجار».
- The third branch-field choice opens branch management.
- Deleting a branch only removes it from selectable branch names; saved case text remains unchanged.
- Monthly income input contains digits only; no commas, decimal points, spaces, or letters.
- No existing case file data is migrated or deleted.

## Review Focus

- A staff member without case read permission cannot read the branch list; test RLS policy.
- A staff member without case write permission cannot add or delete branch names; test RLS policies.
- A case with a removed or historical branch can still be edited without silently losing that value; test existing branch fallback.
- Duplicate or whitespace-only branch names cannot be added; test input validation.
- Income pasted with commas or letters is normalized at input and rejected by service if it bypasses the form; test both boundaries.

---

### Task 1: Branch catalog migration

**Files:**
- Create: `supabase/migrations/023_case_branches.sql`
- Test: `supabase/tests/case_branches.test.sql`

**Interfaces:**
- Creates `public.case_branches(id uuid, name text unique, created_at timestamptz)`.
- Seeds «القاهرة - المرج» and «الفيوم - جبل النجار».
- Grants authenticated select/insert/delete, with RLS using `has_permission('casesRead')` for select and `has_permission('casesWrite')` for writes.

- [x] **Step 1: Write SQL tests** for seed values, duplicate-name rejection, read/write permission checks, and removed branch text remaining on a case file.
- [x] **Step 2: Run the SQL test** with `npx supabase test db supabase/tests/case_branches.test.sql`; it failed because the table did not exist.
- [x] **Step 3: Add migration** with the table, two seeded values, grants, RLS, and policies.
- [x] **Step 4: Rerun the SQL test**; all 13 assertions passed.

### Task 2: Branch-list service

**Files:**
- Create: `src/services/branches.ts`
- Test: `src/services/branches.test.ts`

**Interfaces:**
- `listBranches(): Promise<string[]>`
- `addBranch(name: string): Promise<void>`; trims, rejects empty/duplicate names, and limits names to 100 characters.
- `removeBranch(name: string): Promise<void>`; deletes only the catalog row.

- [x] **Step 1: Write tests** for listing sorted names, trimming and adding, duplicate/blank/too-long rejection, and removal.
- [x] **Step 2: Run the service tests**; they failed because the new module did not exist.
- [x] **Step 3: Implement the service** using the existing `getSupabase()` and error-handling patterns.
- [x] **Step 4: Rerun service tests**; all cases passed.

### Task 3: Intake branch manager and numeric income

**Files:**
- Modify: `src/features/cases/CaseIntakeForm.tsx`
- Test: `src/features/cases/CaseIntakeForm.test.tsx`
- Modify: `src/services/cases.ts`
- Test: `src/services/cases.test.ts`

**Interfaces:**
- The branch select starts with the two seeded names and «إضافة فرع جديد».
- The dialog lists current branches and offers add/remove actions. Success refreshes the list; failures remain visible in the dialog.
- A saved branch missing from the catalog remains visible as the current historical selection.
- Monthly income state contains digits only; service rejects non-numeric values.

- [x] **Step 1: Write UI tests** for the two options, opening/closing the management dialog, adding and removing a branch, preserving an unlisted existing branch, and stripping commas/letters from income input.
- [x] **Step 2: Run the focused UI tests**; branch selection and numeric-only income failed as expected.
- [x] **Step 3: Implement the select/dialog** with accessible labels and the branch service; implement numeric-only income handling.
- [x] **Step 4: Write and run service tests** proving malformed income is rejected by the case service.
- [x] **Step 5: Rerun focused UI and service tests**; all passed.

### Task 4: Documentation and project verification

**Files:**
- Modify: `docs/data-model.md`
- Modify: `docs/progress.md`

- [x] **Step 1: Document** the shared branch catalog and that saved branch text is preserved on catalog removal.
- [x] **Step 2: Run** `npm test -- --run`, `npm run build`, and `git diff --check`; all passed.
- [x] **Step 3: Run** `npx supabase test db supabase/tests/case_branches.test.sql`; it passed, and migration 023 is applied locally only.
