-- Phase 4: platform payments (via the PaymentProvider interface) and disbursement to universities.

-- Every call to a payment provider is recorded, successful or not.
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations (id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  amount numeric(14, 2) not null,
  currency char(3) not null,
  status text not null check (status in ('succeeded', 'failed', 'refunded')),
  failure_code text,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index payment_attempts_donation_idx on public.payment_attempts (donation_id);

-- Reusable provider tokens so returning donors can renew with one click.
create table public.saved_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  token text not null,
  brand text,
  last4 text,
  created_at timestamptz not null default now(),
  unique (user_id, provider, token)
);

-- A payment made to a university for a grant: platform-held funds sent by the
-- admin, and/or the university receipt confirming the term is paid.
create table public.disbursements (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.grants (id),
  platform_amount numeric(14, 2) not null default 0 check (platform_amount >= 0),
  currency char(3) not null references public.currencies (code),
  transfer_reference text,
  receipt_document_id uuid references public.documents (id) on delete set null,
  paid_on date not null default current_date,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index disbursements_grant_idx on public.disbursements (grant_id);

alter table public.donations
  add column disbursement_id uuid references public.disbursements (id);

alter table public.payment_attempts enable row level security;
alter table public.saved_payment_methods enable row level security;
alter table public.disbursements enable row level security;

create policy "admins read payment attempts" on public.payment_attempts for select using (public.is_admin());
create policy "own saved methods" on public.saved_payment_methods for select
  using (user_id = auth.uid() or public.is_admin());
create policy "disbursements visible to student and admins" on public.disbursements for select
  using (
    public.is_admin()
    or exists (select 1 from public.grants g where g.id = disbursements.grant_id and g.student_id = auth.uid())
    or exists (select 1 from public.donations d where d.grant_id = disbursements.grant_id and d.donor_id = auth.uid())
  );
