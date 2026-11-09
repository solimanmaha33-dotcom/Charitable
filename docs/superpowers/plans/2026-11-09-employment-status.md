# Employment Status Implementation Plan

**Goal:** Save employment status and optional work type for each parent and every household member.

**Architecture:** Add nullable status and work-type columns to `families` for the parents and `people` for other members. Update forms, services, case details, print, and database tests. Preserve the previous 5- and 7-parameter member RPCs; add a new compatible overload.

**Spec:** `docs/superpowers/specs/2026-11-09-employment-status.md`

## Steps

1. [x] Add failing form/service/details/print and PgTAP tests; run focused tests to confirm the missing behavior.
2. [x] Add migration `022_person_employment_status.sql`, implement data mapping and UI conditional fields.
3. [x] Run focused and full tests, typecheck, build, and local database migration/test.
4. [x] Update data model and progress notes. Do not apply remote migrations or publish unless requested.
