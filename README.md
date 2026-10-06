# FundMyDegree

A global platform connecting university students who need tuition funding with
donors who want to sponsor their degrees. **Money never goes to students** — it
goes to the university, either through the platform or paid directly by the donor.

Next.js 15 (App Router, TypeScript) · Tailwind CSS v4 · Supabase (Postgres, Auth, Storage).

## Run it locally

You need **Node.js 20+** and **Docker Desktop** (running). Docker is used by the
Supabase CLI to run the database, login service and file storage on your machine.

```bash
git clone https://github.com/hinahmgit/FundMyDegree.git
cd FundMyDegree
npm install

npm run db:start      # first run downloads the Supabase images (a few minutes)
npm run db:reset      # creates the tables + countries, currencies, rates, demo universities
npm run env:local     # writes .env.local with your local Supabase keys

npm run dev           # open http://localhost:3000
```

These commands work in PowerShell, Command Prompt or any terminal.

Then:

1. **Sign up** at http://localhost:3000/signup. Email confirmation is off locally,
   so you're logged straight in.
2. **Make yourself admin**: `npm run make-admin -- you@example.org`, then log out
   and back in. The Admin link appears in the header.
3. Try the whole flow with a few accounts (use separate browser profiles or a
   private window): a student completes their profile and uploads any PDF/image
   as documents → admin verifies them → a donor sponsors them.
4. **Test cards** (no real money ever moves): `4242 4242 4242 4242` succeeds,
   `4000 0000 0000 0002` is declined, `4000 0000 0000 9995` has insufficient funds.
   Any future expiry and any CVC.
5. **Emails** are printed in the terminal running `npm run dev` instead of being sent.
6. **Pledge expiry and reminders** run from a scheduled job; trigger it by hand
   with `npm run cron` (while `npm run dev` is running).

Handy extras: Supabase Studio (browse the database) is at http://localhost:54323.
`npm run db:stop` shuts the stack down; `npm run db:reset` wipes all data and
starts fresh. Other scripts: `npm run lint | typecheck | test | build`.

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

### If you deploy it later

- Schedule `GET /api/cron/daily` hourly with `Authorization: Bearer $CRON_SECRET`
  (`vercel.json` does this on Vercel) and point `.env` at a hosted Supabase project.
- Replace the mock provider with a real gateway that tokenizes cards in the
  browser (the interface already accepts `{ type: "token" }`); the mock form
  posts card numbers to the server and is for testing only.
- Have the placeholder privacy policy and terms (`src/app/privacy`, `src/app/terms`)
  written or reviewed by counsel.
- The student listing and admin stats aggregate in the app server (fine for
  thousands of records); move them into SQL views/materialized views as volume grows.
- Messages refresh by polling every 15 s; Supabase Realtime could replace it.
