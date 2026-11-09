# Contact and national ID number validation

## Goal

Require each entered national ID to have exactly 14 digits, accept digits only in phone fields, validate Egyptian mobile/home number lengths, and require at least one contact number.

## Decisions

- National IDs remain optional; if present, they must contain exactly 14 digits. Arabic and Persian digits are normalized to Latin digits before storage.
- Mobile 1 and mobile 2 each require 11 digits when present; home phone requires 10 digits.
- At least one of the three phone fields is required.
- Phone input removes non-digits as the user types and limits entry to the field's maximum length.
- The labels are «رقم الموبايل 1»، «رقم الموبايل 2»، and «رقم المنزل».
- Existing national IDs and phone values are preserved; malformed values must be corrected before saving a file.

## Acceptance

- The form accepts Arabic/Persian numerals, stores normalized digits, and blocks incomplete national IDs or invalid phone lengths.
- A file cannot be saved with all three phone fields empty.
- Service validation enforces the same rules in case the UI is bypassed.
- Database triggers also enforce number lengths and contact presence for direct API writes.
- Card scanning updates only the ID and expiry fields, without rewriting contact data or bypassing contact validation on case saves.
- Phone and national ID validation has focused automated tests.
