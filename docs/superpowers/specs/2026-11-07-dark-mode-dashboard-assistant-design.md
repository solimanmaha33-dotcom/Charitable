# Dark Mode and Daily Workspace Improvements

## Intent

Make the Maram El-Khair workspace more comfortable for daily staff use and easier to scan without changing its Arabic-first workflows or data access rules.

## Goals

- Offer an accessible theme switch that follows the device preference until the staff member chooses a theme, then remembers that choice on the current browser.
- Show accurate record counts on the start page only for data the signed-in staff member may read.
- Make the assistant easier to start using, while clearly stating its limits and reminding staff to verify generated answers.
- Document how the currently configured assistant works and where a future provider key belongs.

## Non-goals

- Do not add or rotate AI keys, send real records to new providers, or implement a multi-provider selector in this change.
- Do not add fabricated activity, statuses, counts, or promises of comprehensive answers.
- Do not modify database schema, role permissions, or the existing Cloudflare Workers AI model.

## Approaches

1. **Use the existing Cloudflare AI binding and improve the current UI (chosen).** This avoids sending case records to another company and requires no new secret. Add external providers only after choosing one and reviewing its data and cost terms.
2. **Add a server-side provider selector for Cloudflare, OpenRouter, Gemini, and OpenAI now.** This offers flexibility but requires multiple keys, provider-specific failure handling, and a decision about where sensitive case data is processed.
3. **Let each employee choose and enter an API key in the browser.** Rejected because it would expose keys and make the service harder to operate safely.

## Design decisions

- Theme starts from the operating-system preference. A sun/moon button in the header overrides it and saves `light` or `dark` in local storage. The preference belongs to this browser, not the employee account.
- The home page requests exact counts through Supabase `count: 'exact'` queries, relying on RLS and matching visible permission checks. Counts are named as totals, not “open” or “active” because the data model has no such lifecycle state.
- The assistant screen shows a few example questions, a bounded-results notice, and explicit human-review guidance. It remains on Cloudflare Workers AI through the existing server-side `AI` binding.
- Cloudflare Workers AI needs no API key in the project settings. Other providers are not usable by this app until a server-side adapter is implemented; keys would then be stored as encrypted Pages Function secrets, never as `VITE_*` variables or GitHub values.

## Constraints

- Keep all visible product text in simple Egyptian Arabic.
- Preserve RTL layout, keyboard use, readable contrast, reduced-motion support, and staff permissions.
- Never place provider credentials in source files, browser storage, build variables, or chat.
