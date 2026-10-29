-- Phase 2 and 3: tasks, assignees, comments, sync runs, activity triggers, sync function.

-- ---------------------------------------------------------------- enums
create type public.task_status as enum ('backlog', 'to_do', 'in_progress', 'in_review', 'blocked', 'done');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_env as enum ('local', 'development', 'staging', 'production');
create type public.task_change_area as enum ('fe', 'be', 'db', 'devops', 'design', 'other');
create type public.sync_status as enum ('running', 'success', 'partial', 'failed');

-- ---------------------------------------------------------------- activity helper
-- Actor is the signed-in user, or the label the sync function sets for Claude.
create or replace function public.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_summary text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := nullif(current_setting('relay.actor', true), '');
begin
  if v_label is null then
    select coalesce(nullif(full_name, ''), email) into v_label from public.profiles where id = auth.uid();
  end if;

  insert into public.activity_log (actor_id, actor_label, action, entity_type, entity_id, summary, details)
  values (auth.uid(), coalesce(v_label, 'System'), p_action, p_entity_type, p_entity_id, p_summary, p_details);
end;
$$;

-- ---------------------------------------------------------------- tasks
create table public.tasks (
  id                       uuid primary key default gen_random_uuid(),
  task_number              bigint generated always as identity,
  title                    text not null check (length(trim(title)) > 0),
  description              text not null default '',
  task_date                timestamptz not null default now(),
  module                   text,
  status                   public.task_status not null default 'to_do',
  priority                 public.task_priority not null default 'medium',
  parent_task_id           uuid references public.tasks (id),
  tags                     text[] not null default '{}',
  environments             public.task_env[] not null default '{}',
  changes_in               public.task_change_area[] not null default '{}',
  slack_channel_id         text,
  slack_thread_ts          text,
  slack_url                text,
  last_client_message_at   timestamptz,
  last_team_reply_at       timestamptz,
  reply_dismissed_at       timestamptz,
  jira_key                 text,
  jira_url                 text,
  jira_status              text,
  human_edited_fields      text[] not null default '{}',
  raw_slack                jsonb,
  created_by               uuid references public.profiles (id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  check (parent_task_id is distinct from id)
);

create unique index tasks_slack_thread_ts_key on public.tasks (slack_thread_ts)
  where slack_thread_ts is not null and deleted_at is null;
create unique index tasks_task_number_key on public.tasks (task_number);
create index tasks_status_idx on public.tasks (status) where deleted_at is null;
create index tasks_priority_idx on public.tasks (priority) where deleted_at is null;
create index tasks_parent_task_id_idx on public.tasks (parent_task_id);
create index tasks_task_date_idx on public.tasks (task_date desc);
create index tasks_module_idx on public.tasks (module);
create index tasks_tags_idx on public.tasks using gin (tags);
create index tasks_environments_idx on public.tasks using gin (environments);
create index tasks_changes_in_idx on public.tasks using gin (changes_in);
create index tasks_awaiting_reply_idx on public.tasks (last_client_message_at)
  where deleted_at is null and last_client_message_at is not null;

-- ---------------------------------------------------------------- task assignees (technical join table: hard delete)
create table public.task_assignees (
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index task_assignees_user_id_idx on public.task_assignees (user_id);

-- ---------------------------------------------------------------- comments
create table public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id),
  author_id   uuid not null references public.profiles (id),
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index task_comments_task_id_idx on public.task_comments (task_id, created_at);
create index task_comments_author_id_idx on public.task_comments (author_id);

-- ---------------------------------------------------------------- sync runs
create table public.sync_runs (
  id               uuid primary key default gen_random_uuid(),
  status           public.sync_status not null default 'running',
  source           text not null default 'claude',
  actor_label      text not null,
  api_key_id       uuid references public.api_keys (id),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  created_count    integer not null default 0,
  updated_count    integer not null default 0,
  unchanged_count  integer not null default 0,
  failed_count     integer not null default 0,
  errors           jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index sync_runs_started_at_idx on public.sync_runs (started_at desc);
create index sync_runs_api_key_id_idx on public.sync_runs (api_key_id);

-- ---------------------------------------------------------------- updated_at triggers
create trigger tasks_c_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger task_comments_set_updated_at before update on public.task_comments
  for each row execute function public.set_updated_at();
create trigger sync_runs_set_updated_at before update on public.sync_runs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- task field guards
-- Runs first (a_ prefix). Server (service_role) is unrestricted.
create or replace function public.tasks_a_protect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_old jsonb;
  v_new jsonb;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  v_role := public.current_user_role();
  v_old := to_jsonb(old) - 'updated_at' - 'human_edited_fields';
  v_new := to_jsonb(new) - 'updated_at' - 'human_edited_fields';

  if v_role in ('super_admin', 'project_manager') then
    -- Admins may change everything except Slack identity and the index number.
    if old.task_number is distinct from new.task_number or old.slack_thread_ts is distinct from new.slack_thread_ts then
      raise exception 'Task number and Slack thread cannot be changed' using errcode = '42501';
    end if;
  elsif v_role = 'developer' then
    if old.deleted_at is distinct from new.deleted_at
       or old.task_number is distinct from new.task_number
       or old.slack_thread_ts is distinct from new.slack_thread_ts
       or old.slack_channel_id is distinct from new.slack_channel_id
       or old.slack_url is distinct from new.slack_url
       or old.raw_slack is distinct from new.raw_slack then
      raise exception 'Developers cannot change deletion or Slack fields' using errcode = '42501';
    end if;
  elsif v_role = 'tester' then
    if (v_old - 'status') is distinct from (v_new - 'status') then
      raise exception 'Testers can only change task status' using errcode = '42501';
    end if;
  else
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger tasks_a_protect before update on public.tasks
  for each row execute function public.tasks_a_protect();

-- Records which fields a person edited so a later sync never overwrites them.
create or replace function public.tasks_b_track_human_edits()
returns trigger
language plpgsql
as $$
declare
  v_field text;
  v_fields text[] := array['title', 'description', 'module', 'status', 'priority', 'tags',
                           'environments', 'changes_in', 'jira_key', 'jira_url', 'jira_status', 'parent_task_id'];
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  foreach v_field in array v_fields loop
    if v_old -> v_field is distinct from v_new -> v_field and not (v_field = any (new.human_edited_fields)) then
      new.human_edited_fields := array_append(new.human_edited_fields, v_field);
    end if;
  end loop;
  return new;
end;
$$;

create trigger tasks_b_track before update on public.tasks
  for each row execute function public.tasks_b_track_human_edits();

-- ---------------------------------------------------------------- activity triggers
create or replace function public.tasks_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed text[];
  v_key text;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('task.created', 'task', new.id, 'Created task #' || new.task_number || ' ' || new.title);
    return new;
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);

  if old.deleted_at is null and new.deleted_at is not null then
    perform public.log_activity('task.deleted', 'task', new.id, 'Deleted task #' || new.task_number || ' ' || new.title);
    return new;
  end if;

  v_changed := '{}';
  for v_key in select jsonb_object_keys(v_new) loop
    if v_key in ('updated_at', 'human_edited_fields', 'raw_slack') then
      continue;
    end if;
    if v_old -> v_key is distinct from v_new -> v_key then
      v_changed := array_append(v_changed, v_key);
    end if;
  end loop;

  if array_length(v_changed, 1) is null then
    return new;
  end if;

  perform public.log_activity(
    case when v_changed = array['status'] then 'task.status_changed' else 'task.updated' end,
    'task', new.id,
    case when v_changed = array['status']
      then 'Moved task #' || new.task_number || ' from ' || old.status || ' to ' || new.status
      else 'Updated task #' || new.task_number || ' (' || array_to_string(v_changed, ', ') || ')'
    end,
    jsonb_build_object('fields', v_changed)
  );
  return new;
end;
$$;

create trigger tasks_log_activity after insert or update on public.tasks
  for each row execute function public.tasks_log_activity();

create or replace function public.comments_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_activity('comment.created', 'task', new.task_id, 'Commented on a task', jsonb_build_object('comment_id', new.id));
  return new;
end;
$$;

create trigger task_comments_log_activity after insert on public.task_comments
  for each row execute function public.comments_log_activity();

create or replace function public.assignees_track_and_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid := coalesce(new.task_id, old.task_id);
  v_user_id uuid := coalesce(new.user_id, old.user_id);
  v_name text;
begin
  select coalesce(nullif(full_name, ''), email) into v_name from public.profiles where id = v_user_id;

  if coalesce(auth.role(), '') <> 'service_role' then
    update public.tasks
      set human_edited_fields = array_append(human_edited_fields, 'assignees')
      where id = v_task_id and not ('assignees' = any (human_edited_fields));
  end if;

  perform public.log_activity(
    case when tg_op = 'INSERT' then 'task.assignee_added' else 'task.assignee_removed' end,
    'task', v_task_id,
    case when tg_op = 'INSERT' then 'Assigned ' else 'Unassigned ' end || coalesce(v_name, 'a user')
  );
  return coalesce(new, old);
end;
$$;

create trigger task_assignees_track after insert or delete on public.task_assignees
  for each row execute function public.assignees_track_and_log();

-- ---------------------------------------------------------------- RLS
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_comments enable row level security;
alter table public.sync_runs enable row level security;

create or replace function public.is_assigned(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.task_assignees where task_id = p_task_id and user_id = auth.uid())
$$;

create policy tasks_select on public.tasks
  for select to authenticated
  using (deleted_at is null and public.current_user_role() is not null);

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (public.is_admin_or_pm());

-- Deletion goes through delete_task() so the SELECT policy does not block the soft delete.
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    deleted_at is null and (
      public.is_admin_or_pm()
      or public.current_user_role() = 'tester'
      or (public.current_user_role() = 'developer' and public.is_assigned(id))
    )
  )
  with check (deleted_at is null);

create policy task_assignees_select on public.task_assignees
  for select to authenticated
  using (public.current_user_role() is not null);

create policy task_assignees_insert on public.task_assignees
  for insert to authenticated
  with check (public.is_admin_or_pm());

create policy task_assignees_delete on public.task_assignees
  for delete to authenticated
  using (public.is_admin_or_pm());

create policy task_comments_select on public.task_comments
  for select to authenticated
  using (deleted_at is null and public.current_user_role() is not null);

create policy task_comments_insert on public.task_comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.current_user_role() is not null);

create policy sync_runs_select on public.sync_runs
  for select to authenticated
  using (deleted_at is null and public.current_user_role() is not null);

-- ---------------------------------------------------------------- soft delete functions
create or replace function public.delete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_pm() then
    raise exception 'Only Super Admin or Project Manager can delete tasks' using errcode = '42501';
  end if;

  update public.tasks set deleted_at = now()
    where (id = p_task_id or parent_task_id = p_task_id) and deleted_at is null;
end;
$$;

create or replace function public.delete_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.task_comments set deleted_at = now()
    where id = p_comment_id and deleted_at is null
      and (author_id = auth.uid() or public.is_admin_or_pm());
  if not found then
    raise exception 'Comment not found or not allowed' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.dismiss_reply(p_task_id uuid, p_dismissed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.tasks
    set reply_dismissed_at = case when p_dismissed then now() else null end
    where id = p_task_id and deleted_at is null;
end;
$$;

revoke all on function public.delete_task(uuid), public.delete_comment(uuid), public.dismiss_reply(uuid, boolean) from public, anon;
grant execute on function public.delete_task(uuid), public.delete_comment(uuid), public.dismiss_reply(uuid, boolean) to authenticated;
revoke all on function public.log_activity(text, text, uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- sync function (one transaction per item)
-- Called only by our server with the service role. Idempotent by slack_thread_ts.
-- Claude owns Slack-derived fields. Fields a person edited (human_edited_fields) are never overwritten,
-- and status, priority, environments and changes_in are only set when the task is first created.
create or replace function public.sync_threads(p_items jsonb, p_actor text, p_api_key_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_item jsonb;
  v_existing public.tasks;
  v_task_id uuid;
  v_parent_id uuid;
  v_slack_id text;
  v_user_id uuid;
  v_created int := 0;
  v_updated int := 0;
  v_unchanged int := 0;
  v_failed int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_status public.sync_status;
  v_new_title text;
  v_new_desc text;
  v_new_module text;
  v_new_jira_key text;
  v_new_jira_url text;
  v_new_jira_status text;
  v_changed boolean;
  v_assignee_added boolean;
begin
  perform set_config('relay.actor', 'Claude (' || p_actor || ')', true);

  insert into public.sync_runs (actor_label, api_key_id) values (p_actor, p_api_key_id) returning id into v_run_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      select * into v_existing from public.tasks
        where slack_thread_ts = v_item ->> 'thread_ts' and deleted_at is null;

      v_parent_id := null;
      if v_item ->> 'parent_thread_ts' is not null then
        select id into v_parent_id from public.tasks
          where slack_thread_ts = v_item ->> 'parent_thread_ts' and deleted_at is null;
      end if;

      if v_existing.id is null then
        insert into public.tasks (
          title, description, task_date, module, status, priority, parent_task_id, tags, environments, changes_in,
          slack_channel_id, slack_thread_ts, slack_url, last_client_message_at, last_team_reply_at,
          jira_key, jira_url, jira_status, raw_slack
        ) values (
          v_item ->> 'title',
          coalesce(v_item ->> 'description', ''),
          coalesce((v_item ->> 'task_date')::timestamptz, now()),
          v_item ->> 'module',
          coalesce((v_item ->> 'status')::public.task_status, 'to_do'),
          coalesce((v_item ->> 'priority')::public.task_priority, 'medium'),
          v_parent_id,
          coalesce(array(select jsonb_array_elements_text(v_item -> 'tags')), '{}'),
          coalesce(array(select jsonb_array_elements_text(v_item -> 'environments'))::public.task_env[], '{}'),
          coalesce(array(select jsonb_array_elements_text(v_item -> 'changes_in'))::public.task_change_area[], '{}'),
          v_item ->> 'channel_id',
          v_item ->> 'thread_ts',
          v_item ->> 'slack_url',
          (v_item ->> 'last_client_message_at')::timestamptz,
          (v_item ->> 'last_team_reply_at')::timestamptz,
          v_item ->> 'jira_key',
          v_item ->> 'jira_url',
          v_item ->> 'jira_status',
          v_item -> 'raw'
        ) returning id into v_task_id;

        for v_slack_id in select jsonb_array_elements_text(coalesce(v_item -> 'assignee_slack_ids', '[]'::jsonb)) loop
          select id into v_user_id from public.profiles
            where slack_user_id = v_slack_id and is_active and deleted_at is null;
          if v_user_id is not null then
            insert into public.task_assignees (task_id, user_id) values (v_task_id, v_user_id) on conflict do nothing;
          end if;
        end loop;

        v_created := v_created + 1;
      else
        v_new_title := case when 'title' = any (v_existing.human_edited_fields) then v_existing.title
                            else coalesce(v_item ->> 'title', v_existing.title) end;
        v_new_desc := case when 'description' = any (v_existing.human_edited_fields) then v_existing.description
                           else coalesce(v_item ->> 'description', v_existing.description) end;
        v_new_module := case when 'module' = any (v_existing.human_edited_fields) or v_existing.module is not null
                             then v_existing.module else v_item ->> 'module' end;
        if 'jira_key' = any (v_existing.human_edited_fields) then
          v_new_jira_key := v_existing.jira_key; v_new_jira_url := v_existing.jira_url;
        else
          v_new_jira_key := coalesce(v_item ->> 'jira_key', v_existing.jira_key);
          v_new_jira_url := coalesce(v_item ->> 'jira_url', v_existing.jira_url);
        end if;
        v_new_jira_status := case when 'jira_status' = any (v_existing.human_edited_fields) then v_existing.jira_status
                                  else coalesce(v_item ->> 'jira_status', v_existing.jira_status) end;

        v_changed :=
             v_new_title is distinct from v_existing.title
          or v_new_desc is distinct from v_existing.description
          or v_new_module is distinct from v_existing.module
          or v_new_jira_key is distinct from v_existing.jira_key
          or v_new_jira_url is distinct from v_existing.jira_url
          or v_new_jira_status is distinct from v_existing.jira_status
          or coalesce(v_item ->> 'slack_url', v_existing.slack_url) is distinct from v_existing.slack_url
          or coalesce((v_item ->> 'last_client_message_at')::timestamptz, v_existing.last_client_message_at)
               is distinct from v_existing.last_client_message_at
          or coalesce((v_item ->> 'last_team_reply_at')::timestamptz, v_existing.last_team_reply_at)
               is distinct from v_existing.last_team_reply_at;

        if v_changed then
          update public.tasks set
            title = v_new_title,
            description = v_new_desc,
            module = v_new_module,
            jira_key = v_new_jira_key,
            jira_url = v_new_jira_url,
            jira_status = v_new_jira_status,
            slack_url = coalesce(v_item ->> 'slack_url', slack_url),
            last_client_message_at = coalesce((v_item ->> 'last_client_message_at')::timestamptz, last_client_message_at),
            last_team_reply_at = coalesce((v_item ->> 'last_team_reply_at')::timestamptz, last_team_reply_at),
            -- A new client message after a dismissal brings the thread back into Needs attention.
            reply_dismissed_at = case
              when coalesce((v_item ->> 'last_client_message_at')::timestamptz, last_client_message_at)
                   > coalesce(reply_dismissed_at, '-infinity') then null
              else reply_dismissed_at end,
            raw_slack = coalesce(v_item -> 'raw', raw_slack)
          where id = v_existing.id;
        end if;

        v_assignee_added := false;
        if not ('assignees' = any (v_existing.human_edited_fields)) then
          for v_slack_id in select jsonb_array_elements_text(coalesce(v_item -> 'assignee_slack_ids', '[]'::jsonb)) loop
            select id into v_user_id from public.profiles
              where slack_user_id = v_slack_id and is_active and deleted_at is null;
            if v_user_id is not null and not exists (
              select 1 from public.task_assignees where task_id = v_existing.id and user_id = v_user_id
            ) then
              insert into public.task_assignees (task_id, user_id) values (v_existing.id, v_user_id);
              v_assignee_added := true;
            end if;
          end loop;
        end if;

        if v_changed or v_assignee_added then
          v_updated := v_updated + 1;
        else
          v_unchanged := v_unchanged + 1;
        end if;
      end if;
    exception when others then
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object('thread_ts', v_item ->> 'thread_ts', 'message', sqlerrm);
    end;
  end loop;

  v_status := case
    when v_failed = 0 then 'success'
    when v_created + v_updated + v_unchanged = 0 then 'failed'
    else 'partial' end;

  update public.sync_runs set
    status = v_status, finished_at = now(),
    created_count = v_created, updated_count = v_updated, unchanged_count = v_unchanged,
    failed_count = v_failed, errors = v_errors
  where id = v_run_id;

  perform public.log_activity('sync.completed', 'sync_run', v_run_id,
    'Sync ' || v_status || ': ' || v_created || ' new, ' || v_updated || ' updated, ' || v_failed || ' failed');

  return jsonb_build_object('run_id', v_run_id, 'status', v_status, 'created', v_created,
    'updated', v_updated, 'unchanged', v_unchanged, 'failed', v_failed, 'errors', v_errors);
end;
$$;

revoke all on function public.sync_threads(jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.sync_threads(jsonb, text, uuid) to service_role;

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.tasks, public.task_comments, public.task_assignees, public.sync_runs;
