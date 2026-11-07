# Family Profile Design

## Intent

Make one family file useful for daily charity work: retain its existing family name and unique code, record a primary contact, up to three phone numbers, a short family note, and private photos/PDFs. Staff can preview and remove family attachments from the family page.

## Scope and permissions

- Primary contact name, age, and Egyptian national ID belong to one contact on the family record. Existing family-member records remain name and relationship only.
- Age and ID are optional; age is a whole number from 0 to 120, and an entered national ID has 14 digits. Do not enforce uniqueness.
- All fields and family attachments use the existing `casesRead`/`casesWrite` permissions and current staff-session checks.
- Files use the existing private `case-files` bucket and current 20 MB, PDF/image, and document-inspection limits. Metadata is stored separately in `family_files` and paths use the family UUID prefix.
- Upload and removal are server-side Pages Functions; the browser cannot insert metadata or access the service-role key.
- OCR runs locally in the browser for previewed files. Its text is not automatically saved or sent to the AI assistant.

## Approaches

1. **Extend the family record and add a family attachment table (chosen).** This fits the user's request for one main contact on the family profile and reuses the existing private bucket, upload inspection, preview, and permission model. It adds one migration and two small server endpoints.
2. **Put contact identity fields on every family member.** This is more accurate for households with multiple adults, but requires redesigning member creation/editing and clarifying individual contacts. It is outside the approved simple first step.

## UI behavior

- Family form keeps household name and edits primary contact, age, national ID, up to three phone numbers, and family note.
- Family details show those values with plain Arabic labels, list existing family attachments, allow authenticated previews, and offer a confirm-before-remove action to writers.
- Staff with read-only access can view permitted family data and attachments but cannot change or remove them. Staff without case-read access receive no family details or files through RLS.
- National ID is not placed in the family directory, search index, or AI retrieval.

## Limits and non-goals

No person-specific fields for every member, case workflow, audit screen, export, cloud OCR, provider changes, or schema deployment to the hosted Supabase project are included. A new Supabase migration must be applied before the preview can read/write these added fields.
