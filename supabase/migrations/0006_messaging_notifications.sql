-- Phase 6: donor–student messaging, moderation and notifications.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (donor_id, student_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'result', 'update')),
  body text not null check (char_length(body) between 1 and 4000),
  ref_id uuid,
  flagged boolean not null default false,
  flag_reasons text[] not null default '{}',
  hidden boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_flagged_idx on public.messages (flagged) where flagged;

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution_note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index message_reports_status_idx on public.message_reports (status);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  params jsonb not null default '{}'::jsonb,
  link text,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_reports enable row level security;
alter table public.user_blocks enable row level security;
alter table public.notifications enable row level security;

create policy "participants see conversations" on public.conversations for select
  using (donor_id = auth.uid() or student_id = auth.uid() or public.is_admin());
create policy "participants see messages" on public.messages for select
  using (
    public.is_admin() or exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and (c.donor_id = auth.uid() or c.student_id = auth.uid())
    )
  );
create policy "own reports" on public.message_reports for select
  using (reporter_id = auth.uid() or public.is_admin());
create policy "own blocks" on public.user_blocks for select using (blocker_id = auth.uid() or public.is_admin());
create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications for update using (user_id = auth.uid());
