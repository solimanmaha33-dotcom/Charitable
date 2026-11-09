# Individual health records and parent national IDs

## Goal

Let staff record health for each parent and additional family member, capture both parents' national IDs, and hide father fields when the case category is widowhood.

## Decisions

- Keep the existing general household health note for compatibility; add a health status and detail field for each parent and each `people` row.
- Health status is optional; choices are «مستقرة»، «عجز أو إعاقة»، «مرض». Choosing disability or illness reveals a details field and requires a value.
- Keep parent names and IDs on the canonical family/case profile. Father name, ID, and health fields are hidden while «أرملة» is selected, but toggling the category does not erase entered values.
- Keep member age derived from date of birth at display time; do not store a duplicate age that becomes stale.
- National IDs remain optional and, when entered, must be exactly 14 digits. Existing member ID OCR behavior remains unchanged.
- Preserve the old five-argument member RPC for old clients; add a seven-argument version with health status and details.

## Acceptance

- New and existing family members can save/edit an individual health status and details.
- Father and mother have separate health status/details and national ID fields, shown in details and print.
- Additional members' health status/details are shown in details and print.
- Widow category hides all father-entry fields without clearing saved draft state.
- Age updates immediately from date of birth and remains computed rather than manually entered.
- A forward-only Supabase migration adds the columns and updates the save RPC.
