# Member Age Alerts Design

## Intent

Help Maram El-Kheir staff notice girls approaching age 21 and boys approaching age 18, when the charity may need to review eligibility.

## Chosen approach

Add optional date of birth and gender to each family member. A staff member can type them directly or choose an ID-card photo/PDF; local Arabic OCR may read the 14-digit Egyptian national ID and derive the date of birth and gender. Staff review and correct suggestions before saving. If the card cannot be read, manual entry remains available. The full ID number is not saved for family members; only birth date and gender are stored. An explicitly selected card file can be attached to the family's existing private files.

This is preferred over saving only an age, which becomes stale, and over requiring every member's national ID, which collects more sensitive information than this reminder needs.

## Behavior

- Show a live age from the saved date of birth wherever the family member is displayed; do not store a second, stale age value. Staff can add this information when adding a person or fill it in later for an existing family member.
- On the home page, show members whose 21st birthday (female) or 18th birthday (male) falls today or within the next 90 calendar days. Link each reminder to its family file. Continue to respect family read permission.
- Compute dates using the Cairo calendar. Invalid or incomplete ID values produce no suggestion; staff can still enter date and gender manually.
- OCR stays on the device. Review is required before saving. Never send the ID image, ID number, birth date or gender to an AI provider.
- Skip reminders when a member's gender or date of birth has not been recorded. Existing age-threshold reminders do not include people already past the threshold.
- A February 29 birthday is counted on March 1 in non-leap years.

## Alternatives considered

1. Save date of birth and gender (chosen): accurate age over time, can be entered manually or suggested from a card, and avoids retaining a national ID number.
2. Save a manually entered age and gender: simpler form, but the age becomes out of date and cannot determine a precise upcoming birthday.
3. Require and retain a national ID per person: can derive age and gender, but collects extra sensitive data and excludes people without a card.

## Data and limits

An additive migration adds nullable `gender` and `date_of_birth` fields for people and a permission-checked RPC for creating a family member with these fields. The reminder uses a 90-day window. It is informational only: no external messages or notifications. Missing data is not guessed. The original ID number is not retained in the member profile.
