# ENGINEERING_STANDARDS

> What does good engineering mean in this repo?
> Stack choices live in `TECH_DECISIONS.md`. This doc covers **how** we write code with that stack.

Status: **v1.0 (approved)**, 2026-10-29

---

## 1. Core Principles

1. **Small, focused changes.** One concern per change. No mixing refactors, upgrades and features.
2. **Clear boundaries.** Features talk through their own `api.ts` / service, not each other's internals.
3. **Readable over clever.**
4. **Fail loudly.** Never swallow errors.
5. **Secure by default.** Authorization is enforced on the server and in RLS, never only in the UI.

---

## 2. Project Structure

```text
relay/
├── docs/ai-context/             # these context docs
├── supabase/
│   ├── migrations/              # SQL migrations
│   └── seed.sql
└── src/
    ├── app/
    │   ├── (auth)/              # sign-in, forgot/reset password, accept invite
    │   ├── (app)/               # authenticated product: tasks, kanban, needs-attention, activity, users, settings
    │   └── api/v1/              # Claude-facing REST API (API key auth)
    ├── components/
    │   ├── ui/                  # shadcn primitives, no business logic
    │   └── <feature>/           # feature components
    ├── features/<feature>/      # api.ts, queries.ts, schemas.ts (Zod), types.ts
    ├── lib/
    │   ├── supabase/            # browser, server and admin clients
    │   ├── auth/                # session, role checks, API-key verification
    │   ├── env.ts               # Zod-validated env
    │   └── format.ts            # dates, labels
    └── styles/                  # design tokens
```

Rules:
- **Route files stay thin:** parse → validate → call a function → return.
- **Server Components by default.** Smallest possible `"use client"` components.
- **Data flow (client):** `features/*/api.ts` → `features/*/queries.ts` (TanStack Query) → components. Components never call Supabase directly.
- **Query keys** come from one key factory per feature.
- **Admin client** (`service_role`) is imported only from server-only files (`import "server-only"`).

---

## 3. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `task-table.tsx`, `sync-run.ts` |
| React components | PascalCase | `TaskTable` |
| Functions / variables | camelCase | `upsertTaskByThread` |
| Types | PascalCase, no `I` prefix | `Task`, `SyncRun` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_REPLY_THRESHOLD_HOURS` |
| Zod schemas | camelCase + `Schema` | `createTaskSchema` |
| DB tables / columns | snake_case, plural tables | `tasks.slack_thread_ts` |
| Enums | snake_case type, lowercase values | `task_status`: `to_do`, `in_progress` |
| API paths | kebab-case, plural nouns | `/api/v1/tasks`, `/api/v1/sync-runs` |
| Booleans | `is/has/can` prefix | `isForgotten` |

Use the domain terms from `PROJECT_CONTEXT.md` §6 exactly.

---

## 4. API Conventions (Claude-facing `/api/v1`)

- **Auth:** `Authorization: Bearer <api key>`. Keys are verified against a stored hash. Missing or invalid key returns `401`.
- **Idempotent writes:** `PUT /api/v1/tasks/by-thread/:threadTs` upserts. Re-sending the same payload changes nothing.
- **Batch:** `POST /api/v1/sync` accepts many tasks and comments in one call and records one sync run.
- **Validation:** every body, query and param goes through Zod. Unknown fields are rejected.
- **JSON formats:** IDs are UUIDs. Timestamps are ISO-8601 UTC.
- **Pagination:** cursor-based (`?cursor=&limit=`, max 100). Response `{ items, nextCursor }`.
- **Error shape:**

  ```json
  { "error": { "code": "TASK_NOT_FOUND", "message": "Human-readable message", "details": {} } }
  ```

  `code` is a stable UPPER_SNAKE identifier. Never leak stack traces or SQL.
- **Versioning:** a breaking change means `/api/v2`.
- **Source of change:** every write records the actor (a user, or the API key name for Claude) in the Activity Log.

---

## 5. Authentication & Roles

| Action | Super Admin | Project Manager | Developer | Tester |
|---|---|---|---|---|
| Manage users (add, invite, resend, edit, delete) | ✅ | ✅ (cannot touch Super Admins) | ❌ | ❌ |
| Manage API keys and settings | ✅ | ❌ | ❌ | ❌ |
| Create / edit / delete tasks | ✅ | ✅ | Edit assigned tasks | Edit status only |
| Comment | ✅ | ✅ | ✅ | ✅ |
| View Activity Log | ✅ | ✅ | ❌ | ❌ |

- Sign-up is **invite-only**. Public sign-up is disabled in Supabase.
- Every user has exactly one role, stored in `profiles.role`.
- The matrix is enforced in **RLS policies and in route handlers**. The UI only hides what the server already refuses.
- Users cannot change their own role. A user cannot delete themselves.
- The last Super Admin cannot be deleted or demoted.

---

## 6. Database Conventions (Supabase Postgres)

- **IDs:** `uuid` primary keys (`gen_random_uuid()`).
- **Every table has** `created_at`, `updated_at` (trigger-maintained) and `deleted_at`.
- **Timestamps:** `timestamptz`, always UTC.
- **Enums** for closed sets (status, priority, role). No magic strings.
- **Multi-value fields** (env status, changes-in, tags) use separate join tables or enum arrays, never free text.
- **JSON columns** only for raw Slack payloads and similar unstructured data. Never for fields we filter on.
- **Raw Slack data is kept** (`raw_slack jsonb`) so tasks can be re-processed when logic improves.
- **Indexes** on every foreign key and common filter (`status`, `priority`, `assignee`, `slack_thread_ts`).
- **Unique constraints** that must ignore deleted rows use partial unique indexes (`WHERE deleted_at IS NULL`). `slack_thread_ts` is one of them.
- **RLS is on for every table.** No table is readable without a policy.
- **Migrations:** only via SQL files in `supabase/migrations/`. Never edit an applied migration. Destructive changes happen in two steps: add new → backfill → remove old.
- **Soft delete everywhere, never hard delete.**
  - "Delete" sets `deleted_at`. Reads filter `deleted_at IS NULL` by default, through views or RLS, not by remembering it in each query.
  - Deleting a parent task soft-deletes its sub-tasks in the same transaction.
  - Deleted users lose access immediately (their auth is banned) but remain in the Activity Log.
  - The only exception is a legal erasure request, done as a separate audited manual purge.
- **Transactions** (SQL functions) for multi-row writes that must stay consistent, such as a sync batch.

---

## 7. Sync Code

1. A thread maps to **one** task. The key is `slack_thread_ts` (a standalone message uses its own `ts`).
2. Syncing is **additive**: it never overwrites fields a human edited (status, priority, module, internal comments, assignees set by a person). Claude may only update fields it owns: Slack-derived text, dates, link, last-reply timestamps, Jira mirror.
3. **Unreplied logic:** a thread needs attention when the latest message is from the client and there is no later team message. It is *forgotten* when that message is older than the threshold in working hours. Computed from stored `last_client_message_at` and `last_team_reply_at`.
4. **Assignee auto-select:** map Slack user IDs to Relay users through `profiles.slack_user_id`. If no mapping exists, leave the assignee empty.
5. Every sync writes one `sync_runs` row: started, finished, counts (created, updated, unchanged, failed), error details.
6. Partial failure is allowed: one bad item is reported and the rest still import.

---

## 8. Validation & Error Handling

- **Validate at the boundary:** HTTP input, env config and forms go through Zod. Inside the app, trust the types.
- **No empty catches.** Handle, rethrow or log with context.
- **Frontend:** every data view handles **loading, empty, error and partial data**. Errors show a human message, never raw API text.
- **Server actions and route handlers** return the standard error shape (§4).

---

## 9. Security

- **Secrets only in env vars.** `.env.local` is never committed. `.env.example` lists every key with dummy values.
- **Never put secrets in `NEXT_PUBLIC_*`.** Only the Supabase URL and anon key are public.
- The `service_role` key and Resend key are server-only.
- API keys are shown **once** on creation and stored hashed. They can be revoked.
- **Never log** passwords, tokens, API keys, session cookies or raw Slack payloads.
- Rate-limit sign-in, forgot-password, invite and API-key routes.
- Parameterized queries only.
- Security headers and CORS locked to the app URL.

---

## 10. Testing

| Area | Requirement |
|---|---|
| Sync logic (upsert, unreplied/forgotten calculation, assignee mapping) | **Mandatory unit tests** |
| Role permissions and RLS | **Mandatory tests**, including "tester cannot edit assignee" and "developer cannot manage users" |
| Soft delete | Tests that deleted rows never appear in reads and unique indexes ignore them |
| API endpoints | Happy path plus main errors (401, validation, idempotent re-send) |
| Frontend | Test logic-heavy hooks and utils with Vitest. Cover flows with Playwright (`e2e/`), as described in `AI_WORKFLOW.md` §6.5. |

Rules: unit tests sit next to the code (`*.test.ts`); Playwright specs live in `e2e/`. They are deterministic (fixed dates and timezones, no real network). A bug fix comes with a test that reproduces the bug. Build, lint and tests pass before merging to `main`.

---

## 11. Frontend Quality

- **Accessibility:** semantic HTML, keyboard reachable, visible focus, labelled inputs, sufficient contrast. Color is never the only signal (status and priority also show text or an icon).
- **Performance:** server-render where possible, paginate long lists, no unnecessary client state.
- **Styling:** design-system tokens and components only. No hardcoded colors or one-off spacing.
- Split a component when it exceeds about 250 lines or handles more than one concern.

---

## 12. Code Quality

- TypeScript `strict`. **No `any`.** Use `unknown` and narrow it.
- No unused code, commented-out code or leftover template files.
- Files over about 400 lines are a signal to split.
- Comments explain **why**, not what.
- No `TODO` without context: `TODO(owner/date): reason`, or put it in `ROADMAP.md`.
- Formatting: Prettier and ESLint. Don't hand-format against the tools.

---

## 13. Dependencies

- Follow `TECH_DECISIONS.md` §9 before adding anything.
- Install with exact versions. Commit the lockfile.
- Upgrades are their own change.

---

## 14. Git Workflow

- `main` is always deployable.
- Short-lived branches: `feat/<slice>`, `fix/<issue>`, `chore/<task>`, `docs/<topic>`.
- **Conventional Commits:** `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`. Imperative mood.
- One logical change per commit. Never commit `.env*` (except `.env.example`), `node_modules`, `.next`.

---

## 15. Documentation

- Keep `docs/ai-context/` current. When a decision changes, update the doc in the same change.
- Non-obvious rules (sync merge rules, forgotten-reply calculation) get a short `README.md` in their folder.
