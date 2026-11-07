# Family Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add primary contact details, up to three phones, a note, and private photo/PDF attachments to a family profile.

**Architecture:** Extend `families` with optional contact fields and a short note. Add RLS-protected `family_files` metadata while reusing the private `case-files` bucket and its inspection limits. Route uploads and removals through authenticated Pages Functions using a server-only service key.

**Tech Stack:** React, TypeScript, Supabase Postgres/Storage, Cloudflare Pages Functions, Vitest, pgTAP.

**Spec:** `docs/superpowers/specs/2026-11-07-family-profile-design.md`

## Task 1: Database fields and family attachment permissions

Files: `supabase/migrations/012_family_profiles.sql`, `supabase/tests/family_files.test.sql`, `docs/data-model.md`.

- [ ] Write pgTAP coverage for optional profile fields, constraints, RLS read/write, private object read, and denied direct writes.
- [ ] Run the database test and verify it fails for missing migration objects.
- [ ] Add additive family columns and `family_files` table with casesRead RLS, and update private-bucket read policy to recognize both case and family metadata.
- [ ] Keep metadata inserts/deletes server-only; preserve case object access behavior.
- [ ] Run database tests and review grants/policies.

## Task 2: Authenticated upload and removal endpoints

Files: `functions/api/family-files/upload.ts`, `functions/api/family-files/delete.ts`, route tests.

- [ ] Test denied sessions/permissions, invalid family/file identifiers, invalid file content, successful private upload, and removal.
- [ ] Reuse trusted session verification, bounded request reading, and document inspection; store with admin credentials only after repeated live permission checks.
- [ ] Remove the object and metadata through a server-only endpoint after verifying the caller can write family data.
- [ ] Run focused endpoint tests, plus Pages Functions build.

## Task 3: Service and family screen

Files: `src/services/cases.ts`, `src/services/cases.test.ts`, `src/features/families/FamilyForm.tsx`, `src/features/families/FamilyListPage.tsx`, family UI tests, `src/shared/app.css`.

- [x] Test save/read of profile fields, listing/downloading/uploading/removing family files, and search by all three phones.
- [x] Add labels and bounds to the family form; keep age/ID optional and validate entered ID as 14 digits.
- [x] Add private family-file upload, preview, and confirm-before-remove UI; hide mutation controls from readers.
- [x] Run unit and worker tests, typecheck, production build, Functions build, DB tests, and `git diff --check`. Local browser visual checks remain useful before the owner shares the preview.
- [x] Update the progress and data-model docs; state hosted migration requirement clearly.
