# End-to-end test

`flow.mjs` drives the real app in Chromium through every phase: admin creates a
university → student signs up, completes profile, uploads documents, submits →
admin verifies (first grant opens) → donor pays by card (declined, then success)
→ second donor pledges the remainder anonymously and uploads proof → admin
confirms an adjusted amount (grant funded) → admin records the university payment
with receipt (grant paid) → student posts results → admin approves (next grant
opens) → first donor renews in one click → messaging (contact details blocked,
results shared) → access-control checks on documents → admin stats, CSV export,
audit log → pledge expiry via the cron endpoint → GDPR export.

It needs a Supabase stack. With the Supabase CLI: `supabase start`, apply
`supabase/migrations` + `supabase/seed.sql`, and point `.env.local` at it.

Without Docker you can run the pieces directly (this is how it was verified):

1. Postgres 15+, with the `anon`, `authenticated`, `service_role`, `authenticator`
   and `supabase_auth_admin` roles and an `auth` schema owned by the latter.
2. [Supabase Auth (GoTrue)](https://github.com/supabase/auth/releases) on :9999 with
   `GOTRUE_MAILER_AUTOCONFIRM=true` and `./auth migrate` run first.
3. [PostgREST](https://github.com/PostgREST/postgrest/releases) on :54322.
4. Apply `supabase/migrations/*.sql` and `supabase/seed.sql`.
5. `node tests/e2e/gateway.mjs` — serves `/rest/v1`, `/auth/v1` and a minimal
   on-disk `/storage/v1` on :54321.
6. `node tests/e2e/keys.mjs` prints a JWT secret plus anon/service keys for
   GoTrue, PostgREST and `.env.local` (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`).
7. `npm run build && npm start`, then
   `PG_URL=postgres://postgres@127.0.0.1:5432/postgres node tests/e2e/flow.mjs`
   (needs `playwright` installed; set `CHROMIUM_PATH` to use a system Chromium).

Screenshots are written to `tests/e2e/shots/` (git-ignored).
