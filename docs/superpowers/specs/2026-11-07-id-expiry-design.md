# ID Scan and Expiry Alerts Design

## Intent

Help staff record a family contact's Egyptian national ID and see cards that have expired or will expire soon.

## Behavior

- Reuse the existing local Arabic OCR for one uploaded/scanned ID image or PDF. OCR suggestions include a 14-digit ID and an expiry date only when text near an expiry label supplies a recognizable date.
- Staff review and can edit both suggestions before saving. If OCR misses a field, staff can enter it manually. No OCR text or ID image is sent to an AI provider.
- Save an optional expiry date on the existing main family contact. Preserve the existing private family file upload path by attaching the scanned document to that family.
- The home page lists expired IDs and IDs expiring within the next 90 calendar days for staff who can read families. The warning is informational and does not send notifications.
- RLS, `casesRead`, and `casesWrite` continue to protect family data and attachment operations.

## Approaches

1. **Local OCR with staff confirmation and a home-page list (chosen).** It reuses the existing Arabic OCR and private family attachments, makes date errors reviewable, and requires no external provider or per-staff setup. The default warning window is 90 days.
2. **Manual expiry entry only.** This is smaller but does not meet the request to scan ID cards.

## Limits

OCR is a suggestion, not a guarantee; the expiry date must be checked against the card. Dates that cannot be read remain blank until staff enters them. There are no email, SMS, or push notifications. Expiry is associated with the family profile's main contact; other members need a separate future data-model change.

## Data change

Migration `013_family_id_expiry.sql` adds a nullable date and column-scoped write grants. It is separate from migration `012_family_profiles.sql` so it remains safe if 012 has already been applied. Both migrations must be applied before the new screen behavior is available in the hosted project.
