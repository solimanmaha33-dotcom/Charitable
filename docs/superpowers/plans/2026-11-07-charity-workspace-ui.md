# Charity Workspace UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the charity system's daily-use interface without changing its underlying data or permissions.

**Architecture:** Keep existing React Router pages and service APIs. Establish a reusable RTL application shell and visual primitives, then improve the home, family directory/file, case directory, and login screens using existing data and permission props.

**Tech Stack:** React 19, TypeScript, Vite, React Router, CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-07-charity-workspace-ui-design.md`

## Global Constraints

- All user-facing text must remain in clear Egyptian Arabic.
- Preserve Supabase schema, service behavior, authentication, and role permissions.
- Do not add fabricated records, metrics, timestamps, or activity.
- Keep controls keyboard accessible and responsive in RTL layouts.

## Review Focus

- Staff without write permission must not see add/edit actions.
- Arabic name/code/phone search must match normalized input.
- Empty, loading, failed, and no-search-match states must be distinct and understandable.
- Family files with no phone, members, or cases must still render cleanly.
- Narrow viewports must keep primary actions reachable and avoid page-wide overflow.

---

### Task 1: Shared application shell and design system

**Files:**
- Modify: `src/shared/AppShell.tsx`
- Modify: `src/shared/app.css`
- Test: `src/shared/AppShell.test.tsx`

**Interfaces:** Keep `AppShell({ children })`; preserve the existing navigation destinations except remove the sign-in route from the main navigation.

- [x] Update shell test to assert the RTL workspace, primary navigation, and absence of sign-in as a nav item.
- [x] Build reusable CSS tokens and shell layout matching the chosen forest-green, white, pale-neutral visual direction.
- [x] Implement clear header, sidebar navigation, responsive navigation, main content width, shared page headings/actions, table, form, status, and empty-state styles.
- [x] Run `npm test -- src/shared/AppShell.test.tsx` and `npm run build`.

### Task 2: Useful, permission-aware home screen

**Files:**
- Modify: `src/app/Router.tsx`
- Create: `src/features/home/HomePage.tsx`
- Test: `src/features/home/HomePage.test.tsx`

**Interfaces:** `HomePage({ staff })` consumes the current `StaffProfile`, and links only to actions/pages allowed by its permissions.

- [x] Test visible actions for write/read-only staff and absence of fabricated summaries.
- [x] Replace the generic home placeholder with welcome text and direct links for families, cases, donations, and assistant according to permissions.
- [x] Run `npm test -- src/features/home/HomePage.test.tsx src/features/auth/Router.test.tsx`.

### Task 3: Family directory and family file

**Files:**
- Modify: `src/features/families/FamilyListPage.tsx`
- Modify: `src/features/families/FamilyForm.tsx`
- Test: `src/features/families/FamilyListPage.test.tsx`

**Interfaces:** Keep `FamilyListPage({ canWrite })`, `FamilyDetailsPage({ canWrite })`, and existing service function signatures.

- [x] Test search by normalized Arabic name/code/phone and category filter; test that read-only staff sees no creation/edit control.
- [x] Load families, case categories, and family-member names to provide truthful family search and current category filtering.
- [x] Render an RTL directory table with helpful search, filters, row links, and explicit loading/error/empty/no-match states.
- [x] Reorganize family details into a clear header, member section, and linked-cases section while preserving add/edit behavior.
- [x] Run `npm test -- src/features/families/FamilyListPage.test.tsx src/features/auth/Router.test.tsx`.

### Task 4: Case directory and form clarity

**Files:**
- Modify: `src/features/cases/CaseDetailsPage.tsx`
- Modify: `src/features/cases/CaseForm.tsx`
- Test: `src/features/cases/CaseDetailsPage.test.tsx`
- Test: `src/features/cases/CaseForm.test.tsx`

**Interfaces:** Keep existing component props and case/file service functions.

- [x] Test the directory's empty/no-match messaging and permissions for create/edit/upload actions.
- [x] Replace the case directory's raw link list with a readable searchable table and category labels.
- [x] Group case fields and attachments into clear sections; preserve file upload, preview, OCR suggestions, and save behavior.
- [x] Run `npm test -- src/features/cases/CaseDetailsPage.test.tsx src/features/cases/CaseForm.test.tsx`.

### Task 5: Login and final visual verification

**Files:**
- Modify: `src/features/auth/LoginPage.tsx`
- Modify: `src/shared/app.css`
- Modify: `docs/progress.md`

- [x] Add focused login layout and clear field/error/pending states consistent with the shared design.
- [x] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [x] Verify desktop and mobile screenshots in Chromium and refine visible mismatches against both generated concepts.
- [x] Record completed UI changes and verification in `docs/progress.md`.
