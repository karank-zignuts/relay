# PROJECT_CONTEXT

> What is Relay, and why does it exist?
> Read this first. Other docs in `docs/ai-context/` build on it.

Status: **v1.1**, 2026-10-29

---

## 1. Identity

**Relay** is an internal team tool that turns a client's Slack channel into a managed, visual task board.

The client posts many tasks, bugs and suggestions in one Slack channel. Slack is a poor place to track them: messages scroll away, replies get forgotten, and nobody sees status at a glance. Relay is the single place where the team sees every request, who owns it, where it is, and what still needs a reply.

Positioning:

> **Every client message, tracked. Nothing forgotten.**

Relay is **not**:
- a Slack replacement or a Slack bot (it never posts or replies in Slack)
- a client-facing portal (only our team signs in)
- a full Jira replacement (it only links to and mirrors the status of Jira tickets)

---

## 2. The Problem

- The client sends bursts of tasks and suggestions in one channel.
- Threads are long, so it is hard to see what is open, who owns it and what is deployed where.
- Messages the team has not replied to, or forgot to reply to, are invisible.
- There is no shared status, priority or team-only discussion.

Core question Relay answers for the team:

> **"What did the client ask for, who is on it, and what have we not answered yet?"**

---

## 3. Users

An internal team. One Slack workspace channel (one client) for now.

| Role | Purpose |
|---|---|
| **Super Admin** | Full control, including managing Project Managers and other Super Admins |
| **Project Manager** | Manages tasks and users (not Super Admins) |
| **Developer** | Works on tasks, comments, updates progress |
| **Tester** | Verifies tasks, updates status, comments |

Permission matrix lives in `ENGINEERING_STANDARDS.md` §9.

---

## 4. How It Works (Core Flow)

```text
User tells Claude "sync the client channel"
  → Claude reads Slack (read-only) and Jira (via MCP)
  → Claude calls the Relay API with an API key
  → Relay upserts tasks by Slack thread ID, logs a sync run
  → The team manages tasks in the web app
```

- **Claude is an external client** of the Relay API. It never touches the database directly.
- Re-syncing the same thread **updates** the existing task. It never duplicates it.
- Slack is read-only. Relay never sends messages to Slack.

---

## 5. Modules

| # | Module | Role |
|---|---|---|
| 1 | **Auth & Users** | Sign in, forgot/change password, invite, resend invite, add/edit/delete user, roles |
| 2 | **Tasks** | Table of tasks (one row per Slack message or thread), filters, parent/sub-tasks, edit, delete |
| 3 | **Kanban** | Board view of the same tasks, grouped by status |
| 4 | **Comments** | Internal team chat per task, realtime |
| 5 | **Sync & API** | Claude-facing REST API, API keys, sync runs, sync status bar |
| 6 | **Needs Attention** | Unreplied and forgotten-to-reply Slack threads |
| 7 | **Activity Log** | Project-wide log of every action (task changes, comments, user management, syncs, logins) |
| 8 | **Jira Link** | Jira ticket link and mirrored status per task |
| 9 | **Frontend & Design System** | Refero-style tokens plus shadcn components |

---

## 6. Domain Terminology

Use these terms consistently in code, UI and docs.

| Term | Meaning |
|---|---|
| **Task** | One tracked client request. Maps to one Slack message or thread. |
| **Thread** | A Slack message and its replies. Identified by `slack_thread_ts`. |
| **Parent task** | A task that other tasks (sub-tasks) belong to. |
| **Module** | The product area a task belongs to (e.g. Login, Billing). Not a code module. |
| **Assignee** | A team member responsible for a task. A task can have several. |
| **Env status** | Which environments a change is in: `local`, `development`, `staging`, `production`. Multi-select. |
| **Changes in** | Which layers the task touches: FE, BE, DB, DevOps, etc. Multi-select. |
| **Tag** | A label such as `bug`, `suggestion`, `new-feature`. |
| **Sync run** | One execution of Claude pushing Slack data to Relay, with counts and errors. |
| **Needs attention** | A thread where the client's latest message has no team reply. |
| **Forgotten reply** | A needs-attention thread older than the threshold (default 4 working hours, editable). |
| **Slack user mapping** | Link between a Slack user ID and a Relay user, used for assignee auto-select. |
| **Activity log** | Append-only record of who did what and when. |

---

## 7. Non-Negotiable Principles

1. **Slack is read-only.** Relay never posts, replies or reacts in Slack.
2. **Claude uses the API only.** No direct database access for Claude.
3. **Sync is idempotent.** One Slack thread is one task, however often it syncs.
4. **Nothing is lost.** Deletes are soft. The Activity Log is append-only.
5. **Every action is attributable.** Each change records who (user or Claude) did it.
6. **Roles are enforced on the server** (API and database policies), not only hidden in the UI.

---

## 8. Current Stage <!-- LIVING (except Constraints) -->

**Stage: Phases 1–4 built and tested. Waiting on owner setup (Resend email, first sign-in, API key) and a real Slack sync.**

- Phases: (1) Auth, roles, users, database → (2) Task table, filters, comments, kanban, sub-tasks → (3) Claude API, sync status, Claude skill → (4) Needs-attention, Jira fields, activity log, polish. See `ROADMAP.md`.

### Implementation Status <!-- LIVING: agents update as features ship -->

One line per module. Details go in module READMEs.

| Module | Status | What exists |
|---|---|---|
| 1 Auth & Users | Usable | Sign in, forgot/set/change password, invite, resend invite, add/edit/delete user, 4 roles enforced in RLS and routes. Invite email needs Resend (built-in mailer is rate-limited). |
| 2 Tasks | Usable | Table with all columns, filters, quick views, column and density controls, drawer editor, sub-tasks, tags, env and changes-in, soft delete, optimistic updates, keyboard shortcuts. |
| 3 Kanban | Usable | Board by status, drag to change status (permission aware), opens the same drawer. |
| 4 Comments | Usable | Realtime internal discussion per task, delete own comment. |
| 5 Sync & API | Usable | `/api/v1/sync`, `/tasks`, `/users`, `/sync-runs/latest`, hashed API keys, sync status bar, Claude skill `.claude/skills/relay-sync`. Not yet run against the real Slack channel. |
| 6 Needs Attention | Usable | Unreplied and Forgotten tabs, working-hours threshold, no-reply-needed with auto-reopen. |
| 7 Activity Log | Usable | DB-trigger logging of tasks, comments, assignees and syncs, plus server logging of sign-ins, users, keys and settings. Day-grouped feed for Super Admin and PM. |
| 8 Jira Link | Usable | Key, link and status fields, set by Claude during sync or edited by hand. |
| 9 Frontend & Design System | Usable | Refero tokens, shadcn on Base UI, shape-based status language, motion and density rules. |

Status values: `Not started` · `In progress` · `Usable` · `Parked`.

### Constraints

- **Small team, internal tool.** Keep the architecture simple: one Next.js app, one Supabase project.
- **Free tiers.** Supabase free, Vercel, Resend free. A new paid dependency needs a written cost note.
- **One client channel** for now. Multi-channel is out of scope.

---

## 9. Context Documents

| Doc | Answers | Status |
|---|---|---|
| `PROJECT_CONTEXT.md` | What is this and why? | v1.0 |
| `TECH_DECISIONS.md` | Which stack, and why? | v1.0 |
| `ENGINEERING_STANDARDS.md` | What does good code look like here? | v1.0 |
| `DESIGN_SYSTEM.md` | How does it look and feel? | v1.0 (Refero style, light theme) |
| `AI_WORKFLOW.md` | How must AI agents work in this repo? | v1.0 |
| `ROADMAP.md` | What's next and why? | v1.0 |

---

## 10. Decisions Log <!-- LIVING: append-only -->

| Date | Decision |
|---|---|
| 2026-10-29 | Project named **Relay**. |
| 2026-10-29 | Stack: Next.js + Supabase (Postgres, Auth, Realtime), deployed on Vercel. Resend for email. |
| 2026-10-29 | Single Next.js app. No separate NestJS backend, no Prisma. |
| 2026-10-29 | Claude pushes data through a REST API protected by an API key. No direct database access. |
| 2026-10-29 | One client Slack channel. Slack is read-only: Relay never replies. |
| 2026-10-29 | Roles: Super Admin, Project Manager, Developer, Tester. |
| 2026-10-29 | Added: multiple assignees, Slack-user mapping, tags, Kanban view, realtime updates, project-wide Activity Log. |
| 2026-10-29 | Dropped: "needs review" draft inbox. Synced tasks go straight into the table. |
| 2026-10-29 | Forgotten-reply threshold defaults to 4 working hours, editable in settings. |
| 2026-10-29 | Soft delete everywhere. |
| 2026-10-29 | Design: Refero style (ElevenLabs-based, light theme). ElevenLabs UI components used only where relevant. |
| 2026-10-29 | Shortened design workflow: no low-fi/hi-fi artboards, since the design system is chosen. |
| 2026-10-29 | Visual language for status, priority and environments is shape-based and achromatic, with Ember `#ff4704` as the only signal color (`DESIGN_SYSTEM.md` §5.3). Owner may veto. |
| 2026-10-29 | Sync never overwrites fields a person edited (`human_edited_fields`). Status, priority, environments and changes-in are set only at creation. |
| 2026-10-29 | Playwright e2e added, mirroring the Organizr setup (per-role saved logins, terse reporter). Test accounts live in the real Supabase project. |
| 2026-10-29 | Dev server for tests runs on port 3001 because 3000 is used by another project on the owner's machine. |
| 2026-10-30 | Test data (the e2e accounts and everything they make) is hidden from every real user by the database, not a client flag: triggers flag `is_test` on every insert path and restrictive RLS hides flagged rows from all but the test accounts (`20261030000005_hide_test_data.sql`). `NEXT_PUBLIC_SHOW_TEST_USERS` is removed; server pages and the feed decide by whether the signed-in user is a test account. |
| 2026-10-30 | Brand identity chosen: a four-piece R mark (three tiles and a diagonal leg) with an Inter 700 wordmark. Ember `#ff4704` is now the brand accent as well as the signal color (`DESIGN_SYSTEM.md` §5.13). Assets in `brand/`, generated by `brand/build-assets.mjs`. |
