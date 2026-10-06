-- Phase 2: universities, student profiles, documents and verification.
create type public.university_status as enum ('pending', 'approved', 'rejected');
create type public.degree_level as enum ('undergraduate', 'masters', 'phd');
create type public.verification_status as enum ('draft', 'pending', 'verified', 'rejected');
create type public.student_status as enum ('active', 'graduated', 'withdrawn');
create type public.document_type as enum (
  'government_id', 'enrollment_proof', 'tuition_invoice', 'transcript',
  'payment_proof', 'university_receipt', 'other'
);

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code char(2) not null references public.countries (code),
  city text,
  website text,
  accreditation_body text,
  accreditation_reference text,
  fee_currency char(3) not null references public.currencies (code),
  status public.university_status not null default 'pending',
  rejection_reason text,
  -- International payment details shown to donors paying the university directly.
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  iban text,
  swift_bic text,
  bank_address text,
  payment_portal_url text,
  payment_reference_instructions text,
  -- Finance office contact.
  finance_contact_name text,
  finance_contact_email text,
  finance_contact_phone text,
  requested_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index universities_name_country_uniq on public.universities (lower(name), country_code);
create index universities_status_idx on public.universities (status);
create trigger universities_touch before update on public.universities
  for each row execute function public.touch_updated_at();

create table public.student_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  university_id uuid references public.universities (id),
  student_number text,
  program_name text,
  field_of_study text,
  degree_level public.degree_level,
  term_kind text not null default 'semester' check (term_kind in ('semester', 'term', 'trimester', 'quarter', 'year')),
  current_term integer not null default 1 check (current_term >= 1),
  total_terms integer not null default 8 check (total_terms >= 1 and total_terms <= 20),
  expected_graduation date,
  story text,
  total_degree_cost numeric(14, 2) check (total_degree_cost >= 0),
  photo_path text,
  verification_status public.verification_status not null default 'draft',
  verification_note text,
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  status public.student_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint current_term_within_total check (current_term <= total_terms)
);
create index student_profiles_verification_idx on public.student_profiles (verification_status);
create index student_profiles_university_idx on public.student_profiles (university_id);
create trigger student_profiles_touch before update on public.student_profiles
  for each row execute function public.touch_updated_at();

-- Per-term fee breakdown, in the university's fee currency.
create table public.term_fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  term_number integer not null check (term_number >= 1),
  label text,
  amount numeric(14, 2) not null check (amount > 0),
  due_date date,
  unique (student_id, term_number)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  student_id uuid references public.student_profiles (user_id) on delete set null,
  type public.document_type not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes integer,
  created_at timestamptz not null default now()
);
create index documents_owner_idx on public.documents (owner_id);
create index documents_student_idx on public.documents (student_id, type);

-- Students cannot verify themselves.
create or replace function public.guard_student_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.verification_status is distinct from old.verification_status
       and not (old.verification_status in ('draft', 'rejected') and new.verification_status = 'pending') then
      raise exception 'not allowed to change verification status';
    end if;
    if new.verified_at is distinct from old.verified_at
       or new.verified_by is distinct from old.verified_by
       or new.status is distinct from old.status then
      raise exception 'not allowed to change verification fields';
    end if;
  end if;
  return new;
end;
$$;
create trigger student_profiles_guard before update on public.student_profiles
  for each row execute function public.guard_student_profile_update();

alter table public.universities enable row level security;
alter table public.student_profiles enable row level security;
alter table public.term_fees enable row level security;
alter table public.documents enable row level security;

create policy "approved universities are public" on public.universities for select
  using (status = 'approved' or requested_by = auth.uid() or public.is_admin());
create policy "students request universities" on public.universities for insert
  with check (status = 'pending' and requested_by = auth.uid());
create policy "admins manage universities" on public.universities for all
  using (public.is_admin()) with check (public.is_admin());

create policy "own student profile" on public.student_profiles for select
  using (user_id = auth.uid() or public.is_admin());
create policy "create own student profile" on public.student_profiles for insert
  with check (user_id = auth.uid() and verification_status = 'draft');
create policy "update own student profile" on public.student_profiles for update
  using (user_id = auth.uid() or public.is_admin());

create policy "own term fees" on public.term_fees for select
  using (student_id = auth.uid() or public.is_admin());
create policy "manage own term fees" on public.term_fees for all
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- Identity documents, invoices and payment proofs: owners and admins only.
create policy "own documents" on public.documents for select
  using (owner_id = auth.uid() or public.is_admin());

-- Storage. 'private-docs' has no client policies at all: the server streams
-- files through short-lived signed URLs after checking access in
-- src/lib/files.ts. 'avatars' is public-read.
insert into storage.buckets (id, name, public) values
  ('private-docs', 'private-docs', false),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;
