-- Test accounts used by the Playwright suite stay in the database but are hidden from the app UI.
alter table public.profiles add column is_test boolean not null default false;
create index profiles_is_test_idx on public.profiles (is_test) where is_test;

update public.profiles set is_test = true where email like 'relay-e2e+%@example.com';

-- Clear test users from real (synced) tasks so nobody shows up as an assignee by mistake.
delete from public.task_assignees
 where user_id in (select id from public.profiles where is_test)
   and task_id in (select id from public.tasks where slack_channel_id is not null and slack_channel_id <> 'C0E2ETEST' and deleted_at is null);
