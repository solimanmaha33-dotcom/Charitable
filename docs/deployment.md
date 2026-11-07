# Local setup, pilot preparation and recovery

The application is unpublished. Do not link a project, push migrations, deploy, or enter real data until an operator has reviewed the pilot environment and authorized those actions. Use synthetic data for this procedure. Node.js 24, npm, Docker, the Supabase CLI and Chromium are required. The npm-installed CLI versions are pinned by the lockfile.

## Local installation and validation

1. Run `npm ci`, `npm run supabase:start`, and `npx supabase status`. The startup command includes Storage for case attachments; the local configuration keeps the Auth hook and 720-hour timebox. When preparing a disposable local database, `npx supabase db reset` applies the ordered files in `supabase/migrations` and the configured seed. **Reset destroys that local project's data**; never use it on shared data. Verify the target first. The first general manager must be bootstrapped by a trusted operator as described in [data-model.md](data-model.md); there is no default account.
2. Copy `.env.example` to `.env.local` and `.dev.vars.example` to `.dev.vars`. Populate them from local `npx supabase status` without copying values into logs or documents. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public browser configuration. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are Pages Function bindings; keep the service-role key server-side. Workers AI uses the server-side `AI` binding in `wrangler.jsonc`, not a browser credential.
3. Run `npm run build` and `npm run build:functions`. The checked-in AI binding makes `npm run dev:pages` attempt a remote AI proxy; do not use that command for an offline/mock-only rehearsal. For local non-AI Functions, create an isolated temporary directory with symlinks to this checkout's `functions` and `dist`, a copy of local `.dev.vars`, and a temporary `wrangler.jsonc` containing only `name`, `pages_build_output_dir`, and `compatibility_date` (no AI binding). Run the installed `wrangler pages dev dist --ip 127.0.0.1 --port 8788` there. Mock AI responses in browser tests; the temporary server cannot make AI calls. Remove the temporary directory and its secret-bearing `.dev.vars` after use. For Vite browser tests set `DEV_FUNCTIONS_PROXY=http://127.0.0.1:8788` and provide the local public Vite values. Run `npm run test`, `npm run test:worker`, `npm run test:db`, `npm run test:e2e`, `npm run typecheck`, `npm run build`, and `npm run build:functions`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if using an installed Chromium. The unit suite assumes no Vite Supabase configuration, so temporarily move `.env.local` out of the project while running `npm run test`, then restore it for browser tests.
4. In this managed environment Auth and Storage container health checks can receive a proxy 403 despite working services. Only for that diagnosed local condition, `npm run supabase:start -- --ignore-health-check` is a workaround; confirm operation with the database and worker tests and a Storage API probe. Do not disable TLS or authentication.

Before any future pilot, verify the current limits, pricing, data handling and terms at the official [Supabase pricing](https://supabase.com/pricing), [Supabase platform billing](https://supabase.com/docs/guides/platform/billing), [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), and [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) pages. Current numeric quotas were not externally verified in this environment; an operator must verify them and capacity for database, storage, bandwidth, requests, builds, and AI before a pilot. Verify provider quality and terms for the intended use and data before sending any real records to the model.

## Public Cloudflare Pages preview from GitHub

This is an owner-operated, non-production preview using **only the owner's newly created Supabase test project** and synthetic records/files. The Pages address will be public: anyone can load the login page, but app authorization and Supabase RLS must still protect records and private attachments. These instructions do not mean a deployment or a Pages URL already exists. Keep real beneficiary data out of this environment.

### 1. Prepare the dedicated branch and test database

1. In GitHub, open `solimanmaha33-dotcom/Charitable` and create the dedicated `preview` branch from the reviewed commit you intend to test. Keep subsequent preview changes on that branch. **Before connecting or deploying Pages, the planned Task 3 configuration change must update `name` in the existing root `wrangler.jsonc` from `charitable` to `charitable-preview`.** Verify that the reviewed commit on `preview` contains this rename while preserving `dist` and the server-side `AI` binding. The current name does not match the dedicated Pages project; do not proceed with Pages deployment until this prerequisite is complete. Do not deploy the source repository's production branch.
2. In the Supabase dashboard, open the **new test project** and check its organization, project name, project reference and API URL against the project the owner created for this preview. Stop if any identity differs or the project contains real data. Obtain its URL, anon key and service-role key privately from that project's API settings; do not paste values into GitHub, repository files, browser code, logs or chat. Only the public URL and anon key will later enter the browser build.
3. From a trusted local checkout of `preview`, run `npm ci`, then authenticate the Supabase CLI privately and run `npx supabase link --project-ref <verified-project-ref>`. Confirm the project reference before proceeding. Run `npx supabase migration list --remote` and `npx supabase db push --remote --dry-run`. Review that the target is still the new test project and the pending files are the ordered migrations in `supabase/migrations` (currently `001` through `011`). Only then run `npx supabase db push --remote`. Do not reset a hosted/shared database or apply migrations to any other project. Do not commit CLI credentials or linked-project metadata.
4. SQL migrations do not automatically configure hosted Auth settings. In the test project's Authentication settings, disable public signups and anonymous sign-ins, and enable the Custom Access Token hook using `public.staff_access_token_hook`. Set the 720-hour Auth session timebox described in [the data model](data-model.md) if the plan supports it. On plans that lock this provider-level setting, the application still enforces a hard 30-day data-access cutoff through `current_employee_id()` and RLS; the Supabase refresh token itself may remain active in the browser. Do not upgrade only for the preview. Confirm that the migrated attachment bucket remains private.
5. Bootstrap the first general manager using the existing trusted [first-account procedure](data-model.md#أول-حساب-واستعادة-الدخول): a trusted operator creates the Auth user via trusted Admin API with a random `.invalid` email, a strong temporary password, and **`email_confirm: true`** so the email is confirmed at creation, then inserts the general-manager employee and its `private.employee_auth` mapping in one database transaction. The `.invalid` address cannot receive confirmation mail; do not rely on an email confirmation link or disable email confirmation globally to bypass this step. Keep credentials and the mapping private, and deliver the password securely. There is no default account or public bootstrap endpoint. Later staff accounts are created through the authenticated manager flow.

### 2. Create the dedicated Pages project

1. In the Cloudflare dashboard, open **Workers & Pages → Create application → Pages → Connect to Git** (labels may vary). Connect GitHub and grant access to `solimanmaha33-dotcom/Charitable` only as needed. Select that repository and create a **Pages** project, rather than a Worker deployment.
2. Use these settings:

   | Setting | Value |
   | --- | --- |
   | Pages project name | `charitable-preview` |
   | Production branch for this dedicated project | `preview` |
   | Framework preset | None; set the build command explicitly |
   | Repository root directory | Repository root; leave the root override empty |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node.js version | 24 (`NODE_VERSION` build variable if needed) |

   Cloudflare calls the stable deployment of this test project **Production**, even though it is a non-production app preview. Do not select the source repository's production branch or attach a custom domain. Under **Settings → Builds & deployments → Branch control**, allow automatic production deployments from `preview` and disable preview deployments from all other branches. Apply these settings before enabling further branch-triggered builds.
3. Pages discovers the repository-root `functions/` directory and compiles its API routes alongside the static build; `functions/` is not the build output directory. Use the existing root `wrangler.jsonc` with its `dist` output and server-side Workers AI binding named `AI`. Do not add a second Wrangler config, copy the offline local mock configuration, or add a GitHub Actions deploy token. The Git integration handles deployment. The dashboard Pages project and the `name` in that same config must both be `charitable-preview`, after the required Task 3 rename described above. Wrangler uses the config name as its default Pages deployment target; a dashboard project name alone does not resolve a config mismatch. Do not deploy while the config still says `charitable`.
4. Before testing the assistant, confirm the deployed Functions have the **Workers AI** binding named exactly `AI` from the checked-in config and that Workers AI is available in the Cloudflare account. This is a server-side binding, not an API key for the browser. Review provider limits, billing and data handling using the links above; use only synthetic content for AI tests.

### Assistant provider keys

The current app uses Cloudflare Workers AI through the `AI` binding in `wrangler.jsonc`; it does not need an API token. The assistant currently ignores OpenRouter, Gemini, OpenAI, and Kilo Code keys, so adding one now will not switch models.

If a provider is added to the server code later, put its key in **Cloudflare Dashboard → Workers & Pages → charitable-preview → Settings → Variables and Secrets → Production → Add**, and choose the encrypted **Secret** type. Never put it in GitHub, a source file, browser storage, or a variable starting with `VITE_`. A provider key is not requested in this repository or chat. After adding a secret, rebuild the `preview` deployment.

ChatGPT and Gemini consumer subscriptions are separate from their developer APIs and do not automatically include API usage. OpenAI, Gemini API, and OpenRouter each require an API key and their own usage/billing terms. Kilo Code is not yet connected here; integration would need the exact Kilo endpoint and supported model format as well as a key. Review each provider's data-handling terms before sending family records to it.

### 3. Set Cloudflare configuration and deploy

In `charitable-preview` → **Settings → Variables and Secrets**, select the **Production** environment because `preview` is this project's production branch. The current Wrangler-managed project accepts dashboard values as encrypted **Secrets**. Add all five entries below there. Use only values from the verified Supabase test project; never add the service-role key to a `VITE_*` variable, browser code, GitHub secrets, or committed files.

| Name | Use and scope |
| --- | --- |
| `VITE_SUPABASE_URL` | Build configuration: the verified test-project URL. Vite embeds it in the browser bundle. |
| `VITE_SUPABASE_ANON_KEY` | Build configuration: the project's public publishable/anon key. Vite embeds it in the browser bundle; RLS is required. |
| `SUPABASE_URL` | Pages Functions runtime secret: the same test-project URL. |
| `SUPABASE_ANON_KEY` | Pages Functions runtime secret: the same test-project publishable/anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Encrypted Cloudflare runtime secret for Pages Functions only.** Never expose its value in GitHub, repository files, browser code, build variables, logs or chat. |

The two `VITE_*` values are embedded in the JavaScript bundle at build time; their encrypted dashboard storage does not make them private after build. Only the publishable key belongs there. Changing values requires a fresh build/deployment. The server values belong to Functions; application build code must never read or print the service-role secret. Keep Cloudflare's separate **Preview** environment unconfigured while other-branch deployments are disabled. If those deployments are deliberately enabled later, review their code and environment scope first; this guide does not authorize sharing secrets with arbitrary branches.

Save settings, then use **Save and Deploy** or retry the `preview` branch deployment after configuration is complete. Confirm the deployment succeeded in `charitable-preview`, shows branch `preview` and the intended commit, and includes Pages Functions. If the initial setup build ran before variables were saved, rebuild it. Copy the actual HTTPS Pages URL from the successful deployment; do not announce a URL before Cloudflare creates it.

In the **same Supabase test project**, open **Authentication → URL Configuration**. Set **Site URL** to that actual stable Pages origin and add the exact same URL to **Redirect URLs** (plus only explicit callback URLs the app actually uses). Do not use a broad wildcard or a production domain. Save before login testing. The stable URL belongs to this preview Pages project even though Cloudflare labels its environment Production.

### 4. Smoke-test the public preview

Use synthetic accounts, records and attachments only. Record pass/fail results without passwords, tokens, service-role values or record contents.

- Open the actual Pages URL in a private browser window, then open a protected route directly and reload it. Both must lead an unauthenticated visitor to the login flow without showing records or attachments.
- Submit an incorrect login, then sign in with the bootstrapped general manager. Confirm real authenticated access works, persists across reload, and that a small synthetic family/case and donation can be created and read by the authorized user. A rendered static page alone does not prove Functions or Supabase are configured.
- Create a restricted test employee through the manager flow. Verify denied features remain inaccessible and direct Supabase requests using that user's session cannot read/write unauthorized rows. With only the public anon key and no session, verify protected rows are not returned and writes are rejected. Use a trusted test client without recording credentials; hiding navigation alone is insufficient.
- Upload a harmless synthetic attachment with an authorized user and confirm authenticated download works. Try its private Storage path while signed out and with a user lacking case access; neither may download it. Do not make the bucket public to resolve an error.
- Exercise the assistant once with synthetic content and an authorized account. Confirm the Function can use the server-side `AI` binding and that a user lacking assistant permission is denied. Inspect failures privately without logging credentials or content.
- Log out and confirm protected routes and subsequent data requests using the previous session are denied. Check browser bundles and network responses for accidental service-role exposure without copying any secret into a report. If a check fails, fix configuration or code through review before sharing the preview as ready.

Only after these checks should the owner share the actual Pages URL with testers. The URL stays public; employee authorization and RLS remain mandatory. No deployment, migrations, accounts or smoke tests against hosted services were performed by writing this guide.

## Backup and recovery

Back up PostgreSQL **and** private Storage object bytes. A database dump includes metadata and object paths, not the objects themselves. Choose a consistent point in time: stop writes, record the migration version, back up the database with `pg_dump` in a secure location, and export every private bucket object by its exact bucket and path through a trusted authenticated Storage client. Include Auth and application schemas, roles and configuration as appropriate to the target environment; a simple application-schema dump is insufficient for complete recovery. Keep encrypted copies with restricted access, retention and restoration ownership. Never record keys or beneficiary data in this document.

Restore only into a separate, empty, isolated environment. Check its endpoint and project identity before any restore. Restore compatible roles, schemas and database dump using `pg_restore` or `psql` as appropriate, restore object bytes to the original private bucket and paths via Storage API, and restore Auth hook, timebox, bindings and secrets through the environment's secret manager. Do not directly manipulate Storage's internal metadata as a substitute for uploading bytes. Check that object inventory and checksums match, RLS blocks unauthorized reads, authorized users can download files, and application records and family codes match the backup. Test account recovery and login without disclosing credentials. Record the recovery point, gaps and elapsed time. Resume writes only after the operator accepts the result.

For local rehearsal create a uniquely named disposable database and temporary private bucket/object with synthetic content. Dump and restore into a second uniquely named database, download the object into a temporary file and compare its checksum after re-upload to a second disposable bucket or path. Delete only the uniquely identified rehearsal resources after verification. Never restore over the running shared database or bucket. This rehearsal checks mechanics, not managed-provider disaster recovery; before a pilot, rehearse the provider-specific full recovery process and retention settings in a separate environment.

## Orphaned files

A failed upload cleanup may leave an object without a `case_files` row. A trusted operator should inventory metadata and Storage paths at a consistent snapshot, account for in-flight uploads and retries, compare inventories, and quarantine candidates for an agreed retention period. Review candidates and backup coverage with an authorized second person, recheck references and upload activity immediately before any approved deletion, and log decisions without exposing file content. No automatic production cleanup is provided or executed. Preserve uncertain objects until resolved.

## Known limitations

Assistant retrieval is bounded and literal search can miss relevant records; results are partial. The model's instructions are best effort, not a guarantee; staff must review output, and provider quality and terms remain unverified. OCR is local and needs human review; a permission change during an in-flight OCR request can race, and the OCR-save success label is confusing. Assistant file sources open the case rather than the specific file. Client-side search scales with record count. See [architecture.md](architecture.md) and [progress.md](progress.md) for context.
