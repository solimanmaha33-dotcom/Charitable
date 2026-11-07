# Family Member Age Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record each member's gender and birth date, show age automatically, and alert staff before the age thresholds.

**Architecture:** Reuse local Arabic OCR for ID photos and PDFs. Derive date of birth and gender from a valid 14-digit Egyptian national ID in the browser, let staff review, and store only those derived profile fields. The dashboard filters family-member profiles to those reaching age 21 (female) or 18 (male) in the next 90 Cairo-calendar days.

**Tech Stack:** React, TypeScript, existing PDF.js/Tesseract OCR, Supabase Postgres, Vitest, pgTAP.

**Spec:** `docs/superpowers/specs/2026-11-07-member-age-alerts-design.md`

## Global Constraints

- OCR runs locally and requires staff review; never send identity data to AI.
- Store date of birth and gender only; do not store a member's extracted national ID number.
- Missing or invalid values do not produce alerts; there are no external notifications.
- Family reads/writes continue to require `casesRead`/`casesWrite`.
- Warning window: today through 90 days ahead, inclusive, in the Cairo calendar.

## Review Focus

- Invalid century, date, digit count, and Arabic-Indic digits in an ID: parser tests reject invalid values and normalize Arabic digits.
- OCR reads a national ID without an explicit birth-date label: derive and review date/gender from the ID digits.
- User edits OCR suggestions: test that values are not saved until the explicit save action.
- Birthday is today or the 90-day boundary: helper tests include both ends and exclude day 91.
- Employee lacks family-read permission: test no member or family alert query is made.

---

### Task 1: Egyptian ID demographics parser

**Files:** Create `src/features/families/memberDemographics.ts` and tests.

- [x] Test valid Egyptian ID derivation for both genders and Arabic digits.
- [x] Test invalid length, century, and impossible dates return no suggestion.
- [x] Test birth-date label extraction and that unlabelled dates are not treated as birth dates.
- [x] Implement parser and run its tests to green.

### Task 2: Member profile data and family form

**Files:** Create migration `014_family_member_demographics.sql` and `supabase/tests/family_member_demographics.test.sql`; modify `src/services/cases.ts`, family member UI, and tests.

- [x] Test profile save/read access and casesWrite enforcement in pgTAP.
- [x] Add nullable gender/date-of-birth columns and permission-checked `add_family_member_profile` RPC.
- [x] Add manual date/gender entry and editing for existing members, local image/PDF OCR suggestions, live computed age, explicit review/save, and optional private family-file attachment.
- [x] Test scan review, manual entry, age calculation, and read-only visibility.

### Task 3: Home reminders and verification

**Files:** Modify `src/features/families/idExpiry.ts`, `src/features/home/HomePage.tsx`, related tests, `docs/data-model.md`, `docs/deployment.md`, and `docs/progress.md`.

- [x] Test age display and 18/21 birthday alerts through day 90; exclude day 91 and past-threshold members.
- [x] Query only the fields needed for alerts and render links to each member's family file for casesRead staff.
- [x] Run unit, worker, database, type, production-build and Functions-build checks.
- [ ] Confirm hosted migration prerequisites before pushing a deployment-triggering commit.
