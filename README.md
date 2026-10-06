# FundMyDegree

A global platform connecting university students who need tuition funding with
donors who want to sponsor their degrees. **Money never goes to students** — it
goes to the university, either through the platform or paid directly by the donor.

Next.js 15 (App Router, TypeScript) · Tailwind CSS v4 · Supabase (Postgres, Auth, Storage).

## Getting started

```bash
npm install
cp .env.example .env.local          # fill in your Supabase URL and keys
```

1. Create a Supabase project (or run `supabase start` locally).
2. Apply the schema in order, then the reference data:
   `supabase/migrations/0001…0006*.sql`, then `supabase/seed.sql`
   (with the CLI: `supabase db reset` does both).
3. In Supabase Auth settings, add `http://localhost:3000/auth/callback` to the
   redirect URLs and enable TOTP MFA.
4. `npm run dev` and sign up. Promote your first admin in SQL:
   `update profiles set role = 'admin' where email = 'you@example.org';`
5. Schedule `GET /api/cron/daily` hourly with `Authorization: Bearer $CRON_SECRET`
   (already configured in `vercel.json` for Vercel Cron). It expires pledges and
   sends pledge reminders.

Scripts: `npm run dev | build | lint | typecheck | test`.
`node scripts/generate-reference-seed.mjs` regenerates countries, currencies and
starting exchange rates.

## How it's built

| Phase | What | Where |
|---|---|---|
| 1 | Auth, roles, countries, currencies, GDPR consent | `0001_*.sql`, `src/actions/auth.ts`, `src/app/(auth)` |
| 2 | Universities, student profiles, documents, verification | `0002_*.sql`, `src/app/student`, `src/app/admin/students`, `src/app/admin/universities` |
| 3 | Grants, direct-payment pledges, proof verification | `0003_*.sql`, `src/actions/donations.ts`, `src/app/donate`, `src/app/donor/pledges`, `src/app/admin/proofs` |
| 4 | Platform payments with a mock provider, disbursement | `0004_*.sql`, `src/lib/payments`, `src/app/admin/disbursements` |
| 5 | Results review, admin panel, stats, audit log | `0005_*.sql`, `src/lib/stats.ts`, `src/app/admin` |
| 6 | Messaging, moderation, notifications | `0006_*.sql`, `src/actions/messages.ts`, `src/lib/notifications.ts` |

### Key decisions

- **Overfunding is impossible by construction.** `reserve_donation()` (SQL) locks
  the grant row, recomputes confirmed + pending, and rejects anything above the
  remaining amount plus the configurable tolerance (`overfund_tolerance_pct`).
  Both payment methods reserve through it. Live direct pledges hold their amount
  until they expire (`pledge_hold_days`, default 14) unless proof has been uploaded.
- **Grant status** (`open → funded → paid`) is driven by `refresh_grant_status()`
  from confirmed money only. Admins can adjust a direct payment's confirmed amount
  to what the university actually received; a grant counts as funded once
  confirmed money is within the tolerance of the target.
- **Every donation stores** its original amount and currency, the exchange rate to
  the grant's currency, the reserved and confirmed grant-currency amounts, and the
  USD rate at the time. Admin reports use that frozen USD rate, so historical
  totals don't drift with FX.
- **Swappable interfaces**: `PaymentProvider` (`src/lib/payments`, mock provider
  with test cards and multi-currency support), `ExchangeRateProvider`
  (`src/lib/fx`, `manual` or the keyless `open-er-api` feed; the app always prices
  from the stored table), and `EmailProvider` (`src/lib/email`, `console` or `resend`).
- **Authorization**: every page and server action checks the role server-side
  (`requireRole`); privileged writes then use the service-role client. RLS is
  enabled on every table as defence in depth for anything reachable with the
  public anon key, and triggers stop users changing their own role, suspension
  or verification status.
- **Private files** (IDs, enrollment letters, invoices, transcripts, payment
  proofs, receipts) sit in a private bucket and are served only via
  `/api/files/[id]`, which checks access and redirects to a 60-second signed URL.
  Students' identity documents: owner + admins only. A grant's invoice: also donors
  with a pledge on it (they need it to pay). University receipts: the student and
  that grant's donors.
- **Anonymous donors** are masked server-side (`getStudentOverview`) and are never
  named to students, including in messaging.
- **Audit log** (`audit_logs`, immutable by trigger) records every admin action on
  money and approvals, plus CSV exports and conversation views.
- **i18n**: all UI and email text lives in `src/i18n/messages/en.ts`; keys are
  type-checked. To add a language, add a file typed as `Messages` and register it
  in `src/i18n/index.ts` and `config.ts`. Dates render in the user's time zone
  (profile setting, falling back to the browser's).
- **Privacy**: consent is recorded at sign-up (with policy version); Settings
  offers JSON data export and account deletion, which removes personal data and
  identity documents while keeping anonymised financial records.
- **Messaging** opens only after a confirmed donation. Emails, phone numbers,
  IBANs, card numbers and bank wording are blocked; off-platform payment talk is
  delivered but flagged for admins. Users can report and block; admins can view
  conversations and hide messages.

### Testing

- `npm test` — unit tests for moderation, FX math, the mock payment provider,
  CSV escaping, translations and time-zone formatting.
- `tests/e2e/flow.mjs` — a browser walkthrough of the entire lifecycle
  across student, two donors and an admin (see `tests/e2e/README.md`).

### Before production

- Replace the mock provider with a real gateway that tokenizes cards in the
  browser (the interface already accepts `{ type: "token" }`); the mock form
  posts card numbers to the server and is for testing only.
- Have the placeholder privacy policy and terms (`src/app/privacy`, `src/app/terms`)
  written or reviewed by counsel.
- The student listing and admin stats aggregate in the app server (fine for
  thousands of records); move them into SQL views/materialized views as volume grows.
- Messages refresh by polling every 15 s; Supabase Realtime could replace it.
