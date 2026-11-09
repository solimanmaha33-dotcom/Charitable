# Contact Number Validation Plan

**Goal:** Enforce the requested national ID and phone number lengths and make at least one phone number mandatory.

**Architecture:** Normalize Arabic/Persian digits at the form boundary, accept digits only, validate exact lengths in the form, service, and database, and rename the three phone fields. Add a database-only identity update for card scanning so it changes no unrelated profile fields.

**Spec:** `docs/superpowers/specs/2026-11-09-contact-number-validation.md`

## Steps

1. Add failing UI/service tests for exact national ID lengths, phone numeric-only rules and lengths, required contact number, and the updated field order/labels.
2. Implement input normalization and validation.
3. Run focused and full tests, typecheck, build, and `git diff --check`.
4. Add migration `024_case_contact_validation.sql`, record the change in `docs/progress.md`, and verify it locally. Apply it to the hosted database before deploying.
