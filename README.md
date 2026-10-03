# Corporate, Area, dan IJR Monitoring

Live application: https://imp-project-jade.vercel.app

React, Vite and TypeScript migration of `Corporate_Area_IJR_Monitoring_WCI_v78.html`, backed by Supabase. Repository: https://github.com/Windu1204/Windy-Project.

## Features

- IJR BNIdirect, Area non-BNIdirect, and Corporate non-piloting dashboards.
- Status, process duration, region/branch, product, PIC workload, SLA and record detail views with chart drilldowns.
- Search, month, custom date range, status, type, region/segment, product, PIC, flow, branch and SLA filters.
- CSV/XLSX imports with sheet selection, adaptive headers, invalid-row quarantine, revision downloads, duplicate warnings and atomic replacement.
- CSV/XLSX exports and selected-section Word/PowerPoint reports using the active or custom filters.
- Original dataset restore, Area status updates with notes, custom SLA rules and display-name profiles.
- Authenticated workspace membership, viewer/editor/admin roles, RLS and audit history.

## Local development

Requires Node.js 22.12+ and pnpm 11. Copy `.env.example` to `.env.local`, set the Supabase URL and **publishable** key, then run:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
```

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are exposed to the browser. Never use a service-role/secret key with a `VITE_` prefix. No privileged backend key is needed by this application.

Components are in `src/components`, calculation/import/report logic in `src/domain`, typed models in `src/types.ts`, and authenticated persistence in `src/lib`.

## Database setup

Apply `supabase/migrations/*.sql` in timestamp order to a Supabase project using its database administrator connection. The migrations are the source of truth; `supabase/schema.sql` is a reference copy of the initial schema.

Data uses versioned batches. Imports and restores run as security-invoker transactions, lock the dataset pointer, validate membership and switch the active batch atomically. The original batches cannot be changed through frontend permissions. Records retain all source fields as typed JSON payloads because each dashboard has a different source schema. Audit entries capture imports, restores and record status updates.

To reproduce the original-data migration, keep the HTML locally and run:

```sh
node scripts/extract-source.mjs /path/to/Corporate_Area_IJR_Monitoring_WCI_v78.html
pnpm seed
pnpm verify:database
```

The extractor parses JSON without executing the HTML, extracts only the three dashboards, and places private data/reference scripts under ignored `private/`. It excludes the outer legacy login configuration. `seed` generates idempotent administrator SQL: run `000-prepare.sql`, the 67 dataset chunks in manifest order, verify every mismatch count in `private/verification` is zero, then run `999-activate.sql`. For a different workspace set `WCI_WORKSPACE_ID` before generating SQL. Generated data and SQL must stay out of Git and the production bundle.

The configured Supabase project is `bjaxdgncwfnbskuuglcg`; workspace ID is `00a0f3a9-ba2b-42fb-8f98-211e5c1fa8cb`. The 1,000 IJR, 1,098 Area and 4,509 Corporate originals and initial working batches have been migrated and verified there.

## Administrator and membership

Create the first administrator under Supabase Authentication → Users with the preauthorized administrator email and a password chosen by the owner. Its preauthorized email grant in the chosen project's private schema attaches admin membership when the email is verified. Credentials from the original HTML are not reused.

For another workspace/user, a trusted project administrator can preauthorize a verified email with:

```sql
insert into wci_private.access_grants(email,workspace_id,role)
values ('person@example.com','YOUR_WORKSPACE_UUID','viewer')
on conflict(email) do update set workspace_id=excluded.workspace_id,role=excluded.role;
-- For an already verified Auth user, attach membership explicitly:
insert into public.wci_members(workspace_id,user_id,role)
select 'YOUR_WORKSPACE_UUID',id,'viewer' from auth.users
where lower(email)='person@example.com' and email_confirmed_at is not null
on conflict(workspace_id,user_id) do update set role=excluded.role;
```

Viewers can read/export/report. Editors and admins can import/restore datasets, update Area records and change custom SLA rules. Membership administration stays in the trusted Supabase dashboard/SQL connection; the frontend cannot grant itself access. No self-registration or email delivery is performed by the app.

## Verification

Twelve calculation/import/report parity tests pass with the original private fixture present, including every-record SLA parity against whitelisted original calculation functions. Without private fixtures, the six original-data checks are skipped and the six synthetic boundary/integrity tests run.

Five browser tests cover all dashboards, filtering, pagination/details, spreadsheet quarantine/apply/restore, CSV/Word/PowerPoint downloads a custom calendar period picker and a 390px mobile viewport. After extraction, start `pnpm dev`, install/use local Chrome, then run `pnpm exec playwright test`.

Supabase RLS was checked with temporary identities in a rolled-back transaction: viewer writes denied, editor import/restore/update/custom rule accepted, original writes denied, nonmembers saw no records, and anonymous table access denied. The database security checks passed. The project Auth advisor reports [leaked password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); enabling that protection remains an owner-controlled Supabase setting. The performance advisor only flagged newly created indexes as [unused](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index); these are retained for audit and foreign-key access. Database integrity hashes and counts matched all three original datasets. `supabase/tests/access.sql` reproduces the access test against this workspace.

The local development preview is available only in Vite development mode with local extracted fixtures. It uses memory for changes. Production requires authenticated Supabase access and contains no embedded company records.

## Vercel deployment

The production application is deployed to `windyolivia01-7061s-projects` as `imp-project`, with `Windu1204/Windy-Project` connected to the existing Vercel project. Commits pushed to the production branch `main` trigger automatic deployments. The original deployment used Vercel Drop; the Git connection now provides subsequent deployments. Production Vercel environment variables store the public Supabase URL/publishable key. Vercel production configuration overrides the public values included in the initial ignored `.env.production` deployment archive; the live Auth endpoint was checked against this configured project. No company fixtures are uploaded.

For a fresh deployment, import `Windu1204/Windy-Project` into the intended Vercel workspace, select Vite, and set the two public Supabase environment variables for production and preview. The existing application is already linked; do not create another Vercel project for normal updates. `vercel.json` defines `pnpm build`, `dist`, SPA routing and security headers. A linked Git repository supports subsequent deployments from main.

Production sign-in uses email/password and does not require an Auth redirect. If email confirmation/reset flows are enabled externally, configure Supabase Auth Site URL/allowed redirects to the actual deployment domain.

## Compatibility notes

The source SLA policy and its effective date (14 July 2025), inclusive weekdays, null handling, unavailable-SLA exclusions and product mappings are preserved. Original incomplete values remain visible instead of being silently removed (the Area source has blank statuses). Custom rule precedence follows the original Corporate memo mapping. New imports validate required fields and real calendar dates. Duplicate requests are retained with a warning, preserving source counts. Report generators preserve the original v78 layouts: branded photo covers, editable charts, monthly overview pagination, management summaries and individual operational detail. All Name reports include every implementor KPI and intentionally omit the raw-record appendix, matching the HTML. Individual reports include the selected implementor’s detail records. Word uses the original portrait layout. Very large reports may take longer to generate in the browser.


## v78 visual and report compatibility

The original sidebar/login brand images and styles, overview card arrangement, request-period picker, and SLA panels have been restored. Authentication uses Supabase email/password in the original login design. React owns filter state and dataset selection; the original export renderers are isolated behind typed report models in `src/domain/report-model.ts` and `src/domain/report-renderers`. They do not discover state from the DOM, execute the source HTML, embed private company data, or reuse its login credentials.

Report filters default to the independent Custom Report dataset, with All Name management mode or one PIC / Implementor. The source report model was compared against all 6,607 fixtures in both modes. Twelve Word/PowerPoint downloads across all three dashboards and both modes were checked for valid Office packages, editable charts, cover images, portrait Word sections, and the expected presence/absence of operational detail. Browser tests include filter, import/restore, export, navigation and mobile flows. For a non-default dev-server port, set `PLAYWRIGHT_BASE_URL` when running browser tests.
