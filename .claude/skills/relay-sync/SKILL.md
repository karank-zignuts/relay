---
name: relay-sync
description: Sync the client's Slack channel into Relay. Use when the user says "sync the client channel", "sync Slack", "pull new client tasks" or asks what the client is waiting on. Reads Slack (read-only) and Jira, then pushes threads to the Relay API.
---

# Relay sync

Turns the client's Slack channel into Relay tasks. **Slack is read-only: never send, reply, react or schedule.** Never print the API key.

## Before you start

Needs these in `.env.local` (names only, never echo values):

| Variable | Meaning |
|---|---|
| `RELAY_URL` | Base URL of Relay, e.g. `https://relay.example.com` (use `http://localhost:3000` in development) |
| `RELAY_API_KEY` | Key from Relay → Settings → API keys |
| `RELAY_SLACK_CHANNEL_ID` | The client channel id, e.g. `C0123456789` |
| `RELAY_SLACK_WORKSPACE` | Workspace subdomain, e.g. `acme` for `acme.slack.com` |
| `RELAY_JIRA_SITE` | Optional, e.g. `acme.atlassian.net` |

Load them for a command with: `set -a; . ./.env.local; set +a` and call the API with `-H "Authorization: Bearer $RELAY_API_KEY"`.
If something is missing, ask the user once and stop. Do not guess.

## Steps

1. **Know the team.** `GET $RELAY_URL/api/v1/users` returns team members with `slack_user_id`. Any Slack user whose ID is in that list is **team**. Everyone else is **client**. If no one has a Slack ID mapped, stop and tell the user to add them in Relay → Users, otherwise every message looks like a client message.
2. **Find the window.** `GET $RELAY_URL/api/v1/sync-runs/latest` gives `last_finished_at`. Read Slack from one day before that (to catch late replies on older threads). With no previous run, read the last 14 days.
3. **Read Slack** with `slack_read_channel` for the channel, then `slack_read_thread` for every message that has replies. Use `slack_read_user_profile` only for unknown IDs.
4. **One task per thread.** The thread root message is the task. A message without replies is its own task. Skip joins, bot noise, reactions-only and pure thank-you messages.
5. **Build each item** (see Field guide). Send only what you can support from the messages.
6. **Jira.** If a message contains a key like `ABC-123` or a Jira link, read it with the Atlassian connector and send `jira_key`, `jira_url` (`https://$RELAY_JIRA_SITE/browse/ABC-123`) and `jira_status` (the current status name).
7. **Push.** `POST $RELAY_URL/api/v1/sync` with `{ "items": [...] }`, at most 200 items per request (split larger batches). Re-sending is safe: threads are matched by `thread_ts`.
8. **Report** in a few lines: created / updated / unchanged / failed, then the threads that now need a reply (client spoke last). Mention any failed items with their `thread_ts` and message.

## Field guide

| Field | Rule |
|---|---|
| `thread_ts` | Slack `ts` of the thread root, e.g. `1730000000.123456` |
| `channel_id` | `RELAY_SLACK_CHANNEL_ID` |
| `title` | Short, specific, under 80 characters. What needs doing, in plain words. |
| `description` | The client's request, cleaned up. Keep their key details (steps, URLs, screenshots mentioned). Under 2000 characters. |
| `task_date` | ISO time of the root message, e.g. `2026-10-29T09:15:00Z` |
| `slack_url` | `https://$RELAY_SLACK_WORKSPACE.slack.com/archives/<channel>/p<ts without the dot>` |
| `module` | Product area if clear from the text (Billing, Auth, Reports…). Reuse names already in Relay. Omit if unsure. |
| `tags` | Any of `bug`, `suggestion`, `feature`, `question`, `chore`, `improvement` |
| `priority` | `urgent` production down or client blocked; `high` bug affecting users or a stated deadline; `medium` normal; `low` nice to have or a suggestion. Used only when the task is first created. |
| `status` | `to_do` by default; `backlog` for loose suggestions; `done` only if the thread clearly says it shipped. Used only at creation. |
| `assignee_slack_ids` | Team members **mentioned** in the thread or who **replied** in it. Used to auto-assign. |
| `last_client_message_at` | Time of the latest message by a non-team user |
| `last_team_reply_at` | Time of the latest message by a team member |
| `environments` / `changes_in` | Only at creation and only if the thread says so (`fe`, `be`, `db`, `devops`, `design`, `other`) |
| `parent_thread_ts` | Only when the client explicitly says a thread follows up an earlier request |

## What Relay protects (so you do not have to)

- Fields a person edited in Relay (title, description, module, status, priority, tags, Jira) are **never overwritten** by a later sync.
- Status, priority, environments and changes-in are only ever set when a task is first created.
- Assignees found in Slack are added, never removed.
- A new client message after someone marked "no reply needed" brings the thread back into Needs attention.

## Errors

| Status | Meaning |
|---|---|
| 401 | Key missing, wrong or revoked. Ask the user for a new key. |
| 422 | A field is invalid. The whole batch was rejected and nothing was saved. Fix the item named in `details` and resend. |
| 5xx | Retry once after a few seconds, then report. |
