-- Fix: the SQL editor and migrations (no JWT role) must count as privileged, like the service role.
-- Only signed-in app users ("authenticated") and anonymous callers are restricted by the guards.

create or replace function public.is_privileged_caller()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role(), '') not in ('authenticated', 'anon')
$$;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_privileged_caller() and (
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
  if public.is_privileged_caller() then
    return new;
  end if;

  v_role := public.current_user_role();
  v_old := to_jsonb(old) - 'updated_at' - 'human_edited_fields';
  v_new := to_jsonb(new) - 'updated_at' - 'human_edited_fields';

  if v_role in ('super_admin', 'project_manager') then
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
  if public.is_privileged_caller() then
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

  if not public.is_privileged_caller() then
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
