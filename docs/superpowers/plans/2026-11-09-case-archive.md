# Recoverable Case Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let only the general manager archive and restore case files without deleting family, attachment, history, sponsorship, or payment records.

**Architecture:** Add archive timestamps and an audit table with database functions that verify the current role. Filter archived files from normal case operations and assistant search, while retaining linked sponsorship history with an archived label. Add a general-manager-only archive list and restore action.

**Tech Stack:** Supabase PostgreSQL migrations and RLS, TypeScript, React, Vitest, SQL tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-recoverable-case-archive-design.md`

## Global Constraints

- Keep the family and case file row, its members, attachments, history, sponsorships, and payments.
- Only a `general_manager` can archive or restore; the case write permission alone is insufficient.
- Normal case lists, counts, filters, age and card reminders, and assistant answers exclude archived files.
- Existing sponsorship payments remain visible and receive an archived-file label; new sponsorships use active files only.
- Do not modify already-applied migrations; add a forward-only migration.

## Review Focus

- A manager or employee directly calling archive/restore must be denied by PostgreSQL, not only hidden from the React interface. Test both RPCs with those roles.
- A case with members, private attachments, history, and received/unreceived installments must retain all related rows across archive and restore. Assert counts and links before/after.
- Directly updating a person's demographics or inserting a new sponsorship for an archived case must fail at the database boundary. Test both paths, including writes from a form that could have opened before archive.
- Attachment deletion must coordinate its Storage call with archive: failed or interrupted deletion keeps retryable metadata, and a case with pending attachment deletion cannot be archived. Only the trusted service role may finalize metadata removal after Storage confirms deletion. Test the SQL transition guard, staff denial, trusted finalize, and worker's active/archived deletion paths.
- Archiving an unknown or already archived ID must fail without duplicate audit entries. Test both invalid state transitions.
- Archived rows must disappear from active case counts, age/ID reminders, and assistant retrieval, while their existing sponsorship remains labeled and visible. Test each affected service/query.
- Archived IDs must not appear as choices for a new sponsorship or accept edits/uploads through ordinary case flows. Test the new-sponsorship selector and form actions.

---

### Task 1: Add database archive state and role-checked operations

**Files:**
- Create: `supabase/migrations/018_recoverable_case_archive.sql`
- Create: `supabase/migrations/019_archive_related_write_guards.sql`
- Create: `supabase/migrations/020_privileged_attachment_delete_finish.sql`
- Create: `supabase/tests/case_archive.test.sql`
- Modify: `docs/data-model.md`
- Modify: `docs/progress.md`

**Interfaces:**
- Produces: `public.archive_case_file(p_id uuid) returns void` and `public.restore_case_file(p_id uuid) returns void`, both authenticated-callable `SECURITY DEFINER` functions that require `current_staff_role() = 'general_manager'`.
- Produces: `families.archived_at timestamptz` and `families.archived_by uuid`, plus a private append-only archive audit table storing case ID/code, actor, action, and timestamp.

- [x] **Step 1: Write SQL tests** for general-manager archive/restore, manager and employee denial, retained member/file/history/sponsorship/payment rows, member demographic guards, sponsorship insert guards, pending attachment deletion, and invalid repeated transitions.
- [x] **Step 2: Run the SQL test** against the current local database and confirm it fails because the archive columns/functions are missing.
- [x] **Step 3: Add migration 018** with nullable archive fields, private audit table, row-locked role-checked archive/restore functions, execute grants for authenticated only, and revokes on direct archive-column writes.
- [x] **Step 4: Run the SQL test** and confirm allowed actions succeed, denied actions fail with `42501`, and linked data remains intact. A follow-up migration also serializes related child writes and blocks person edits and new sponsorships after archival.
- [x] **Step 5: Update `docs/data-model.md`** to describe the archive state, role checks, audit, and preservation behavior.

### Task 2: Exclude archived records from day-to-day data

**Files:**
- Modify: `src/services/cases.ts`
- Modify: `src/services/cases.test.ts`
- Modify: `src/features/home/HomePage.tsx` and `src/features/home/HomePage.test.tsx` only if query behavior needs explicit handling
- Modify: `functions/api/assistant` SQL definition in the migration
- Modify: `src/services/donations.ts` and `src/features/donations/DonationListPage.tsx`
- Modify: relevant donations tests
- Modify: `supabase/tests/case_archive.test.sql`

**Interfaces:**
- Produces: `listCaseFiles()`, counts, detail lookup, age-member lookup, and ID-expiry lookup return active case files only.
- Produces: `listCaseFilesByIds(ids: string[]): Promise<CaseFileSummary[]>` for resolving existing sponsorship links, including the `archived_at` marker.
- Consumes: migration 018 archive columns and archive functions.

- [x] **Step 1: Add failing service tests** for active-only lists/counts/details/age/expiry and for resolving archived case IDs referenced by sponsorships.
- [x] **Step 2: Run the focused tests** and confirm they fail because archived fields are not requested or filtered.
- [x] **Step 3: Filter active case operations** in `src/services/cases.ts`; ensure ID reminders, member counts, case details, and new sponsorship choices do not include archived cases.
- [x] **Step 4: Preserve sponsorship display** by resolving only already-linked case IDs separately; mark archived case sponsorships clearly without offering them as new choices.
- [x] **Step 5: Exclude archived cases from assistant retrieval** in migration 018 and add a SQL assertion that an archived record is never returned.
- [x] **Step 6: Run focused tests** for case services, home summaries, donation sponsorship display, and SQL retrieval.

### Task 3: Add archive and restore controls

**Files:**
- Modify: `src/app/Router.tsx` and `src/app/Router.test.tsx`
- Modify: `src/features/cases/CaseListPage.tsx` and `src/features/cases/CaseListPage.test.tsx`
- Modify: `src/features/cases/CaseDetailsPage.tsx` and `src/features/cases/CaseDetailsPage.test.tsx`
- Create: `src/features/cases/ArchivedCasesPage.tsx`
- Create: `src/features/cases/ArchivedCasesPage.test.tsx`
- Modify: `src/shared/app.css`
- Create: `tests/e2e/case-archive.spec.ts`

**Interfaces:**
- Consumes: `archiveCaseFile(id: string): Promise<void>` and `restoreCaseFile(id: string): Promise<void>` service operations using the database RPCs.
- Produces: a `canArchive` prop for case list/details, true only for a `general_manager`; `/cases/archive` is guarded by the same role.

- [x] **Step 1: Add failing tests** for a general-manager-only archive action, clear confirmation containing the case code and restore warning, successful removal from the active list, and restore from `/cases/archive`.
- [x] **Step 2: Run focused tests** and confirm these controls/routes do not exist yet.
- [x] **Step 3: Add archive service functions** that call the two role-checked RPCs and return actionable errors.
- [x] **Step 4: Add archive confirmation** to case details and a link to the archive list for general managers; do not show the action to managers or employees.
- [x] **Step 5: Add `/cases/archive`** with archived code/name/date, a restore action, and loading/error/empty states; prevent access for non-general-managers in `Router`.
- [x] **Step 6: Add Playwright coverage** that archives a case with related records, verifies it leaves the active list, restores it, and verifies the sponsorship and payment record remain.
- [x] **Step 7: Run** `npm test -- --run`, `npm run build`, focused SQL tests, and case/donation Playwright flows at desktop and mobile widths. (The focused archive E2E covers desktop and mobile; the full existing SQL suite also ran but is blocked by leftover synthetic rows in the local DB.)
- [x] **Step 8: Record migration and verification status** in `docs/progress.md`; do not apply migration 018 to hosted Supabase unless separately requested.
