-- Phase 3: grants, donations (direct-payment pledges) and proof verification.
create type public.grant_status as enum ('pending_approval', 'open', 'funded', 'paid', 'rejected', 'cancelled');
create type public.donation_method as enum ('platform', 'direct');
create type public.donation_status as enum ('pending', 'confirmed', 'rejected', 'expired', 'disbursed', 'refunded');

-- One grant per student term. Amounts are in the university's fee currency.
create table public.grants (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  university_id uuid not null references public.universities (id),
  term_number integer not null check (term_number >= 1),
  term_label text,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  currency char(3) not null references public.currencies (code),
  invoice_number text,
  invoice_document_id uuid references public.documents (id) on delete set null,
  payment_deadline date,
  status public.grant_status not null default 'open',
  decision_reason text,
  opened_at timestamptz,
  funded_at timestamptz,
  paid_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, term_number)
);
create index grants_status_idx on public.grants (status);
create trigger grants_touch before update on public.grants
  for each row execute function public.touch_updated_at();

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid references public.profiles (id) on delete set null,
  student_id uuid not null references public.student_profiles (user_id),
  grant_id uuid not null references public.grants (id),
  method public.donation_method not null,
  status public.donation_status not null default 'pending',
  anonymous boolean not null default false,
  -- What the donor entered or paid, exactly as given.
  original_amount numeric(14, 2) not null check (original_amount > 0),
  original_currency char(3) not null references public.currencies (code),
  -- Grant-currency units per one original-currency unit, frozen at donation time.
  exchange_rate numeric(24, 10) not null check (exchange_rate > 0),
  -- Amount reserved on the grant, in the grant's currency.
  grant_amount numeric(14, 2) not null check (grant_amount > 0),
  -- What the university actually received (admin-adjustable), in the grant currency.
  confirmed_amount numeric(14, 2) check (confirmed_amount >= 0),
  -- USD per grant-currency unit at donation time, for reporting.
  usd_rate numeric(24, 10) not null check (usd_rate > 0),
  -- Direct payments: reservation window and proof of payment.
  pledge_expires_at timestamptz,
  reminder_sent_at timestamptz,
  proof_document_id uuid references public.documents (id) on delete set null,
  proof_reference text,
  proof_date date,
  proof_amount numeric(14, 2),
  proof_currency char(3) references public.currencies (code),
  proof_submitted_at timestamptz,
  -- Platform payments.
  provider text,
  provider_payment_id text,
  failure_reason text,
  -- Review / lifecycle.
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  admin_note text,
  reassigned_from_grant_id uuid references public.grants (id),
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint direct_has_expiry check (method <> 'direct' or pledge_expires_at is not null)
);
create index donations_grant_idx on public.donations (grant_id, status);
create index donations_donor_idx on public.donations (donor_id, created_at desc);
create index donations_student_idx on public.donations (student_id);
create index donations_status_idx on public.donations (status, method);
create trigger donations_touch before update on public.donations
  for each row execute function public.touch_updated_at();

-- A donation "holds" part of a grant while it can still become confirmed:
-- platform payments in flight, and direct pledges that are inside their
-- window or have proof awaiting review.
create or replace function public.donation_is_holding(d public.donations) returns boolean
language sql stable as $$
  select d.status = 'pending'
     and (d.method = 'platform' or d.proof_submitted_at is not null or d.pledge_expires_at > now());
$$;

create or replace view public.grant_progress
with (security_invoker = true) as
select
  g.id as grant_id,
  g.target_amount,
  g.currency,
  coalesce(sum(coalesce(d.confirmed_amount, d.grant_amount)) filter (where d.status in ('confirmed', 'disbursed')), 0)::numeric(14, 2) as confirmed_amount,
  coalesce(sum(d.grant_amount) filter (where public.donation_is_holding(d)), 0)::numeric(14, 2) as pending_amount
from public.grants g
left join public.donations d on d.grant_id = g.id
group by g.id;

-- Atomically reserve part of a grant. Locks the grant row so concurrent
-- donors can never overfund it beyond the configured tolerance.
create or replace function public.reserve_donation(
  p_grant_id uuid,
  p_donor_id uuid,
  p_method public.donation_method,
  p_original_amount numeric,
  p_original_currency char(3),
  p_exchange_rate numeric,
  p_grant_amount numeric,
  p_usd_rate numeric,
  p_anonymous boolean,
  p_provider text default null
) returns public.donations
language plpgsql security definer set search_path = public as $$
declare
  g public.grants;
  v_confirmed numeric;
  v_pending numeric;
  v_remaining numeric;
  v_tolerance numeric := public.setting_numeric('overfund_tolerance_pct', 2);
  v_hold_days numeric := public.setting_numeric('pledge_hold_days', 14);
  v_row public.donations;
begin
  select * into g from public.grants where id = p_grant_id for update;
  if not found then raise exception 'grant_not_found'; end if;
  if g.status <> 'open' then raise exception 'grant_not_open'; end if;
  if p_grant_amount <= 0 then raise exception 'invalid_amount'; end if;

  select confirmed_amount, pending_amount into v_confirmed, v_pending
    from public.grant_progress where grant_id = p_grant_id;
  v_remaining := g.target_amount - v_confirmed - v_pending;
  if v_remaining <= 0 or p_grant_amount > round(v_remaining * (1 + v_tolerance / 100), 2) then
    raise exception 'exceeds_remaining:%', greatest(v_remaining, 0);
  end if;

  insert into public.donations (
    donor_id, student_id, grant_id, method, status, anonymous,
    original_amount, original_currency, exchange_rate, grant_amount, usd_rate,
    pledge_expires_at, provider
  ) values (
    p_donor_id, g.student_id, g.id, p_method, 'pending', p_anonymous,
    p_original_amount, p_original_currency, p_exchange_rate, p_grant_amount, p_usd_rate,
    case when p_method = 'direct' then now() + make_interval(days => v_hold_days::int) end,
    p_provider
  ) returning * into v_row;
  return v_row;
end;
$$;

-- Move a grant between open and funded based on confirmed money. Returns the
-- new status. Grants already paid, rejected or cancelled are left alone.
create or replace function public.refresh_grant_status(p_grant_id uuid) returns public.grant_status
language plpgsql security definer set search_path = public as $$
declare
  g public.grants;
  v_confirmed numeric;
  v_tolerance numeric := public.setting_numeric('overfund_tolerance_pct', 2);
begin
  select * into g from public.grants where id = p_grant_id for update;
  if not found then raise exception 'grant_not_found'; end if;
  select confirmed_amount into v_confirmed from public.grant_progress where grant_id = p_grant_id;

  if g.status = 'open' and v_confirmed >= g.target_amount * (1 - v_tolerance / 100) then
    update public.grants set status = 'funded', funded_at = now() where id = p_grant_id;
    return 'funded';
  elsif g.status = 'funded' and v_confirmed < g.target_amount * (1 - v_tolerance / 100) then
    update public.grants set status = 'open', funded_at = null where id = p_grant_id;
    return 'open';
  end if;
  return g.status;
end;
$$;

-- Release direct pledges whose window passed without proof.
create or replace function public.expire_pledges()
returns table (donation_id uuid, donor_id uuid, grant_id uuid)
language sql security definer set search_path = public as $$
  update public.donations d
     set status = 'expired'
   where d.method = 'direct'
     and d.status = 'pending'
     and d.proof_submitted_at is null
     and d.pledge_expires_at <= now()
  returning d.id, d.donor_id, d.grant_id;
$$;

alter table public.grants enable row level security;
alter table public.donations enable row level security;

create policy "grants visible to owner, admins, and for verified students" on public.grants for select
  using (
    student_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.student_profiles s where s.user_id = grants.student_id and s.verification_status = 'verified')
  );
create policy "admins manage grants" on public.grants for all
  using (public.is_admin()) with check (public.is_admin());

-- Students see their donations through the server, which masks anonymous donors.
create policy "donations visible to donor and admins" on public.donations for select
  using (donor_id = auth.uid() or public.is_admin());

revoke execute on function public.reserve_donation from public, anon, authenticated;
revoke execute on function public.refresh_grant_status from public, anon, authenticated;
revoke execute on function public.expire_pledges from public, anon, authenticated;
grant execute on function public.reserve_donation to service_role;
grant execute on function public.refresh_grant_status to service_role;
grant execute on function public.expire_pledges to service_role;
