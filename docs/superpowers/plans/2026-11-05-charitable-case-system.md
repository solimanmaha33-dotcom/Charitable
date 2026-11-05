# Charitable Case System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a simple Egyptian Arabic online system for staff to manage families, cases, donations, monthly sponsorships, files, and permission-aware assistance.

**Architecture:** A single React and TypeScript application runs on Cloudflare Pages. Supabase provides authentication, PostgreSQL data, and private file storage. Cloudflare Pages Functions protect staff administration and assistant requests. Arabic text is read in the browser with PDF.js and Tesseract.js; Cloudflare Workers AI first proposes field values from OCR text, with staff review before saving.

**Tech Stack:** React, TypeScript, Vite, Supabase Auth/PostgreSQL/Storage, Cloudflare Pages/Functions/Workers AI, PDF.js, Tesseract.js (Arabic language data), Vitest, React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-charitable-case-system-design.md`

## Global Constraints

- The interface is Egyptian Arabic and right-to-left, and must work on phones and computers.
- Support 3–5 staff; no public registration.
- Keep the login session for at most 30 days; manual logout ends it immediately.
- Each employee has a unique code and personal password. The code identifies the account and is not the password.
- The general manager can create staff accounts and remove their access while retaining historical activity records. A manager can create employee accounts but cannot remove access or grant manager roles.
- Employee permissions include reading and writing cases, reading and writing donations, and using the assistant. A read-only permission cannot save changes.
- The assistant only receives records and files the current employee is allowed to read, and it cannot change records or decide who receives assistance.
- Give every family an easy-to-read, easy-to-enter, stable, unique code such as `F-0001`; never derive it from personal information, change it, or reuse it.
- Accept images and PDF files. Show a preview and keep each file linked to its case in private storage.
- Read printed Arabic in images, text PDFs, and scanned PDFs. Show copyable extracted text and field suggestions; staff must review and confirm before saving. Do not promise reliable handwriting recognition.
- Extract only fields present in the case form. Keep the initial file limit configurable at 20 MiB per file and 20 pages per PDF.
- Track monthly sponsorship due and received amounts; an end date is optional. Expenses and full accounting are out of scope.
- Use synthetic data in tests and examples. Never write beneficiary information, passwords, API keys, or real session values into Markdown files.
- Keep integrations grouped under `src/services/`; group screens and logic by feature under `src/features/`.
- Update the relevant Markdown documentation after every task, including what changed, verification results, and the next step.
- Start with Cloudflare Workers AI for synthetic Arabic tests. Before any real data is used, verify current provider terms, retention rules, and usage limits; use Google Gemini only if Cloudflare fails the agreed quality or availability checks.
- Free service tiers are for the prototype; verify current capacity and backup options before production use.
- Use synthetic records and local test services only during this work. Do not connect a production Supabase project, use real beneficiary records, push changes, or publish/deploy the application.

## Stopping Criteria

This work is complete when Tasks 1–7 are implemented and reviewed, the full local test/typecheck/build commands in Task 7 pass, the core flows work locally with synthetic data, and setup/backup/recovery steps are documented. Task 7 prepares deployment files and instructions only. Stop before connecting external production services or publishing/deploying; that requires a separate user instruction. Any live AI-provider quality check remains pending until provider terms are reviewed and test credentials are deliberately supplied.

## Review Focus

- A duplicate family code or simultaneous family creation must never link records to the wrong family; test unique code generation under concurrent inserts.
- A staff member without read permission must not see case data through a page, direct API request, file link, or assistant response; test each access path.
- Arabic OCR errors or low confidence must remain suggestions and never silently save; test mixed Arabic/English scans and unreadable samples.
- Text PDFs and image-only PDFs must both produce copyable text; test both routes with synthetic documents.
- A sponsorship with no end date continues monthly, while a payment already recorded is never shown as late; test month boundaries and duplicate payments.

---

## File Structure

Create a small, feature-based layout:

```text
src/
  app/                 app entry and route shell
  features/
    auth/              login, staff accounts, permission checks
    families/          family search, family code, household members
    cases/             case forms, categories, case details
    files/             upload, preview, PDF reading, OCR
    donations/         donations and monthly sponsorships
    assistant/         chat and field suggestions
  services/            Supabase and Cloudflare clients
  shared/              reusable form, dialog, and feedback components
functions/api/         server-side staff and AI endpoints
supabase/migrations/   database schema and access policies
tests/                 end-to-end fixtures and helpers
docs/                  design, data model, evaluation, and progress notes
```

## Task 1: Create the Arabic Application Shell

**Files:**

- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/app/App.tsx`, `src/app/Router.tsx`, `src/shared/AppShell.tsx`, `src/shared/app.css`
- Test: `src/shared/AppShell.test.tsx`
- Update: `README.md`, `docs/progress.md`

**Interfaces:**

- `AppShell({ children }: { children: React.ReactNode })` provides the right-to-left page frame, navigation area, and responsive layout.
- `Router` exposes `/login` and authenticated application routes; protected routes show a sign-in prompt when no session exists.

- [x] **Step 1: Write the failing shell test**

Test that the rendered page has `lang="ar"`, `dir="rtl"`, the Arabic product name, and navigation that remains usable at a 360 px viewport.

- [x] **Step 2: Run the test and confirm it fails**

Run: `npm run test -- src/shared/AppShell.test.tsx`

Expected: FAIL because the application shell does not exist.

- [x] **Step 3: Build the smallest shell that passes**

Create the React and Vite entry points, Arabic RTL shell, and empty feature routes. Configure `test`, `test:worker`, `test:e2e`, `typecheck`, and `build` scripts; keep labels in simple Egyptian Arabic.

- [x] **Step 4: Verify the shell**

Run: `npm run test -- src/shared/AppShell.test.tsx && npm run typecheck && npm run build`

Expected: all commands exit successfully; the page remains readable at phone width.

- [x] **Step 5: Update docs and commit**

Record the shell, test result, and next task in `docs/progress.md`; add local run instructions to `README.md`.

## Task 2: Add Staff Login and Permission Checks

**Files:**

- Create: `supabase/migrations/001_staff_access.sql`, `functions/api/auth/login.ts`, `functions/api/staff/index.ts`, `src/features/auth/LoginPage.tsx`, `src/features/auth/permissions.ts`, `src/features/auth/permissions.test.ts`, `src/services/supabase.ts`
- Modify: `src/app/Router.tsx`
- Test: `supabase/tests/staff_access.test.sql`, `src/features/auth/permissions.test.ts`
- Update: `docs/data-model.md`, `docs/progress.md`

**Interfaces:**

- `EmployeePermission` is the set `{ casesRead, casesWrite, donationsRead, donationsWrite, assistantUse }`.
- `canReadCases(permission)` returns true when `casesRead` or `casesWrite` is enabled. `canWriteCases(permission)` returns true only when `casesWrite` is enabled. Donations use the equivalent rules.
- `functions/api/auth/login.ts` accepts `{ employeeCode, password }`, maps the code to a private Supabase Auth account, and returns the normal authenticated session. It uses a generic error for unknown codes and wrong passwords and never logs credentials.
- Staff creation is server-side. A manager can create employees with employee-level permissions; only the general manager can deactivate staff accounts. Deactivation preserves audit history.

- [ ] **Step 1: Write failing permission and database-policy tests**

Test all role grants, manager limits, unique employee codes, read-only denies, a deactivated user being unable to sign in, a session ending after 30 days, and manual logout revoking it immediately. Test that case and donation rows are denied through Supabase policies without their matching read permission.

- [ ] **Step 2: Run tests and confirm the intended failures**

Run: `npm run test -- src/features/auth/permissions.test.ts` and `supabase test db`

Expected: tests fail because the permission rules, tables, and policies do not exist.

- [ ] **Step 3: Add the staff tables and policies**

Create `employees` with `auth_user_id`, unique `employee_code`, `display_name`, `role`, and `active`; create `employee_permissions` with the five flags above. Add row-level policies that derive the current employee from the Supabase session. Do not let managers assign manager roles or deactivate accounts.

- [ ] **Step 4: Add code-based login and session behavior**

Add the login-code lookup in a Cloudflare Function; store the internal Auth mapping outside employee-readable tables. Configure the session limit to 30 days, preserve the session across reloads, and revoke it on manual logout. Add generic errors and a rate limit for failed logins.

- [ ] **Step 5: Verify staff access**

Run: `npm run test -- src/features/auth/permissions.test.ts && supabase test db && npm run typecheck`

Expected: permission and RLS tests pass; manager cannot deactivate users; general manager can; read-only requests cannot write.

- [ ] **Step 6: Update docs and commit**

Document role rules and login recovery in `docs/data-model.md` and `docs/progress.md`. Never record the generated internal Auth mapping or passwords.

## Task 3: Add Families, Family Codes, and Cases

**Files:**

- Create: `supabase/migrations/002_families_cases.sql`, `src/features/families/FamilyListPage.tsx`, `src/features/families/FamilyForm.tsx`, `src/features/families/familyCode.ts`, `src/features/cases/CaseForm.tsx`, `src/features/cases/CaseDetailsPage.tsx`, `src/features/cases/categories.ts`, `src/features/cases/arabicSearch.ts`
- Test: `src/features/families/familyCode.test.ts`, `src/features/cases/arabicSearch.test.ts`, `supabase/tests/families_cases.test.sql`
- Update: `docs/data-model.md`, `docs/progress.md`

**Interfaces:**

- `createFamilyCode(sequence: number): string` returns an easy-to-read and easy-to-enter stable display code such as `F-0001`; the database sequence and unique constraint are the source of truth.
- `normalizeArabicSearch(value: string): string` normalizes Arabic letter variants and diacritics for matching only; it does not change saved names.
- Case categories are `هجر`, `وفاة`, `أرملة`, `مطلقة`, `عجز أو مرض`, and `أيتام`; one family may have multiple category records.

- [ ] **Step 1: Write failing model and search tests**

Test family code formatting, database uniqueness when two inserts happen together, case categories, family-member links, and Arabic matching across common alef forms and diacritics.

- [ ] **Step 2: Run tests and confirm failures**

Run: `npm run test -- src/features/families/familyCode.test.ts src/features/cases/arabicSearch.test.ts` and `supabase test db`

Expected: FAIL because the functions, tables, and constraints are not implemented.

- [ ] **Step 3: Add the family and case schema**

Create `families`, `people`, `family_members`, `cases`, and `case_categories`. Generate family codes from a database sequence, enforce uniqueness, and keep all relationships by IDs. Add permission-aware read/write policies.

- [ ] **Step 4: Add the family and case screens**

Create, search, and edit family records and cases. Show the family code on list and detail views. Use the categories above and show related household members on the family page.

- [ ] **Step 5: Verify case workflows**

Run: `npm run test -- src/features/families src/features/cases && supabase test db && npm run typecheck`

Expected: code uniqueness, Arabic search, category assignment, and read/write access tests pass.

- [ ] **Step 6: Update docs and commit**

Record the final field names and category behavior in `docs/data-model.md`, then update `docs/progress.md`.

## Task 4: Add Private File Upload, Preview, and Arabic OCR

**Files:**

- Create: `supabase/migrations/003_case_files.sql`, `src/features/files/FilePicker.tsx`, `src/features/files/FilePreview.tsx`, `src/features/files/documentText.ts`, `src/features/files/ocr.ts`, `src/features/files/ocr.test.ts`, `src/features/files/useClipboard.ts`
- Modify: `src/features/cases/CaseForm.tsx`, `src/features/cases/CaseDetailsPage.tsx`
- Test: `src/features/files/ocr.test.ts`, `supabase/tests/case_files.test.sql`, `tests/fixtures/arabic-sample.pdf`, `tests/fixtures/arabic-scan.pdf`, `tests/fixtures/arabic-sample.png`
- Update: `docs/data-model.md`, `docs/progress.md`

**Interfaces:**

- `extractDocumentText(file: File): Promise<{ pages: Array<{ page: number; text: string; confidence: number }>; source: 'pdf-text' | 'ocr' }>` uses PDF.js for selectable PDF text and Tesseract.js with `ara` for images or scanned PDF pages.
- `copyExtractedText(text: string): Promise<void>` copies the reviewed OCR text to the clipboard.
- `uploadCaseFile(caseId: string, file: File): Promise<CaseFile>` writes the file to a private Supabase Storage bucket and creates metadata linked to that case.

- [ ] **Step 1: Write failing upload and OCR tests**

Test preview for images/PDFs, Arabic extraction from a text PDF and an image-only PDF, copy-to-clipboard, unsupported files, and the 20 MiB/20-page limits. Test that no extracted text or suggested field is saved automatically.

- [ ] **Step 2: Run tests and confirm failures**

Run: `npm run test -- src/features/files/ocr.test.ts`

Expected: FAIL because upload and extraction helpers do not exist.

- [ ] **Step 3: Add private attachment storage**

Create `case_files` metadata with case ID, storage path, file name, MIME type, size, uploader, and timestamp. Use a private bucket and policies that require case read permission. Keep previews and download links protected.

- [ ] **Step 4: Add preview, text extraction, and copy**

Use PDF.js to read text PDFs and render scanned pages. Use Tesseract.js Arabic data for images and rendered pages. Show extracted text with a copy button. Display recognition as a draft for review; never write recognized values directly to the case.

- [ ] **Step 5: Verify real file paths**

Run: `npm run test -- src/features/files/ocr.test.ts && supabase test db && npm run test:e2e -- --grep "case attachment"`

Expected: both PDF types and image OCR work on synthetic fixtures; staff without case read permission cannot preview or download files.

- [ ] **Step 6: Update docs and commit**

Record supported file types, limits, and OCR limitations in `docs/data-model.md` and `docs/progress.md`.

## Task 5: Add Donations and Monthly Sponsorship Tracking

**Files:**

- Create: `supabase/migrations/004_donations_sponsorships.sql`, `src/features/donations/DonationForm.tsx`, `src/features/donations/DonationListPage.tsx`, `src/features/donations/SponsorshipForm.tsx`, `src/features/donations/sponsorshipStatus.ts`, `src/features/donations/sponsorshipStatus.test.ts`
- Test: `supabase/tests/donations_sponsorships.test.sql`, `src/features/donations/sponsorshipStatus.test.ts`
- Update: `docs/data-model.md`, `docs/progress.md`

**Interfaces:**

- Donation types include cash, in-kind food, clothing, medicine, zakat, sadaqa, zakat al-fitr, Ramadan food bags, Eid clothing, sacrificial meat, blankets, school supplies, and treatment support; sponsorship is linked to a donor and family.
- `getSponsorshipStatus(dueDate: string, receivedAt: string | null, today: string): 'due' | 'received' | 'late'` reports a monthly installment status. An optional end date stops future installments.

- [ ] **Step 1: Write failing donation and payment tests**

Test each donation type, monthly due dates, received and late payments, optional sponsorship end dates, duplicate installment prevention, and permission-denied writes.

- [ ] **Step 2: Run tests and confirm failures**

Run: `npm run test -- src/features/donations/sponsorshipStatus.test.ts`

Expected: FAIL because the donation model and status helper do not exist.

- [ ] **Step 3: Add donation and sponsorship tables**

Create `donors`, `donations`, `sponsorships`, and `sponsorship_payments`. Store each monthly installment separately, unique by sponsorship and month. Add read/write policies for donation permissions.

- [ ] **Step 4: Add donation and sponsorship screens**

Allow permitted staff to record cash/in-kind donations, associate sponsorships to a donor and family, and mark a monthly installment received with date and amount.

- [ ] **Step 5: Verify payment tracking**

Run: `npm run test -- src/features/donations && supabase test db && npm run test:e2e -- --grep "sponsorship"`

Expected: monthly amounts and statuses appear correctly; ending a sponsorship prevents future due installments; unauthorized staff cannot add or change donations.

- [ ] **Step 6: Update docs and commit**

Document the donation types and monthly payment fields in `docs/data-model.md` and `docs/progress.md`.

## Task 6: Add Permission-Aware Assistant and Field Suggestions

**Files:**

- Create: `functions/api/assistant.ts`, `functions/api/extract-fields.ts`, `functions/api/aiProvider.ts`, `src/features/assistant/AssistantPanel.tsx`, `src/features/assistant/FieldSuggestions.tsx`, `src/features/assistant/assistant.test.ts`, `src/features/assistant/extractFields.test.ts`
- Modify: `src/features/cases/CaseForm.tsx`, `src/features/files/documentText.ts`
- Test: `functions/api/assistant.test.ts`, `functions/api/extract-fields.test.ts`
- Update: `docs/architecture.md`, `docs/progress.md`

**Interfaces:**

- `POST /api/assistant` accepts `{ question: string }` and returns `{ answer: string; sources: Array<{ familyCode: string; caseId: string; fileName?: string }> }`.
- `POST /api/extract-fields` accepts `{ text: string; targetFields: string[] }` and returns `{ suggestions: Array<{ field: string; value: string; evidence: string }> }`.
- Both endpoints verify the employee session and `assistantUse`; retrieval is further filtered by the employee's case/donation read permissions before any content reaches the model.
- Cloudflare Workers AI is the first provider. Provider secrets stay server-side. The browser receives only the answer or suggestions, never provider credentials.

- [ ] **Step 1: Write failing authorization and extraction tests**

Test allowed and denied assistant use, case/donation read scopes, file access, structured extraction for synthetic Arabic text, unsupported fields, model errors, and that the assistant endpoint cannot write to the database.

- [ ] **Step 2: Run tests and confirm failures**

Run: `npm run test -- src/features/assistant && npm run test:worker -- functions/api`

Expected: FAIL because the permissioned endpoints and provider wrapper do not exist.

- [ ] **Step 3: Add provider wrapper and permission-scoped retrieval**

Implement `aiProvider.complete()` for Cloudflare Workers AI. Verify the session, assistant permission, and relevant read permissions before retrieving data. Send only records and OCR text that the current employee can read. Treat file text as untrusted input and ignore instructions found inside documents.

- [ ] **Step 4: Add assistant answers and case-field suggestions**

Render answers with links to the source family/case/file. Show extracted field values beside the OCR source text and let the employee edit or discard each suggestion before saving the case.

- [ ] **Step 5: Verify no permission bypass or automatic edits**

Run: `npm run test -- src/features/assistant && npm run test:worker -- functions/api && npm run test:e2e -- --grep "assistant permissions|field suggestions"`

Expected: a restricted employee cannot get or infer data outside their read permissions; malformed model results are rejected; suggested values remain unsaved until employee confirmation.

- [ ] **Step 6: Update docs and commit**

Document the selected provider, data flow, and permission behavior in `docs/architecture.md` and `docs/progress.md`. Do not put API keys or private case data in docs.

## Task 7: Prepare the Pilot and Finish Operator Documentation

**Files:**

- Create: `wrangler.toml`, `.env.example`, `docs/architecture.md`, `docs/data-model.md`, `docs/deployment.md`
- Modify: `README.md`, `docs/progress.md`
- Test: `tests/e2e/login-and-case-flow.spec.ts`, `tests/e2e/ocr-flow.spec.ts`, `tests/e2e/donations-flow.spec.ts`

- [ ] **Step 1: Write failing end-to-end smoke tests**

Test login, a manager-created employee, family code generation, case creation with file/OCR, monthly sponsorship entry, and a permission-limited assistant response using synthetic records.

- [ ] **Step 2: Run smoke tests and confirm failures**

Run: `npm run test:e2e`

Expected: FAIL because the integrated workflows and deployment configuration are not complete.

- [ ] **Step 3: Prepare Cloudflare and Supabase deployment files**

Create deployment configuration and a `.env.example` with variable names only. Keep service-role and AI credentials server-side. Do not connect a real Supabase project or run a deployment command.

- [ ] **Step 4: Document installation, startup, backups, and recovery**

Write repeatable setup steps, environment variable names without values, database migration instructions, file backup/restore steps, and free-tier limits in the documentation.

- [ ] **Step 5: Run complete verification**

Run: `npm run test && npm run test:worker && supabase test db && npm run test:e2e && npm run typecheck && npm run build`

Expected: all local tests and build pass using synthetic data and test bindings. Record current free-tier limits and a testable backup/restore procedure. The app is deployment-ready but remains unpublished.

- [ ] **Step 6: Update docs and commit**

Record local verification output, remaining limitations, deployment instructions, and the next step in `docs/progress.md`. Keep credentials out of all project files; do not claim the pilot is deployed.

## Self-review

- The plan covers the approved first release: staff login and permissions, family records and easy unique family codes, cases, private attachments and Arabic OCR, donations, monthly sponsorships, and a permission-limited assistant.
- Each feature includes focused tests, database access-policy checks where data is involved, and an end-to-end check for the main workflow. Family codes are generated from a database sequence with a uniqueness constraint so concurrent registrations cannot assign the same code.
- The code is intended to be easy for staff to read, enter, and search, such as `F-0001`; it does not expose family details. Final formatting can be checked with staff during the first screen review.
- OCR and AI quality, provider terms, free-tier capacity, and backup limits remain to be checked using synthetic data before a pilot uses real beneficiary information.
- No application code or service has been deployed yet; implementation should start only after the plan is reviewed and an execution approach is chosen.
