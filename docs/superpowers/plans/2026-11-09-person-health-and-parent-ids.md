# Person Health and Parent IDs Implementation Plan

> **For agentic workers:** Use test-driven development and execute each step inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture each parent's national ID and record a selectable health status and optional condition details for each parent and every additional family member.

**Architecture:** Add nullable fields to the family profile for father/mother identifiers and health status/details; add health status/details to `people`. Keep the legacy general household health note intact. Update the profile/member forms, case details, and print sheet; keep age derived from birth date.

**Tech Stack:** Supabase Postgres, TypeScript, React, Vitest, PgTAP.

**Spec:** `docs/superpowers/specs/2026-11-09-person-health-and-parent-ids.md`

## Global Constraints

- Existing case health and member demographic data remain intact.
- National IDs are optional; if present, they contain exactly 14 digits.
- Per-person health status is optional and one of «مستقرة»، «عجز أو إعاقة»، «مرض»; details are required for the latter two.
- Father name, ID, and health fields hide for widow cases without clearing saved values.
- Age is derived from date of birth and is not stored separately.
- Database changes are forward-only.

## Review Focus

- Widow selection hides all father fields while preserving values after toggling off.
- Arabic-Indic digits in parent national IDs normalize before persistence.
- Member health status and details round-trip through insert, edit, details, and print.
- Existing callers of the five-parameter member RPC keep working.
- Invalid IDs fail in the UI and are rejected by PostgreSQL checks.

---

### Task 1: Add database fields and compatibility-safe write functions

**Files:**
- Create: `supabase/migrations/021_individual_health_and_parent_ids.sql`
- Modify: `supabase/tests/family_member_demographics.test.sql`

- [x] Add failing SQL assertions for profile columns, member health insert/update, invalid parent IDs, and legacy RPC compatibility.
- [x] Run the focused SQL test and confirm failures.
- [x] Add nullable parent ID/health status/details columns, checks, grants, and the seven-parameter member RPC; update `save_case_file` to persist new fields.
- [x] Run focused SQL tests.

### Task 2: Update forms, service mapping, details, and print

**Files:**
- Modify: `src/services/cases.ts`, `src/services/cases.test.ts`
- Modify: `src/features/cases/CaseIntakeForm.tsx`, `src/features/cases/CaseIntakeForm.test.tsx`
- Modify: `src/features/cases/CaseMemberForm.tsx`, `src/features/cases/CaseMemberForm.test.tsx`
- Modify: `src/features/cases/CaseDetailsPage.tsx`, `src/features/cases/CaseDetailsPage.test.tsx`
- Modify: `src/features/cases/CasePrintDocument.tsx`, `src/features/cases/CasePrintDocument.test.tsx`

- [x] Add failing service/form/detail/print tests for per-person health, parent IDs, widow visibility, and date-derived age.
- [x] Run focused tests and confirm expected failures.
- [x] Implement the fields and show derived age from date of birth.
- [x] Run focused tests, all frontend tests, typecheck, and build.

### Task 3: Record status and migration guidance

- [x] Update `docs/data-model.md` and `docs/progress.md`.
- [x] Verify the migration against local Supabase; do not apply remotely or deploy unless requested.
