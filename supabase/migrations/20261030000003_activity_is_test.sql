-- Activity written by the automated test accounts, test API keys and test tasks is flagged so the feed can hide it.
alter table public.activity_log add column is_test boolean not null default false;

create or replace function public.activity_is_test(p_actor_id uuid, p_label text, p_entity_type text, p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_test from public.profiles where id = p_actor_id), false)
    or coalesce(p_label, '') like 'Claude (e2e-%'
    or coalesce(p_label, '') like 'E2E %'
    or (p_entity_type = 'task' and exists (
      select 1 from public.tasks t
      where t.id = p_entity_id and (t.slack_channel_id = 'C0E2ETEST' or t.title like 'E2E %' or t.title like 'RLS task %')
    ))
$$;
revoke all on function public.activity_is_test(uuid, text, text, uuid) from public, anon, authenticated;

update public.activity_log a set is_test = true
where public.activity_is_test(a.actor_id, a.actor_label, a.entity_type, a.entity_id);

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

  insert into public.activity_log (actor_id, actor_label, action, entity_type, entity_id, summary, details, is_test)
  values (auth.uid(), coalesce(v_label, 'System'), p_action, p_entity_type, p_entity_id, p_summary, p_details,
          public.activity_is_test(auth.uid(), v_label, p_entity_type, p_entity_id));
end;
$$;
