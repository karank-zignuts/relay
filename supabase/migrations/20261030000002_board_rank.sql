-- Manual board order: a card keeps the place it was dropped in.
alter table public.tasks add column board_rank double precision;
update public.tasks set board_rank = -extract(epoch from task_date);
alter table public.tasks alter column board_rank set not null;
alter table public.tasks alter column board_rank set default -extract(epoch from now());
create index tasks_board_rank_idx on public.tasks (status, board_rank) where deleted_at is null;

-- board_rank is bookkeeping: it is not a field edit, not an activity entry, and any role that may move a card may change it.
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
  v_old := to_jsonb(old) - 'updated_at' - 'human_edited_fields' - 'board_rank';
  v_new := to_jsonb(new) - 'updated_at' - 'human_edited_fields' - 'board_rank';

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
    if v_key in ('updated_at', 'human_edited_fields', 'raw_slack', 'board_rank') then
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
        case when p_sort = 'board_rank' then f.board_rank end asc,
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
