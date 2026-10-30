-- Task numbers start at 1 and stay gapless; modules become a table; attachments; comment edits and read receipts;
-- a paginated, filtered, sorted list function; realtime for every table the UI shows.

-- ---------------------------------------------------------------- 1. task numbering (1, 2, 3 … among live tasks)
alter table public.tasks disable trigger user;

alter table public.tasks alter column task_number drop identity if exists;
alter table public.tasks alter column task_number set default 0;

drop index if exists public.tasks_task_number_key;

with ranked as (
  select id, row_number() over (order by task_number) as rn
  from public.tasks
  where deleted_at is null
)
update public.tasks t set task_number = ranked.rn from ranked where t.id = ranked.id;

create unique index tasks_task_number_key on public.tasks (task_number) where deleted_at is null;

alter table public.tasks enable trigger user;

create or replace function public.tasks_assign_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('relay.tasks.task_number'));
  select coalesce(max(task_number), 0) + 1 into new.task_number from public.tasks where deleted_at is null;
  return new;
end;
$$;

create trigger tasks_0_number before insert on public.tasks
  for each row execute function public.tasks_assign_number();

-- ---------------------------------------------------------------- 2. modules
create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create unique index modules_name_key on public.modules (lower(name)) where deleted_at is null;
create trigger modules_set_updated_at before update on public.modules
  for each row execute function public.set_updated_at();

alter table public.modules enable row level security;
create policy modules_select on public.modules
  for select to authenticated using (deleted_at is null and public.current_user_role() is not null);
create policy modules_insert on public.modules
  for insert to authenticated
  with check (public.current_user_role() in ('super_admin', 'project_manager', 'developer'));

insert into public.modules (name)
select distinct on (lower(trim(module))) trim(module)
from public.tasks
where module is not null and trim(module) <> '' and deleted_at is null
order by lower(trim(module)), trim(module);

-- Keeps module names canonical (same spelling as the first one used) and appends new ones to the list.
create or replace function public.tasks_sync_module()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(new.module), '');
  v_canonical text;
begin
  if v_name is null then
    new.module := null;
    return new;
  end if;
  select name into v_canonical from public.modules where lower(name) = lower(v_name) and deleted_at is null;
  if v_canonical is null then
    insert into public.modules (name, created_by) values (v_name, auth.uid());
    v_canonical := v_name;
  end if;
  new.module := v_canonical;
  return new;
end;
$$;

create trigger tasks_a_module before insert or update of module on public.tasks
  for each row execute function public.tasks_sync_module();

-- ---------------------------------------------------------------- 3. attachments
create type public.attachment_source as enum ('client', 'team');

create table public.task_attachments (
  id                  uuid primary key default gen_random_uuid(),
  task_id             uuid not null references public.tasks (id),
  source              public.attachment_source not null,
  file_name           text not null,
  mime_type           text,
  size_bytes          bigint,
  storage_path        text,
  external_url        text,
  uploaded_by         uuid references public.profiles (id),
  uploaded_by_label   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  check (storage_path is not null or external_url is not null)
);
create index task_attachments_task_id_idx on public.task_attachments (task_id, created_at);
create index task_attachments_uploaded_by_idx on public.task_attachments (uploaded_by);
create trigger task_attachments_set_updated_at before update on public.task_attachments
  for each row execute function public.set_updated_at();

alter table public.task_attachments enable row level security;
create policy task_attachments_select on public.task_attachments
  for select to authenticated using (deleted_at is null and public.current_user_role() is not null);
create policy task_attachments_insert on public.task_attachments
  for insert to authenticated
  with check (source = 'team' and uploaded_by = auth.uid() and public.current_user_role() is not null);

create or replace function public.attachments_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_activity('attachment.added', 'task', new.task_id, 'Attached ' || new.file_name || ' to a task');
  return new;
end;
$$;
create trigger task_attachments_log_activity after insert on public.task_attachments
  for each row execute function public.attachments_log_activity();

create or replace function public.delete_attachment(p_attachment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.task_attachments set deleted_at = now()
    where id = p_attachment_id and deleted_at is null
      and (uploaded_by = auth.uid() or public.is_admin_or_pm());
  if not found then
    raise exception 'Attachment not found or not allowed' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.delete_attachment(uuid) from public, anon;
grant execute on function public.delete_attachment(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', false, 26214400)
on conflict (id) do nothing;

create policy task_attachments_storage_select on storage.objects
  for select to authenticated using (bucket_id = 'task-attachments' and public.current_user_role() is not null);
create policy task_attachments_storage_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'task-attachments' and public.current_user_role() is not null);

-- ---------------------------------------------------------------- 4. comment edits and read receipts
alter table public.task_comments add column edited_at timestamptz;

create or replace function public.edit_comment(p_comment_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'A comment cannot be empty' using errcode = '22023';
  end if;
  update public.task_comments set body = trim(p_body), edited_at = now()
    where id = p_comment_id and deleted_at is null and author_id = auth.uid();
  if not found then
    raise exception 'You can only edit your own comments' using errcode = '42501';
  end if;
end;
$$;

create table public.comment_reads (
  comment_id  uuid not null references public.task_comments (id) on delete cascade,
  user_id     uuid not null references public.profiles (id),
  read_at     timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_reads_user_id_idx on public.comment_reads (user_id);

alter table public.comment_reads enable row level security;
create policy comment_reads_select on public.comment_reads
  for select to authenticated using (public.current_user_role() is not null);

create or replace function public.mark_comments_read(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.comment_reads (comment_id, user_id)
  select c.id, auth.uid() from public.task_comments c
  where c.task_id = p_task_id and c.deleted_at is null and c.author_id <> auth.uid()
  on conflict do nothing;
end;
$$;

revoke all on function public.edit_comment(uuid, text), public.mark_comments_read(uuid) from public, anon;
grant execute on function public.edit_comment(uuid, text), public.mark_comments_read(uuid) to authenticated;

-- ---------------------------------------------------------------- 5. paginated, filtered, sorted list
-- Runs as the caller, so RLS applies. Returns one page plus counts in a single round trip.
create or replace function public.list_tasks(
  p_search     text default '',
  p_status     public.task_status[] default '{}',
  p_priority   public.task_priority[] default '{}',
  p_assignees  text[] default '{}',
  p_modules    text[] default '{}',
  p_envs       public.task_env[] default '{}',
  p_areas      public.task_change_area[] default '{}',
  p_tags       text[] default '{}',
  p_jira       text default 'any',
  p_level      text default 'all',
  p_from       timestamptz default null,
  p_to         timestamptz default null,
  p_hide_done  boolean default false,
  p_sort       text default 'task_date',
  p_dir        text default 'desc',
  p_limit      integer default 50,
  p_offset     integer default 0
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_pattern text := '%' || replace(replace(replace(trim(coalesce(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_has_search boolean := trim(coalesce(p_search, '')) <> '';
  v_result jsonb;
begin
  with filtered as (
    select t.* from public.tasks t
    where t.deleted_at is null
      and (not v_has_search
           or t.title ilike v_pattern or t.description ilike v_pattern or coalesce(t.module, '') ilike v_pattern
           or coalesce(t.jira_key, '') ilike v_pattern or ('#' || t.task_number) ilike v_pattern
           or array_to_string(t.tags, ' ') ilike v_pattern)
      and (not p_hide_done or t.status <> 'done')
      and (cardinality(p_status) = 0 or t.status = any (p_status))
      and (cardinality(p_priority) = 0 or t.priority = any (p_priority))
      and (cardinality(p_modules) = 0 or t.module = any (p_modules))
      and (cardinality(p_envs) = 0 or t.environments && p_envs)
      and (cardinality(p_areas) = 0 or t.changes_in && p_areas)
      and (cardinality(p_tags) = 0 or t.tags && p_tags)
      and (cardinality(p_assignees) = 0
           or exists (select 1 from public.task_assignees a where a.task_id = t.id and a.user_id::text = any (p_assignees))
           or ('unassigned' = any (p_assignees) and not exists (select 1 from public.task_assignees a where a.task_id = t.id)))
      and (p_jira = 'any' or (p_jira = 'yes' and t.jira_key is not null) or (p_jira = 'no' and t.jira_key is null))
      and (p_level = 'all' or (p_level = 'parents' and t.parent_task_id is null) or (p_level = 'subtasks' and t.parent_task_id is not null))
      and (p_from is null or t.task_date >= p_from)
      and (p_to is null or t.task_date <= p_to)
  ),
  ordered as (
    select f.*, row_number() over (
      order by
        case when p_sort = 'task_number' and p_dir = 'asc' then f.task_number end asc,
        case when p_sort = 'task_number' and p_dir = 'desc' then f.task_number end desc,
        case when p_sort = 'title' and p_dir = 'asc' then lower(f.title) end asc,
        case when p_sort = 'title' and p_dir = 'desc' then lower(f.title) end desc,
        case when p_sort = 'task_date' and p_dir = 'asc' then f.task_date end asc,
        case when p_sort = 'task_date' and p_dir = 'desc' then f.task_date end desc,
        case when p_sort = 'module' and p_dir = 'asc' then lower(f.module) end asc nulls last,
        case when p_sort = 'module' and p_dir = 'desc' then lower(f.module) end desc nulls last,
        case when p_sort = 'status' and p_dir = 'asc' then f.status end asc,
        case when p_sort = 'status' and p_dir = 'desc' then f.status end desc,
        -- Priority reads "urgent first" when ascending, and the enum is declared low to urgent.
        case when p_sort = 'priority' and p_dir = 'asc' then f.priority end desc,
        case when p_sort = 'priority' and p_dir = 'desc' then f.priority end asc,
        f.task_number desc
    ) as rn
    from filtered f
  ),
  page as (
    select * from ordered where rn > p_offset order by rn limit greatest(p_limit, 1)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'open_count', (select count(*) from public.tasks where deleted_at is null and status <> 'done'),
    'all_count', (select count(*) from public.tasks where deleted_at is null),
    'rows', coalesce((
      select jsonb_agg(
        (to_jsonb(p) - 'rn' - 'raw_slack') || jsonb_build_object(
          'raw_slack', null,
          'task_assignees', coalesce((select jsonb_agg(jsonb_build_object('user_id', a.user_id)) from public.task_assignees a where a.task_id = p.id), '[]'::jsonb),
          'parent', (select jsonb_build_object('id', pt.id, 'task_number', pt.task_number, 'title', pt.title) from public.tasks pt where pt.id = p.parent_task_id and pt.deleted_at is null),
          'task_comments', jsonb_build_array(jsonb_build_object('count', (select count(*) from public.task_comments c where c.task_id = p.id and c.deleted_at is null))),
          'task_attachments', jsonb_build_array(jsonb_build_object('count', (select count(*) from public.task_attachments x where x.task_id = p.id and x.deleted_at is null)))
        )
        order by p.rn
      )
      from page p
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.list_tasks(text, public.task_status[], public.task_priority[], text[], text[], public.task_env[], public.task_change_area[], text[], text, text, timestamptz, timestamptz, boolean, text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------- 6. realtime for everything the UI shows
alter publication supabase_realtime add table
  public.modules, public.task_attachments, public.comment_reads,
  public.activity_log, public.profiles, public.api_keys, public.app_settings;
