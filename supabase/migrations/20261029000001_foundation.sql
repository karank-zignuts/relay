-- Phase 1 foundation: roles, profiles, activity log, API keys, settings.
-- Tasks, comments and sync tables arrive in the Phase 2 and 3 migrations.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
create type public.user_role as enum ('super_admin', 'project_manager', 'developer', 'tester');

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
-- One row per auth user. Role lives here, never in user-editable metadata.
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  full_name      text not null default '',
  role           public.user_role not null default 'tester',
  slack_user_id  text,
  is_active      boolean not null default true,
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create unique index profiles_email_key on public.profiles (lower(email)) where deleted_at is null;
create unique index profiles_slack_user_id_key on public.profiles (slack_user_id)
  where slack_user_id is not null and deleted_at is null;
create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role lookups used by RLS. security definer avoids recursive policy checks.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and is_active and deleted_at is null
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'super_admin', false)
$$;

create or replace function public.is_admin_or_pm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('super_admin', 'project_manager'), false)
$$;

-- Create the profile when an invited user is created. Public sign-up is disabled,
-- so the role only ever comes from our server through the admin invite call.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_role public.user_role;
begin
  begin
    invited_role := (new.raw_user_meta_data ->> 'role')::public.user_role;
  exception when others then
    invited_role := null;
  end;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(invited_role, 'tester')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only our server (service_role) may change privileged profile fields.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and (
       new.role is distinct from old.role
    or new.email is distinct from old.email
    or new.is_active is distinct from old.is_active
    or new.deleted_at is distinct from old.deleted_at
    or new.slack_user_id is distinct from old.slack_user_id
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'Only the server may change role, email, status or Slack mapping'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- The last active Super Admin cannot be demoted, deactivated or deleted.
create or replace function public.protect_last_super_admin()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'super_admin' and old.is_active and old.deleted_at is null
     and (new.role <> 'super_admin' or not new.is_active or new.deleted_at is not null)
     and not exists (
       select 1 from public.profiles
       where role = 'super_admin' and is_active and deleted_at is null and id <> old.id
     )
  then
    raise exception 'The last Super Admin cannot be demoted, deactivated or deleted'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_last_super_admin
  before update on public.profiles
  for each row execute function public.protect_last_super_admin();

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (deleted_at is null and public.current_user_role() is not null);

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() and deleted_at is null)
  with check (id = auth.uid());

-- Inserts and deletes happen only through the server (service_role bypasses RLS).

-- ---------------------------------------------------------------- activity log
-- Append-only. Written by the server only.
create table public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles (id),
  actor_label  text not null,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  summary      text not null,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index activity_log_created_at_idx on public.activity_log (created_at desc);
create index activity_log_actor_id_idx on public.activity_log (actor_id);
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id);

create trigger activity_log_set_updated_at
  before update on public.activity_log
  for each row execute function public.set_updated_at();

alter table public.activity_log enable row level security;

create policy activity_log_select on public.activity_log
  for select to authenticated
  using (deleted_at is null and public.is_admin_or_pm());

-- ---------------------------------------------------------------- API keys (Claude)
-- Only the hash is stored. No policies: reachable only through the server.
create table public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  key_prefix  text not null,
  key_hash    text not null,
  created_by  uuid references public.profiles (id),
  last_used_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create unique index api_keys_key_hash_key on public.api_keys (key_hash) where deleted_at is null;

create trigger api_keys_set_updated_at
  before update on public.api_keys
  for each row execute function public.set_updated_at();

alter table public.api_keys enable row level security;

-- ---------------------------------------------------------------- app settings
-- Single row. Holds the forgotten-reply threshold and similar knobs.
create table public.app_settings (
  id                         boolean primary key default true check (id),
  forgotten_reply_hours      integer not null default 4 check (forgotten_reply_hours > 0),
  working_hours_start        time not null default '09:00',
  working_hours_end          time not null default '18:00',
  working_hours_timezone     text not null default 'Asia/Kolkata',
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  deleted_at                 timestamptz
);

insert into public.app_settings (id) values (true);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

create policy app_settings_select on public.app_settings
  for select to authenticated
  using (public.current_user_role() is not null);

create policy app_settings_update on public.app_settings
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
