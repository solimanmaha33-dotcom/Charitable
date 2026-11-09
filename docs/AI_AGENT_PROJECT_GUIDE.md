# Maram El Kheir Charity System — Project Guide for AI Agents

This document is the practical map of the application as implemented in this repository. Read it before changing code. The live product is an Arabic, right-to-left case and charity-work management system for **جمعية مرام الخير**. The interface uses simple Egyptian Arabic; code, database identifiers, and this guide use technical English where that is clearer.

## 1. Purpose and operating model

The system gives 3–5 charity workers a shared online workspace to manage beneficiary households, their needs, supporting documents, donations, sponsorship installments, staff access, and an AI helper. A household is represented by one **case file**. The old database table is still named `families`; do not infer from that name that the UI should have a separate Families section.

Every case file has a stable database-generated code such as `F-0001`. The record stores optional father data, required mother name for a new file, optional guardian/contact data, household details, case categories, members, notes, attachments, and sponsorship links. A case may have multiple compatible categories, but exactly one of «هجر», «أرملة», and «مطلقة» may be selected. Names or phone numbers that look duplicated are retained as separate files for human review; do not merge records automatically.

The system is not a public self-signup service. Staff accounts are created by an authorized manager. Private beneficiary data must only be accessed under the current staff member's authenticated Supabase session and permissions. Use synthetic data for development and preview checks.

## 2. Main pages and routes

`src/app/Router.tsx` defines the routes. `src/shared/AppShell.tsx` provides the shared header, association branding, light/dark mode, navigation, staff identity, and sign-out control. The UI is Arabic/RTL and responsive.

| Route | What it does | Access |
| --- | --- | --- |
| `/login` | Sign in using employee code and password. | Public entry; data requires a valid staff account. |
| `/` | Dashboard: case/donation counts, ID-expiry reminders, age reminders, and shortcuts. | Signed-in staff; case reminders require case-read permission. |
| `/cases` | Search and filter case files; shows case, child, and orphan counts; starts a new case. | `casesRead`; creating/editing also needs `casesWrite`. |
| `/cases/new` | One combined intake flow for a new case file, household categories, parents/contact, household data, and initial members. | `casesWrite`. |
| `/cases/:id` | View, edit, print, manage members and private attachments for one case. | `casesRead`; edits and uploads need `casesWrite`. |
| `/cases/archive` | Review and restore archived files. Archiving/restoring is reversible and preserves related records. | General manager only. |
| `/families` and `/families/:id` | Compatibility redirects to the unified cases area. | Same access as cases. |
| `/donations` | Donors, cash/in-kind donations, sponsorships and monthly installments. | `donationsRead`; writes require `donationsWrite` and case-read access for linked sponsorships. |
| `/assistant` | Ask questions about permitted case/donation records and view source links. | `assistantUse`; each data source is separately checked against its read permission. |
| `/staff` | Create staff accounts, change employee permissions, or deactivate employees. | Managers and general managers; only general managers can deactivate staff. |

Unknown routes show a not-found message. UI route checks improve navigation but are not the security boundary; Pages Functions and PostgreSQL RLS must enforce access too.

## 3. Case files and people

### Case file fields and workflow

- The intake form does not ask for a household name. The father name is optional; the mother name is required for a newly created case.
- Other fields include address, monthly income in EGP, branch/area, household health note, case status, status reason, notes, three contact numbers, parent national IDs, parent health/employment information, guardian/contact name and relationship, ID expiry, and categories.
- At least one contact number is required. Mobile 1 and mobile 2 accept 11 digits; home phone accepts 10. National IDs accept exactly 14 digits. Monthly income is a non-negative number.
- Case statuses are «نشط», «موقوف», «تحت المراجعة», and «مرفوض». A reason is required for hold/rejection. New/legacy files default to review status as defined by the database migration.
- Branches begin with «القاهرة - المرج» and «الفيوم - جبل النجار». Managers can add or remove branch names through the branch management control. Existing files keep their stored branch text if a branch is removed.
- Case categories currently offered are «هجر», «أرملة», «مطلقة», «عجز أو مرض», «يتيم الأب», «كبار السن (٦٠ سنة فأكثر)», «أسرة مسجون», and «أخرى». «يتيم الأم» is retired from new entry; legacy rows are preserved. Only one of «هجر», «أرملة», «مطلقة» can be attached to a file. «أخرى» can be combined with other compatible categories.
- If category is «أرملة», «هجر», or «مطلقة», guardian fields are hidden in the form. Hiding them must not silently delete already saved database values.
- The print view is generated by `CasePrintDocument.tsx`; it displays association branding/logo, file and household information, categories, contacts, people, attachments, and an association stamp area. Browser printing can save as PDF.
- Archive is a separate lifecycle flag, not a case status. It is recoverable. The general manager can restore it. Do not implement a hard-delete path for case files or attachments.

### Family members and calculations

- Each member has a name, relationship, optional gender, birth date, health status/details, employment status and occupation. Parent data can also hold health and employment fields.
- Age is calculated from date of birth and the current Cairo date; do not persist a manually maintained age.
- Per-person health choices are «عجز / إعاقة», «مرض», and «حالة مستقرة». Selecting disability or illness requires descriptive details. This applies individually to each parent and each member.
- Employment choices are «يعمل», «لا يعمل», «طفل», and «طفلة». Selecting «يعمل» reveals the occupation field.
- Case directory search includes case code, parents, guardian/contact, phones, address, branch, and member names. Filters can be combined: category, file status, orphans, under 18, under 21, and age 60+.
- The directory totals all non-archived case files, children under 18, and orphaned children under 18. Orphan totals mean under-18 people in a «يتيم الأب» file. Each person is counted once in those totals even if linked to more than one file.
- The dashboard's ID-expiry panel shows expired IDs and IDs expiring within 30 days. Its age panel warns for girls approaching age 21 and boys approaching age 18 within 30 days. These reminders need an entered ID expiry date, or both birth date and gender, respectively. They are on-screen reminders, not external notifications.

## 4. Documents, OCR, and identity-card scanning

- Case files support private PNG, JPEG, WebP and PDF attachments. The upload limit is 20 MB and PDFs are limited to 20 pages. Files are stored in the private Supabase Storage bucket `case-files`; metadata lives in `case_attachments` and points to a case file.
- Upload and deletion go through Cloudflare Pages Functions (`functions/api/case-files/`). The server validates the real file signature/type/size/page count and verifies the staff session and case-write permission. Never make the bucket public to solve an access problem.
- The case details UI previews images and PDFs, lets staff download them, and manages file removal with a database/storage completion flow. Archived cases cannot be modified.
- Arabic OCR runs locally in the employee's browser using PDF.js and Tesseract Arabic data shipped with the app. Text PDFs are extracted directly; scanned or mixed image/text PDFs are rendered and OCR'd. Staff review and correct extracted text before copying it or explicitly saving it for assistant search. OCR content is not automatically saved into a case.
- The national-ID scanner parses a 14-digit ID and an explicitly labeled expiry date from reviewed text/image content. Individual ID scanning can suggest birth date and gender from the ID; the individual national ID itself is not retained. A scan is only a suggestion and requires staff confirmation. If recognition fails, staff enter values manually.
- Only explicitly saved attachment text is available to the assistant. Raw files are not sent to Workers AI by the assistant route.

## 5. Donations and sponsorships

- Donation kinds are cash and in-kind. Supported named donation types include cash, food, clothing, medicine, zakat, sadaqa, zakat al-fitr, Ramadan food bags, Eid clothing, sacrificial meat, blankets, school supplies, and treatment support. `src/features/donations/donationTypes.ts` is the UI label list; the database also validates supported values.
- A donor can have a name and phone. A donation can have a donor, type, kind, amount or quantity/unit, description and received date.
- Sponsorship links a donor to a case file and stores monthly amount, start/end date. Monthly payment rows store installment month, due date, amount due, received date and amount received.
- `generate_sponsorship_installments` creates the scheduled installment rows through the current month. Unpaid installments become late the calendar day after the due date. Payment receiving is compare-and-set: a previously received installment cannot silently be overwritten; the UI must reload and display the recorded receipt.
- Ending a sponsorship sets its end date. Sponsorships and payments are not deleted when a case is archived; archived case links cannot receive new sponsorship writes.

## 6. Staff accounts, roles, and permissions

Roles are `employee`, `manager`, and `general_manager`.

- Manager and general manager have application feature access. A manager can create employee accounts and edit permissions, but cannot create another manager or general manager and cannot deactivate staff.
- General manager can create all three roles, edit permissions, deactivate staff, and archive/restore case files.
- Employee permissions are `casesRead`, `casesWrite`, `donationsRead`, `donationsWrite`, and `assistantUse`. Write permission implies the matching read permission. Sponsorship reads/writes also require case-read permission because rows point to case files.
- Inactive employees are denied access. Deactivation preserves the account and audit history rather than deleting it.
- Staff sign in using employee code and password. The code maps server-side to a random internal Supabase Auth email; no email is shown to the employee. There is no public registration or self-service password reset.
- A staff session has a hard 30-day age limit. Manual sign-out records the session as revoked before invalidating its refresh token; further data calls with the previous session are denied.
- `/api/staff` is the authenticated staff management endpoint. Permission edits use expected-old permissions to detect stale edits and can return HTTP 409.

## 7. AI assistant

- `/api/assistant` calls Cloudflare Workers AI through the server binding named `AI` and currently selects the model in `functions/api/aiProvider.ts`. It needs no third-party API key in the browser. OpenAI, Gemini, OpenRouter and Kilo Code provider APIs are not implemented just because a key exists in Cloudflare settings.
- A staff member must have `assistantUse`. The server separately checks `casesRead` and `donationsRead`, then queries only those permitted sources using the staff's Supabase session and RLS-aware search functions. A staff member with assistant permission alone receives no records.
- The assistant can answer informational questions from a bounded set of matching case records, explicitly saved attachment text, and/or donations. It labels results partial; it is not a complete report or an authoritative count. It cannot select/rank aid recipients, decide eligibility, or claim it changed data. Staff must review its answer.
- `/api/extract-fields` is a separate assisted form-fill feature. It receives text that staff already reviewed and only suggests `notes` or valid `case_categories`, quoting source evidence. Staff must choose whether to apply a suggestion, then save the case normally.
- `/api/case-files/ocr-text` saves reviewed extracted text for search, and requires case-write permission.
- Model input is untrusted data. Do not weaken source-permission checks, pass secrets to the model, log full case records, or describe a partial search as comprehensive.

## 8. Application services and key functions

Frontend data access is grouped in `src/services/`; avoid putting Supabase queries directly into page components when a service exists.

### `src/services/supabase.ts`

- `getSupabase()` returns the configured browser client, or `null` when public Vite configuration is unavailable.
- `currentStaff()` loads the signed-in staff profile using the database `staff_profile()` function.
- `signIn(employeeCode, password)` calls the login Function and installs the returned session.
- `signOut()` calls the server revocation Function and clears the local session only when logout succeeds.

### `src/services/cases.ts`

- Read: `listCaseFiles`, `getCaseFile`, `listCaseFilesByIds`, `countCaseFiles`, `listMembers`, `listAllMembers`, `listAgeThresholdMembers`, `listCaseFileHistory`, `listCaseFileIdExpirationsBy`, `listArchivedCaseFiles`, `listCaseAttachments`.
- Write: `saveCaseFile`, `updateCaseFileIdentity`, `addMember`, `updateMemberDemographics`, `uploadCaseAttachment`, `removeCaseAttachment`, `archiveCaseFile`, `restoreCaseFile`.
- Compatibility/search: `findCaseFileForLegacyId`, `downloadCaseAttachment` (`downloadCaseFile` is an alias).
- Validation for contact numbers, national IDs, health/employment choices and mutually exclusive categories runs in the service and again in PostgreSQL. PostgreSQL is the ultimate integrity boundary.

### Other services

- `src/services/donations.ts`: `listDonors`, `listDonations`, `countDonations`, `listSponsorships`, `listPayments`, `saveDonor`, `saveDonation`, `saveSponsorship`, `generateInstallments`, `receivePayment`, `endSponsorship`, and `utcToday`.
- `src/services/staff.ts`: `listStaff`, `createStaff`, `updateStaffPermissions`, `deactivateStaff`; `StaffPermissionsConflict` signals stale permission state.
- `src/services/branches.ts`: `listBranches`, `addBranch`, `removeBranch`.

### Core helpers

- `src/features/cases/categories.ts`: current and stored case-category types, allowed-category check, conflict detection, and category selection behavior. Update UI/service/SQL tests whenever category rules change.
- `src/features/cases/healthStatus.ts`: canonical per-person health status values.
- `src/features/cases/memberAge.ts`: `ageOn` computes age and `findMemberAgeAlerts` returns gender-specific age-threshold reminders (default 30-day window).
- `src/features/cases/idExpiry.ts`: Cairo date, date-only arithmetic, and grouping expired / next-30-day ID reminders.
- `src/features/cases/caseMetrics.ts`: case/member counts and age/orphan directory filtering.
- `src/features/cases/arabicSearch.ts`: normalizes Arabic text for search only; stored names are not rewritten.
- `src/features/cases/nationalIdScan.ts`: parses ID digits and a labeled expiry date from text.
- `src/features/files/documentText.ts` and `ocr.ts`: validates documents and extracts PDF/image Arabic text locally.
- `src/features/auth/permissions.ts`: frontend role/permission helpers; server/database checks remain required.
- `src/features/donations/sponsorshipStatus.ts`: calculates due/received/late using date-only comparisons.

## 9. Cloudflare Pages API endpoints

| Endpoint | Methods | Purpose and boundary |
| --- | --- | --- |
| `/api/auth/login` | POST | Validates employee code/password, enforces database login rate limits, signs into Auth and returns session plus staff profile. |
| `/api/auth/logout` | POST | Revokes the current staff session and invalidates its refresh token. |
| `/api/staff` | POST, PATCH | Creates accounts, compares/updates permissions, and deactivates staff with role checks. |
| `/api/assistant` | POST | Permission-filtered case/donation retrieval and Workers AI answer. |
| `/api/extract-fields` | POST | Produces reviewed-text field suggestions for permitted fields. |
| `/api/case-files/upload` | POST | Validates and stores an authorized case attachment. |
| `/api/case-files/delete` | POST | Starts/finishes the guarded private attachment deletion flow. |
| `/api/case-files/ocr-text` | POST | Saves staff-reviewed extracted text for a case attachment. |
| `/api/family-files/upload`, `/api/family-files/delete` | POST | Compatibility aliases to the case-file upload/delete handlers. |

`functions/_shared/supabase.ts` contains request parsing, bearer token handling, Supabase clients, and staff context verification. Never trust a client-supplied employee ID or permission flag without rechecking it against the authenticated session.

## 10. Database and security model

- Supabase PostgreSQL holds Auth-linked staff, permissions, families/case files, parents, people, categories, case history, donations, sponsorships, attachment metadata, and audit data. The legacy table name `families` is the canonical case-file row.
- Supabase Storage bucket `case-files` is private. Stored object bytes and `case_attachments` metadata both matter for backup/restore.
- RLS and database functions enforce staff session age, active status, revoked sessions, role checks, feature permissions, archived-file write guards, category conflicts, and field constraints. A hidden UI button is not authorization.
- `SUPABASE_SERVICE_ROLE_KEY` may be used only inside Cloudflare Pages Functions and must never be exposed as `VITE_*`, included in browser bundles, committed, or printed in logs.
- The custom Auth JWT hook is `public.staff_access_token_hook`. Hosted Auth options (public sign-up, redirect URLs, token/session settings) are configured in the Supabase Dashboard and are not applied by SQL migrations alone.
- Ordered migrations are in `supabase/migrations/`. Current newest migration in this change is 027 (category options, conflict protection, health-label migration); it also preserves employment fields in the case-save RPC. A hosted database may have earlier migrations pending; inspect its own migration list and dry-run before applying anything.
- SQL behavior tests are in `supabase/tests/`; Pages Function tests are beside endpoints; UI/service tests are beside source modules; browser tests live in `tests/e2e/`.

## 11. Source layout

```text
src/app/                 app bootstrap and routes
src/shared/              shared shell, theme, responsive and global styles
src/features/auth/       login, role and permission behavior
src/features/cases/      case intake/list/details/archive/print, members and scanners
src/features/donations/  donors, donations and sponsorship/installment UI
src/features/assistant/  assistant UI and reviewed field-suggestion UI
src/features/files/      previews, local OCR, PDF/image text and clipboard helpers
src/features/home/       dashboard and 30-day reminders
src/features/staff/      staff management
src/services/            browser Supabase data-access functions
functions/api/           Cloudflare Pages Function API
functions/_shared/       server authentication/Supabase helpers
supabase/migrations/     database schema, functions, policies and data transitions
supabase/tests/          PostgreSQL permission/business-rule tests
tests/e2e/               browser workflows
docs/                    operating notes, data model, release docs and this guide
```

## 12. Development, validation, and release rules

- Install with `npm ci`. The normal checks are `npm test`, `npm run test:worker`, `npm run test:db`, `npm run test:e2e`, `npm run typecheck`, `npm run build`, and `npm run build:functions` as applicable to the change.
- Build output is `dist`. Cloudflare Pages deploys the GitHub `preview` branch through its Git integration; the checked-in Wrangler config names the Pages project `charitable-preview` and binds Workers AI as `AI`.
- Before pushing a UI that depends on a migration, confirm the owner has applied all pending migrations to the intended Supabase test project and `npx supabase migration list --remote` shows them applied. Never reset a hosted project, never point at an unrelated local CLI project, and never execute a migration twice manually.
- For hosted migration rollout, use the safe PowerShell token procedure documented in the conversation / Supabase CLI docs; keep the access token only in the local process environment. Verify project reference and `db push --remote --dry-run` filenames before applying. Do not paste tokens or service-role/API keys into this Markdown file, source control, logs, or chat.
- “Push” can mean pushing the feature branch to GitHub; “deploy” means advancing the configured `preview` branch so Cloudflare builds it. Do not advance the deploy branch before database compatibility is verified. A successful static build alone does not verify Supabase, Auth, private files or AI runtime.
- Keep the preview restricted to synthetic records. See `docs/deployment.md` for Cloudflare/Supabase setup, smoke tests, secret handling, backups and recovery. See `docs/data-model.md` for detailed table/RLS rules.

## 13. Rules for future AI coding agents

1. Preserve Arabic labels and the right-to-left/mobile-first interface unless asked to change them.
2. Treat one household as one case file; do not recreate a separate Families section or ask for a family name.
3. Preserve existing case codes and historical data. Duplicate people/files require human review, never automatic merging.
4. For any business rule, update the form, service validation, database migration/constraint/RPC, and meaningful tests together.
5. Keep case and donation access scoped to the signed-in employee's permissions. The assistant must follow the same scope and must mark retrieval partial.
6. Keep attachments private and use authenticated Functions for upload/delete/OCR text saving.
7. Never use service-role credentials in frontend code. Never add secrets to this guide or other committed Markdown.
8. Update the relevant docs after implementation. Do not claim a hosted migration or deployment succeeded without its explicit verification output.

## 14. Main reference documents

- `docs/data-model.md`: detailed schema, permissions and account recovery.
- `docs/architecture.md`: assistant, OCR and retrieval design.
- `docs/deployment.md`: environment setup, migrations, smoke tests, backups and provider limitations.
- `docs/progress.md`: dated implementation history; historical notes may describe older behavior.
- `docs/superpowers/specs/`: approved designs; `docs/superpowers/plans/`: implementation checklists.
