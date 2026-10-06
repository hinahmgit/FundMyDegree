-- Phase 5: term results, student updates, admin audit log.
create type public.review_status as enum ('pending', 'approved', 'rejected');

create table public.term_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  grant_id uuid not null references public.grants (id),
  term_number integer not null,
  gpa numeric(5, 2),
  gpa_scale numeric(5, 2),
  transcript_document_id uuid references public.documents (id) on delete set null,
  summary text,
  status public.review_status not null default 'pending',
  review_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  next_grant_id uuid references public.grants (id),
  created_at timestamptz not null default now(),
  unique (grant_id)
);
create index term_results_status_idx on public.term_results (status);

-- Updates students share with their donors.
create table public.student_updates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  term_result_id uuid references public.term_results (id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index student_updates_student_idx on public.student_updates (student_id, created_at desc);

-- Append-only record of every admin action touching money or approvals.
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function public.audit_logs_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit log entries cannot be modified';
end;
$$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

alter table public.term_results enable row level security;
alter table public.student_updates enable row level security;
alter table public.audit_logs enable row level security;

create policy "own results" on public.term_results for select
  using (student_id = auth.uid() or public.is_admin());
create policy "updates visible to student, their donors and admins" on public.student_updates for select
  using (
    student_id = auth.uid() or public.is_admin()
    or exists (
      select 1 from public.donations d
      where d.student_id = student_updates.student_id and d.donor_id = auth.uid()
        and d.status in ('confirmed', 'disbursed')
    )
  );
create policy "admins read audit log" on public.audit_logs for select using (public.is_admin());
