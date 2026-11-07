# Charity Workspace UI Design

## Intent

Make the charity system feel ready for daily work by staff who handle family records, cases, donations, sponsorships, and files. The interface remains entirely in clear Egyptian Arabic and works well for a small team on desktop and mobile.

## Goals

- Give staff a clear, consistent workspace with visible location, account, and sign-out controls.
- Make family and case records easy to find and open, using readable tables, search, and relevant filters.
- Present a useful start page with direct actions instead of a placeholder.
- Make forms, file previews, loading, empty, error, and saved states clear and consistent.
- Preserve current data, permissions, authentication, and service behavior.

## Non-goals

- No schema, role, authorization, AI, or OCR changes.
- No fabricated activity, totals, timestamps, or sample records in the live interface.
- No changes to Cloudflare, Supabase, or deployment configuration.

## Approaches

1. **Surface restyle only:** update shared colors and spacing. Fast but leaves the confusing navigation and record workflows intact.
2. **Workflow-focused workspace (chosen):** improve the shared shell and refactor the homepage, family directory, family file, case directory, login, and shared form/table styling while retaining existing service APIs. This addresses the user's complaint without expanding the system's business scope.
3. **Full product rewrite:** replace routing, data loading, and all feature flows. Higher risk and unnecessary for improving the current usable prototype.

## Design direction

Use the generated home-screen and family-directory concepts shown in this conversation as visual references. The app uses RTL layout, a deep forest-green navigation rail, true white content surfaces, a pale cool background, thin dividers, restrained corner rounding, and Noto Sans Arabic. Work surfaces prioritize readable tables and short action paths over repeated cards.

## Scope and content

- Shared shell: organization name, staff account and sign-out, right-side navigation for home, families, cases, donations/sponsorships, assistant, and staff; active location is visible. Hide sign-in as a navigation destination. Keep the existing sign-in route reachable from the sign-in prompt.
- Home: a direct welcome and useful quick actions that respect staff permissions. Do not present fabricated activity or counts.
- Family directory: searchable, filterable table with family code, name, phone, case categories, and open-file action; clear loading, error, empty, and no-match states; add-family form is easy to find.
- Family file: clear identity header, phone, edit/add actions, family members, and linked cases with direct open/add actions.
- Case directory/details: searchable table/list with family identity, categories, and notes; preserve existing case edit and file preview/upload behavior.
- Login and shared forms: readable labeled fields, visible validation/error and pending/success states, consistent button hierarchy and spacing.
- Remaining feature screens retain their existing information and actions while receiving the shared visual system.

## Constraints and calls

- Reuse existing React, Vite, React Router, Supabase service functions, and local Noto Sans Arabic font.
- All visible product copy remains Arabic Egyptian dialect; technical details stay out of the staff interface.
- Keep navigation and actions permission-aware where the current profile is available. Database RLS remains authoritative.
- On narrow screens, collapse the rail into a horizontal/toggleable navigation and let tables scroll horizontally without breaking RTL text.
- Use accessible headings, labels, focus indicators, keyboard-reachable actions, and contrast.
