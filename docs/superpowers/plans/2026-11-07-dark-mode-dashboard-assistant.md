# Dark Mode and Daily Workspace Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a saved dark theme, a permission-aware home summary, and clearer assistant guidance.

**Architecture:** Keep React/Vite, CSS variables, Supabase RLS, and the existing Cloudflare Workers AI binding. Add one browser-local theme preference, exact count queries through the authenticated Supabase client, and explanatory assistant UI.

**Tech Stack:** React 19, TypeScript, CSS, Supabase JS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-07-dark-mode-dashboard-assistant-design.md`

## Global Constraints

- All visible text remains in simple Egyptian Arabic.
- Do not change schema, staff permissions, or the active AI provider.
- Theme and counts must fail gracefully; no invented or unauthorized information.
- Secrets stay server-side and outside source control.

## Review Focus

- A saved theme survives remount and overrides the operating-system setting.
- An employee sees only exact totals for datasets readable under their permissions.
- A count-query failure does not hide the rest of the start page or imply a zero count.
- Dark mode covers tables, fields, file previews, warnings, and controls with readable contrast.
- Assistant helper text does not suggest that partial results are complete or that staff decisions can be automated.

---

### Task 1: Theme control and palette

**Files:**
- Modify: `src/shared/AppShell.tsx`
- Modify: `src/shared/AppShell.test.tsx`
- Modify: `src/shared/app.css`

**Interfaces:** A header button switches between `light` and `dark`; the selected value is stored as `maram-theme` in `localStorage`.

- [x] Test OS-derived first load, manual switch, and persistent saved choice.
- [x] Add the accessible header control and apply `data-theme` to the document root.
- [x] Define light and dark CSS tokens and replace hard-coded palette colors across forms, tables, file previews, and statuses.
- [x] Run the shell tests and verify contrast in Chromium at desktop and mobile widths.

### Task 2: Permission-aware home summary

**Files:**
- Modify: `src/services/cases.ts`
- Modify: `src/services/donations.ts`
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/features/home/HomePage.test.tsx`

**Interfaces:** Export exact count helpers for families, cases, and donations; each is queried only when `hasPermission` allows it.

- [x] Mock and test visible totals by role, zero-count semantics, and per-source errors.
- [x] Implement exact `head: true, count: 'exact'` queries through the current authenticated Supabase client.
- [x] Add a compact summary with loading, failure, and no-data states while retaining direct action links.
- [x] Run home/service tests.

### Task 3: Assistant guidance and provider setup explanation

**Files:**
- Modify: `src/features/assistant/AssistantPanel.tsx`
- Modify: `src/features/assistant/assistant.test.tsx`
- Modify: `docs/deployment.md`
- Modify: `docs/architecture.md`

**Interfaces:** Keep `POST /api/assistant` and current response shape; provide question examples in the front end without changing model behavior.

- [x] Test example-question selection, busy/error states, and displayed partial-results/review notice.
- [x] Add example prompts and plain Arabic privacy/quality guidance.
- [x] Document current Workers AI binding and where future server-side provider secrets belong.
- [x] Run focused assistant tests and the full test/typecheck/build suite; record gaps that need a schema or policy decision.
