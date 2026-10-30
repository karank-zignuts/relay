-- Parent threads page and sort as one unit; their sub-tasks come with them.
-- One task as the list shows it: the row plus assignees, parent, and comment and attachment counts.
create or replace function public.task_row_json(p_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select (to_jsonb(t) - 'raw_slack') || jsonb_build_object(
    'raw_slack', null,
    'task_assignees', coalesce((select jsonb_agg(jsonb_build_object('user_id', a.user_id)) from public.task_assignees a where a.task_id = t.id), '[]'::jsonb),
    'parent', (select jsonb_build_object('id', pt.id, 'task_number', pt.task_number, 'title', pt.title) from public.tasks pt where pt.id = t.parent_task_id and pt.deleted_at is null),
    'task_comments', jsonb_build_array(jsonb_build_object('count', (select count(*) from public.task_comments c where c.task_id = t.id and c.deleted_at is null))),
    'task_attachments', jsonb_build_array(jsonb_build_object('count', (select count(*) from public.task_attachments x where x.task_id = t.id and x.deleted_at is null)))
  )
  from public.tasks t where t.id = p_id
$$;

drop function if exists public.list_tasks(text, public.task_status[], public.task_priority[], text[], text[], public.task_env[], public.task_change_area[], text[], text, text, timestamptz, timestamptz, boolean, text, text, integer, integer);

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
  p_offset     integer default 0,
  p_group      boolean default false
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
  tops as (
    -- Grouped lists page and sort the top level only: tasks without a parent, plus tasks whose parent is filtered out.
    select f.* from filtered f
    where not p_group or f.parent_task_id is null or not exists (select 1 from filtered x where x.id = f.parent_task_id)
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
    from tops f
  ),
  page as (
    select * from ordered where rn > p_offset order by rn limit greatest(p_limit, 1)
  )
  select jsonb_build_object(
    'total', (select count(*) from tops),
    'open_count', (select count(*) from public.tasks where deleted_at is null and status <> 'done'),
    'all_count', (select count(*) from public.tasks where deleted_at is null),
    'rows', coalesce((
      select jsonb_agg(
        public.task_row_json(p.id) || jsonb_build_object(
          'children', case when p_group then coalesce((
            select jsonb_agg(public.task_row_json(c.id) order by c.task_date, c.task_number)
            from filtered c where c.parent_task_id = p.id
          ), '[]'::jsonb) else '[]'::jsonb end
        )
        order by p.rn
      )
      from page p
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.list_tasks(text, public.task_status[], public.task_priority[], text[], text[], public.task_env[], public.task_change_area[], text[], text, text, timestamptz, timestamptz, boolean, text, text, integer, integer, boolean) to authenticated;
grant execute on function public.task_row_json(uuid) to authenticated;
