# Public Cloudflare Pages Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a public, non-production preview of the charitable case system that builds from GitHub and uses the owner's Supabase test project.

**Architecture:** GitHub stores the source and triggers Cloudflare Pages Git integration on a dedicated `preview` branch. Cloudflare Pages serves the React app and Pages Functions; Supabase provides Auth, Postgres, and private Storage. The existing Workers AI binding remains server-side. The preview uses synthetic data only.

**Tech Stack:** GitHub, Cloudflare Pages, Cloudflare Pages Functions/Workers AI, Supabase Auth/Postgres/Storage, Vite, Wrangler.

**Spec:** `docs/superpowers/specs/2026-11-06-public-cloudflare-preview-design.md`

## Global Constraints

- Preview URL is public, but login, server authorization, and database RLS continue to protect records.
- Use a dedicated Supabase test project, never a production database or real beneficiary information.
- Keep `SUPABASE_SERVICE_ROLE_KEY` in Cloudflare Pages runtime secrets only; never put any secret in GitHub or chat.
- Use the existing `wrangler.jsonc` as the sole Wrangler config.
- Deploy previews from a dedicated `preview` branch; do not change or deploy the production branch.
- Confirm the selected Supabase project before applying migrations or bootstrapping the first general manager.
- Avoid automatic database migration pushes until the target project and migration history are verified.

## Review Focus

- Wrong Supabase project selected: verify project reference/URL before migrations and use only the test project.
- Missing Vite build variables: build with the preview Supabase URL and anon key and verify the deployed page points to that project.
- Service-role exposure: confirm the key is a runtime secret and absent from built assets, GitHub variables, commit history, and browser requests.
- Public-route authorization: verify anonymous visitors can see only the login page and cannot call protected APIs or read private Storage objects.
- Branch targeting: verify a push to `preview` creates a public preview while the production branch and domain remain unchanged.

---

### Task 1: Document GitHub-to-Cloudflare Preview Setup

**Files:**
- Modify: `docs/deployment.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the existing `wrangler.jsonc`, `package.json` build command, Pages Functions in `functions/`, and the owner's Supabase test project.
- Produces: exact dashboard values and environment-variable scopes needed to deploy only the `preview` branch.

- [x] **Step 1: Write the preview setup checklist** covering Cloudflare Pages GitHub authorization, repository selection, `preview` branch, build command `npm run build`, output directory `dist`, and the existing Pages Functions and AI binding.
- [x] **Step 2: Add preview-only bindings** to the guide: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; identify the last value as a runtime secret.
- [x] **Step 3: Document Supabase setup** for the test project: confirm the project target, apply ordered migrations only after confirmation, set the Pages URL and branch-preview URL in Auth redirect settings, bootstrap the first general manager securely, and use synthetic data.
- [x] **Step 4: Link the setup guide** from `README.md` and check links and formatting with `git diff --check`.

### Task 2: Create and Publish the Preview Branch

**Files:**
- Git branch: `preview`

**Interfaces:**
- Consumes: the approved local `work` commit and the existing origin `solimanmaha33-dotcom/Charitable`.
- Produces: a GitHub `preview` branch containing the reviewed app, without changing the production branch.

- [x] **Step 1: Verify the current `work` tree is clean** and record the exact commit that will be used.
- [x] **Step 2: Create `preview` at that commit** and push it to the existing GitHub origin using configured authentication; never print credential values.
- [x] **Step 3: Verify the remote `preview` ref** matches the local commit and confirm the production ref was not changed.

### Task 3: Connect Cloudflare Pages and Supabase Preview Settings

**Files:**
- Modify: `wrangler.jsonc` (Pages project name `charitable-preview`)
- Cloudflare Pages project settings (dashboard)
- Supabase test-project settings (dashboard)

**Interfaces:**
- Consumes: GitHub `preview` branch, Task 1 checklist, and the owner's Cloudflare/Supabase accounts.
- Produces: a Cloudflare Pages public preview URL whose Pages Functions use the test Supabase project.

- [ ] **Step 1: Set the Pages project name** in `wrangler.jsonc` to `charitable-preview`, keeping `pages_build_output_dir` and the existing AI binding unchanged.
- [ ] **Step 2: Connect the GitHub repository** in Cloudflare Pages as the dedicated `charitable-preview` project and select `preview` as that project's production branch; do not add a custom domain. The project URL remains public.
- [ ] **Step 3: Configure the Pages build** with `npm run build` and `dist`; verify Pages picks up the root `functions/` directory and `wrangler.jsonc` AI binding.
- [ ] **Step 4: Add project variables** in the Pages production environment (which serves only the dedicated test project); put `SUPABASE_SERVICE_ROLE_KEY` in the secret field and keep all values out of GitHub and logs.
- [ ] **Step 5: Apply the project's migrations to the confirmed Supabase test project** and configure its Auth site/redirect URLs for the public Pages URL.
- [ ] **Step 6: Create the first general manager** through the documented trusted bootstrap procedure; do not use a default or shared password.

### Task 4: Verify the Public Preview

**Files:**
- Modify: `docs/progress.md`
- Cloudflare Pages preview URL

**Interfaces:**
- Consumes: successful build and preview URL from Tasks 2–3.
- Produces: a recorded public smoke-test result and known configuration gaps.

- [ ] **Step 1: Run local checks** with `npm run test`, `npm run test:worker`, `npm run test:db`, `npm run typecheck`, `npm run build`, and `npm run build:functions`.
- [ ] **Step 2: Verify the public login page** from a signed-out browser, and verify direct protected API calls and private Storage downloads are denied.
- [ ] **Step 3: Sign in with the synthetic general-manager test account** and create a fake family, case, attachment, donation, and sponsorship; verify the generated family code, upload/preview, and monthly payment flow.
- [ ] **Step 4: Verify preview URLs do not expose secret values or real records**, record the preview URL and smoke-test results in `docs/progress.md`, and do not promote the preview to production.

## Self-review

- The design's public URL, GitHub source, Cloudflare Pages/Functions, existing AI binding, and Supabase backend each have a corresponding setup or verification step.
- The plan assumes the new Supabase project is dedicated to testing; stop if it is production or contains real data.
- Cloudflare account authorization and secret entry must happen in the owner's dashboard; no credentials are needed in this repository or conversation.
- Deployment cannot be completed from the current executor unless Cloudflare account access is provided through the supported dashboard flow; GitHub push is possible only with configured remote authentication.
