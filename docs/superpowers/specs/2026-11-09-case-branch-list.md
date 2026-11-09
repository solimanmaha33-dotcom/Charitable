# Case branch list and numeric income

## Intent

Make case intake easier to fill consistently by offering the association's branches and keeping monthly income numeric-only.

## Requirements

- Monthly income accepts digits only; commas, decimal points, spaces, and letters are not entered.
- The branch field is a select with the initial branches «القاهرة - المرج» and «الفيوم - جبل النجار», plus «إضافة فرع جديد».
- Choosing the add option opens a dialog to add a branch or remove an existing branch from the shared list.
- The branch list is shared across staff through Supabase. Removing a branch removes it from future choices but leaves its name on already saved case files.
- When editing a case whose saved branch is no longer in the shared list, show that existing value so it is not lost unless the employee changes it.

## Approaches

- Keep options in browser storage: quick, but branch changes would not appear for other workers.
- Put the shared options in Supabase and keep the existing case branch as text: selected because all workers share changes while old case records remain intact.
- Add a required branch foreign key to case files: stronger linkage, but would require migrating existing names and would prevent preserving historical values after branch removal.

## Scope

Add a small branch-list table and policies, service methods, a management dialog in the intake form, numeric-only income handling, focused tests, and documentation. No other case fields or saved records are changed.
