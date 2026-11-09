# Employment status for parents and household members

## Goal

Record one employment status for each parent and every additional household member. The available choices are «يعمل»، «لا يعمل»، «طفل»، and «طفلة». Selecting «يعمل» reveals a field for the kind of work.

## Decisions

- Employment data belongs to each person, not to the case as a whole.
- Parent employment status and work type are stored on the canonical case file; member employment status and work type are stored on `people`.
- Work type is optional text up to 200 characters, shown only when status is «يعمل».
- Existing case records and health data remain unchanged; a forward-only migration adds nullable columns.
- Details and the printed case form include the information.

## Acceptance

- Father, mother, and each family member can choose any of the four statuses.
- A work-type field appears when «يعمل» is selected and hides for other choices.
- The selected status and work type persist across save/edit and are shown in details and print.
- Existing member RPC callers remain compatible.
