-- Data made by the automated tests (their accounts, tasks, comments, attachments, activity, keys) must never reach a real person.
-- Until now that was a client flag, which a stale bundle or a mis-set env var can switch off, and server-written activity was never flagged at all.
-- Now it is the database that decides: rows are flagged by triggers on every insert path, and restrictive RLS hides flagged rows from everyone
-- except the test accounts themselves (so the suite can still drive the screens).

create or replace function public.viewer_is_test()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_test from public.profiles where id = auth.uid()), false)
$$;
revoke all on function public.viewer_is_test() from public, anon;
grant execute on function public.viewer_is_test() to authenticated;

-- Profiles: any account made with a test address is a test account, whoever creates it.
create or replace function public.profile_flag_test()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_test := new.is_test
    or coalesce(new.email, '') like 'relay-e2e+%@example.com'
    or coalesce((select is_test from public.profiles where id = new.created_by), false);
  return new;
end;
$$;
drop trigger if exists profiles_flag_test on public.profiles;
create trigger profiles_flag_test before insert or update of email on public.profiles for each row execute function public.profile_flag_test();
update public.profiles set is_test = true where email like 'relay-e2e+%@example.com' and not is_test;

-- Tasks: made by a test account, in the test Slack channel, or titled like a test. Once flagged, always flagged.
alter table public.tasks add column if not exists is_test boolean not null default false;
create index if not exists tasks_is_test_idx on public.tasks (is_test) where is_test;

create or replace function public.task_flag_test()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_test := new.is_test
    or coalesce(new.slack_channel_id, '') = 'C0E2ETEST'
    or coalesce(new.title, '') like 'E2E %'
    or coalesce(new.title, '') like 'RLS task %'
    or coalesce((select is_test from public.profiles where id = new.created_by), false);
  return new;
end;
$$;
drop trigger if exists tasks_flag_test on public.tasks;
create trigger tasks_flag_test before insert or update on public.tasks for each row execute function public.task_flag_test();
update public.tasks set is_test = true where not is_test and (
  coalesce(slack_channel_id, '') = 'C0E2ETEST' or title like 'E2E %' or title like 'RLS task %'
  or coalesce((select is_test from public.profiles p where p.id = tasks.created_by), false)
);

-- Activity: flag on every insert path (server-side sign-ins and key changes insert directly, which is how they slipped through).
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
    or (p_entity_type = 'task' and exists (select 1 from public.tasks t where t.id = p_entity_id and t.is_test))
$$;
revoke all on function public.activity_is_test(uuid, text, text, uuid) from public, anon, authenticated;

create or replace function public.activity_flag_test()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_test := new.is_test
    or public.activity_is_test(new.actor_id, new.actor_label, new.entity_type, new.entity_id)
    or coalesce(new.summary, '') like '%relay-e2e+%@example.com%'
    or coalesce(new.summary, '') like '%e2e-%'
    or coalesce(new.summary, '') ~* 'E2E (super admin|project manager|developer|tester)';
  return new;
end;
$$;
drop trigger if exists activity_log_flag_test on public.activity_log;
create trigger activity_log_flag_test before insert on public.activity_log for each row execute function public.activity_flag_test();
update public.activity_log a set is_test = true
where not a.is_test and (
  public.activity_is_test(a.actor_id, a.actor_label, a.entity_type, a.entity_id)
  or a.summary like '%relay-e2e+%@example.com%'
  or a.summary like '%e2e-%'
  or a.summary ~* 'E2E (super admin|project manager|developer|tester)'
);

-- Rows that belong to test tasks or test people.
create or replace function public.task_or_user_is_test(p_task_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_test from public.tasks where id = p_task_id), false)
    or coalesce((select is_test from public.profiles where id = p_user_id), false)
$$;
revoke all on function public.task_or_user_is_test(uuid, uuid) from public, anon;
grant execute on function public.task_or_user_is_test(uuid, uuid) to authenticated;

-- Restrictive policies add to the existing ones: a row must pass both. Test accounts see everything, as before.
create policy activity_log_hide_test on public.activity_log as restrictive for select to authenticated
  using (not is_test or public.viewer_is_test());
create policy tasks_hide_test on public.tasks as restrictive for select to authenticated
  using (not is_test or public.viewer_is_test());
create policy profiles_hide_test on public.profiles as restrictive for select to authenticated
  using (not is_test or id = auth.uid() or public.viewer_is_test());
create policy task_comments_hide_test on public.task_comments as restrictive for select to authenticated
  using (public.viewer_is_test() or not public.task_or_user_is_test(task_id, author_id));
create policy task_attachments_hide_test on public.task_attachments as restrictive for select to authenticated
  using (public.viewer_is_test() or not public.task_or_user_is_test(task_id, uploaded_by));
create policy task_assignees_hide_test on public.task_assignees as restrictive for select to authenticated
  using (public.viewer_is_test() or not public.task_or_user_is_test(task_id, user_id));
create policy comment_reads_hide_test on public.comment_reads as restrictive for select to authenticated
  using (public.viewer_is_test() or not public.task_or_user_is_test(null, user_id));
create policy modules_hide_test on public.modules as restrictive for select to authenticated
  using (public.viewer_is_test() or name not like 'E2E%');
create policy sync_runs_hide_test on public.sync_runs as restrictive for select to authenticated
  using (public.viewer_is_test() or not (coalesce(actor_label, '') like 'Claude (e2e-%' or coalesce(actor_label, '') like 'E2E %'));
