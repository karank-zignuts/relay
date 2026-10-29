# TECH_DECISIONS

> Which technologies do we use, and why? How do we choose new ones?
> Read `PROJECT_CONTEXT.md` first. Its constraints apply here: **small team, free tiers**.

Status: **v1.1**, 2026-10-29

Legend: ✅ **Decided** · 🟡 **Recommended** (adopt when needed; owner can veto) · ⏳ **Deferred**

---

## 1. Guiding Principles

1. **Boring and proven beats new and shiny.**
2. **One tool per job.** Never two libraries for the same problem.
3. **Supabase first.** Use Postgres, Auth, Realtime and RLS before adding another service.
4. **Cheap to run.** Free tiers. Any paid service needs a written cost note here.
5. **Replaceable edges.** Email, Slack and Jira access sit behind our own small interfaces.
6. **Simple to operate.** One Next.js app and one Supabase project. No extra servers.
7. **Exact versions.** Never `latest`. Lockfile committed.

---

## 2. Current Stack <!-- LIVING: versions as pinned in package.json -->

| Area | Choice | Version |
|---|---|---|
| Runtime | Node.js | 24.15 |
| Package manager | npm | 11.12 |
| Framework | Next.js (App Router, `src/`, Turbopack) | 16.4.3 |
| UI | React / React DOM | 19.3.0 |
| | TypeScript (strict) / Tailwind CSS | 5.9.3 / 4.3.3 |
| | ESLint (`eslint-config-next`) | 9.39.5 |
| Supabase | `@supabase/supabase-js` / `@supabase/ssr` | 2.118.0 / 0.12.7 |
| Data and forms | `zod` / `@tanstack/react-query` | 4.6.7 / 5.105.0 |
| | `react-hook-form` / `@hookform/resolvers` | 7.91.0 / 6.0.2 |
| Icons | `lucide-react` | 1.64.0 |
| Testing | Vitest | 5.0.5 |
| Components | shadcn 4.23.0 (`base-nova` style) on `@base-ui/react` 1.9.0 | installed |
| Styling helpers | `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 3.7.0, `tw-animate-css` 1.4.0, `sonner` 2.0.8 | installed |
| Tooling | `supabase` CLI 2.122.0, `@playwright/test` 1.64.1, `server-only` 0.0.1 | installed |
| Database / Auth / Realtime | Supabase (project `zbcukshbvypebbazzfei`) | — |
| Email | Resend (SMTP into Supabase Auth) | — |
| Hosting | Vercel + Supabase cloud (free tier) | — |

Versions are filled in the same change that installs the packages (§10).

---

## 3. Architecture

| Decision | Status | Why |
|---|---|---|
| **Single Next.js app.** UI and API routes in one repo. | ✅ | Small team. One deploy. |
| **Supabase is the data owner.** Postgres with RLS per role. | ✅ | Roles are enforced in the database, not only in code. |
| **Two API surfaces.** (a) The web app talks to Supabase with the signed-in user's session. (b) Claude talks to `/api/v1/*` with an API key. | ✅ | Claude never gets database access. The server validates every write. |
| **Service-role key is server-only.** Used only inside route handlers and server actions. Never in the browser bundle. | ✅ | Security. |
| **Idempotent sync.** Tasks are upserted by `slack_thread_ts`. | ✅ | Re-syncing never duplicates. |
| **Realtime** via Supabase Realtime for comments, status and the task table. | ✅ | Built into Supabase. No Claude tokens used. |
| **Slack and Jira are read through Claude's MCP connectors**, not by our server. | ✅ | No Slack or Jira credentials stored in Relay. |

---

## 4. Backend Decisions

| Area | Choice | Status | Notes |
|---|---|---|---|
| DB access | `@supabase/supabase-js` + `@supabase/ssr`, generated TypeScript types | ✅ | No Prisma or other ORM. |
| Migrations | SQL files via the Supabase CLI (`supabase/migrations/`) | ✅ | Reviewed in Git. Never edit an applied migration. |
| Authorization | RLS policies per role, plus server-side role checks in route handlers | ✅ | Defense in depth. |
| Validation | Zod for every API body, query and param, and for env config | ✅ | |
| Auth | Supabase Auth (email + password), invite-only (public sign-up disabled) | ✅ | Invite, resend, reset, change password via Supabase admin API (server-side). |
| API keys (Claude) | Random key, stored **hashed**, sent as `Authorization: Bearer`. Revocable. | ✅ | Managed by Super Admin. |
| Email | Resend through Supabase custom SMTP | ✅ | Built-in Supabase email is rate-limited to a few emails an hour. |
| Rate limiting | On auth and API-key routes | 🟡 | |
| Logging | Structured logs from route handlers | 🟡 | |
| Testing | Vitest (unit), Playwright (e2e later) | 🟡 | |

---

## 5. Frontend Decisions

| Area | Choice | Status | Notes |
|---|---|---|---|
| Framework | Next.js App Router, Server Components by default | ✅ | `"use client"` only where needed. |
| Styling | Tailwind 4 with CSS-variable tokens | ✅ | Tokens defined in `DESIGN_SYSTEM.md`. |
| UI components | **shadcn/ui on Base UI primitives. Radix is not used.** | ✅ | Confirm the Base UI option when running `shadcn init`. |
| ElevenLabs UI | Optional shadcn registry for audio/agent components | 🟡 | Mostly audio components, so used only if a component fits. Not a base library. |
| Icons | `lucide-react` | ✅ | One icon set. |
| Server state | TanStack Query | ✅ | The only client data-fetching approach. |
| Forms | `react-hook-form` + Zod | ✅ | |
| Tables | TanStack Table | 🟡 | Sorting, filtering, column visibility for the task table. |
| Kanban drag and drop | `@dnd-kit/core` | 🟡 | |
| Dates | `date-fns` | 🟡 | |
| Animation | CSS transitions only | ✅ | |

---

## 6. Claude / Sync Decisions

| Decision | Status | Notes |
|---|---|---|
| Claude reads Slack via the Slack MCP connector (read tools only) | ✅ | Never uses send or reaction tools. |
| Claude reads Jira via the Atlassian MCP connector | ✅ | Mirrors ticket link and status into the task. |
| Claude pushes through `/api/v1/sync`, `/tasks`, `/comments` with an API key | ✅ | See `AI_WORKFLOW.md` §6. |
| A Claude skill file documents the sync steps | 🟡 | Added in Phase 3. |
| Every sync writes a `sync_runs` row (counts, errors, who) | ✅ | Feeds the sync status bar. |

---

## 7. Hosting & Infrastructure

| Piece | Choice | Watch-outs |
|---|---|---|
| Frontend + API | Vercel | Hobby tier is non-commercial. Check before use for a paid client. |
| Database / Auth | Supabase free | Projects **pause after 7 days of inactivity**. 500 MB database limit. |
| Email | Resend free | Verify a sending domain for production. |

Target cost: **$0/month**.

---

## 8. Prohibited / Discouraged

- ❌ `latest` or unpinned versions
- ❌ Two libraries for the same job
- ❌ Service-role key or any secret in the browser bundle or in `NEXT_PUBLIC_*`
- ❌ Claude or any external client writing directly to the database
- ❌ Slack write actions (send, reply, react) from Relay or from the sync
- ❌ Hard-deleting data (see `ENGINEERING_STANDARDS.md` §6)
- ❌ Radix primitives (Base UI is the primitive layer)
- ⚠️ Paid SaaS dependencies without a cost note in this file

---

## 9. Choosing a New Technology

Before adding any dependency or service:

1. Check whether the current stack already solves it.
2. Compare 2–3 options on: problem fit, maturity, maintenance, security, **running cost**, lock-in.
3. Choose the simplest strong option.
4. Record it here as a row: **Decision · Why · Alternatives considered**.

For major changes:

```text
Current → Problem → Alternatives → Recommendation → Trade-offs → Migration risk
```

---

## 10. Setup Status <!-- LIVING -->

- ✅ Next.js app, dependencies pinned to exact versions (`.npmrc` `save-exact=true`). `npm run build`, `lint`, `typecheck`, `test` pass.
- ✅ `@types/node` pinned to 24 to match Node 24 (Vitest 5 requires `^22 || >=24`).
- ✅ Supabase CLI linked to project `zbcukshbvypebbazzfei`. Migrations `20261029000001_foundation` and `20261029000002_tasks_and_sync` applied.
- ✅ Supabase MCP added to `.mcp.json` (read-only, project scoped).
- ✅ `cacheComponents` and `partialPrefetching` removed from `next.config.ts` (scaffold defaults that do not suit an auth-gated app).
- ✅ shadcn initialised with Base UI. The `cn` npm package that the shadcn init pulled in was replaced with `clsx` + `tailwind-merge`. `next-themes` was removed (light theme only).
- ⚠️ Port 3000 is used by another project on the owner's machine. Run Relay on 3001 (`PORT=3001 npm run dev`, `E2E_BASE_URL=http://localhost:3001`) or free port 3000, and set `NEXT_PUBLIC_APP_URL` to match, because invite and reset links use it.
- ⏳ **Resend not connected.** Supabase's built-in mailer is limited to a few emails an hour, so invitations and password resets can fail with `EMAIL_RATE_LIMIT` until Resend SMTP is configured.
- ⏳ Supabase Auth settings to confirm in the dashboard: public sign-up disabled, Site URL and redirect URLs include `/set-password`.
- ⏳ Waldenburg is not licensed, so headings use Inter 300.
