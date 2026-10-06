-- Phase 1: auth, roles, countries, currencies, exchange rates, consent.
create extension if not exists pgcrypto;

create type public.user_role as enum ('student', 'donor', 'admin');

create table public.currencies (
  code char(3) primary key,
  name text not null,
  symbol text not null,
  decimals smallint not null default 2,
  active boolean not null default true
);

create table public.countries (
  code char(2) primary key,
  name text not null,
  default_currency char(3) references public.currencies (code)
);

-- Rates are stored as "units of currency per 1 USD" so any pair can be derived
-- through USD. The source column records which ExchangeRateProvider wrote them.
create table public.exchange_rates (
  currency_code char(3) primary key references public.currencies (code),
  units_per_usd numeric(20, 8) not null check (units_per_usd > 0),
  source text not null default 'manual',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'donor',
  full_name text not null default '',
  email text,
  country_code char(2) references public.countries (code),
  preferred_currency char(3) not null default 'USD' references public.currencies (code),
  timezone text not null default 'UTC',
  locale text not null default 'en',
  avatar_path text,
  suspended_at timestamptz,
  suspended_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_country_idx on public.profiles (country_code);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('terms', 'privacy', 'data_processing', 'marketing')),
  version text not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index consents_user_idx on public.consents (user_id);

-- Shared trigger to maintain updated_at.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'admin' and suspended_at is null from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.setting_numeric(p_key text, p_default numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from public.app_settings where key = p_key), p_default);
$$;

-- Create a profile (and record consent) whenever a Supabase auth user is created.
-- Only 'student' and 'donor' may be self-selected; admins are promoted manually.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role;
  v_country char(2);
  v_currency char(3);
  v_version text := coalesce(meta ->> 'consent_version', '1');
  v_kind text;
begin
  v_role := case when meta ->> 'role' = 'student' then 'student'::public.user_role else 'donor'::public.user_role end;
  select code into v_country from public.countries where code = upper(meta ->> 'country_code');
  select code into v_currency from public.currencies where code = upper(meta ->> 'preferred_currency');
  if v_currency is null then
    select default_currency into v_currency from public.countries where code = v_country;
  end if;

  insert into public.profiles (id, role, full_name, email, country_code, preferred_currency, timezone, locale)
  values (
    new.id,
    v_role,
    coalesce(meta ->> 'full_name', ''),
    new.email,
    v_country,
    coalesce(v_currency, 'USD'),
    coalesce(nullif(meta ->> 'timezone', ''), 'UTC'),
    coalesce(nullif(meta ->> 'locale', ''), 'en')
  );

  if jsonb_typeof(meta -> 'consents') = 'object' then
    for v_kind in select jsonb_object_keys(meta -> 'consents') loop
      if v_kind in ('terms', 'privacy', 'data_processing', 'marketing') then
        insert into public.consents (user_id, kind, version, granted)
        values (new.id, v_kind, v_version, coalesce((meta -> 'consents' ->> v_kind)::boolean, false));
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their own profile but never their role or suspension state.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.suspended_at is distinct from old.suspended_at
       or new.suspended_reason is distinct from old.suspended_reason then
      raise exception 'not allowed to change role or suspension';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Row level security. The app performs privileged writes server-side with the
-- service role after its own authorization checks; these policies are the
-- defence-in-depth layer for anything reachable with the public anon key.
alter table public.currencies enable row level security;
alter table public.countries enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.consents enable row level security;

create policy "reference data is public" on public.currencies for select using (true);
create policy "reference data is public" on public.countries for select using (true);
create policy "reference data is public" on public.exchange_rates for select using (true);
create policy "settings readable" on public.app_settings for select using (true);
create policy "admins manage currencies" on public.currencies for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage countries" on public.countries for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage rates" on public.exchange_rates for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage settings" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles for update using (id = auth.uid() or public.is_admin());

create policy "own consents" on public.consents for select using (user_id = auth.uid() or public.is_admin());
create policy "record own consent" on public.consents for insert with check (user_id = auth.uid());

insert into public.app_settings (key, value, description) values
  ('pledge_hold_days', '14', 'Days a direct-payment pledge reserves its amount before expiring'),
  ('pledge_reminder_days', '3', 'Days before pledge expiry to send a reminder email'),
  ('overfund_tolerance_pct', '2', 'Percent a donation may exceed the remaining amount to absorb exchange-rate differences'),
  ('reporting_currency', '"USD"', 'Currency used for admin reports'),
  ('consent_version', '"2026-01"', 'Current version of the terms and privacy policy');
