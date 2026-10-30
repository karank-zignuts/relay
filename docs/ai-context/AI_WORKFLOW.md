# AI_WORKFLOW

> How must AI agents work in the Relay repo?
> This is the operational rulebook. Every AI agent follows it on every task.

Status: **v1.0 (approved)**, 2026-10-29

---

## 1. Start of Every Session

1. **Read the context docs** in this order:

   ```text
   PROJECT_CONTEXT.md       → what we're building and why
   TECH_DECISIONS.md        → the stack and how to choose technology
   ENGINEERING_STANDARDS.md → how code is written
   DESIGN_SYSTEM.md         → how the UI looks
   ROADMAP.md               → what is being worked on now
   ```

   For a narrow task, `PROJECT_CONTEXT.md` plus the relevant docs are enough, but **never zero**.
2. **Check the current state:** `git status`, the branch and recent commits. Don't build on someone's uncommitted work without saying so.

---

## 2. Size the Task First

| Size | Examples | Process |
|---|---|---|
| **Trivial** | typo, copy change, config value | Do it, verify it, report in 1–3 lines. |
| **Standard** | a bug fix, one endpoint, one component | Inspect → short plan in the reply → implement → test → report. |
| **Major** | new module, schema change, new dependency, auth or permission logic, sync logic | **Plan first and wait for owner approval.** |

When unsure, treat the task as the larger size.

---

## 3. The Workflow

```text
UNDERSTAND → INSPECT → PLAN → IMPLEMENT → VERIFY → SELF-REVIEW → DOCUMENT → REPORT
```

1. **Understand.** Restate the goal in one line.
2. **Inspect.** Read the actual code involved. **Never modify code you haven't read.**
3. **Reuse check.** Search for an existing util, hook, component, schema or dependency first.
4. **Plan.** Files to change, data/API impact, risks. For major tasks, stop for approval.
5. **Implement** the smallest correct change, following `ENGINEERING_STANDARDS.md`.
6. **Verify** with the commands in §7. Exercise the real behavior, not just the compiler.
7. **Self-review** against §8.
8. **Document.** Update the living context (§11).
9. **Report** using §9.

---

## 4. Stop and Ask the Owner When…

- It's a **product decision** (what to build, UX behavior, scope). Never present a product choice as a technical necessity.
- A **new dependency or paid service** is involved.
- A **schema change** is destructive or changes existing data.
- The change touches **auth, roles, RLS, API keys or data deletion** in a way not already specified.
- A screen needs a **color, token or pattern** that `DESIGN_SYSTEM.md` hasn't defined.
- Requirements are **ambiguous** and the code and docs can't answer it.
- Something **contradicts** the context docs.

Ask concise questions with a recommended option. Don't ask what the codebase can answer.

---

## 5. Golden Rules

1. Never modify code you haven't inspected.
2. Never rewrite working code without a stated reason.
3. Never add a dependency without checking whether the stack already solves it.
4. Never invent files, fields, APIs, versions or business rules.
5. Never put a secret in the repo, the browser bundle or chat.
6. Never use Slack write tools (send, reply, react, canvas, schedule). Slack is read-only.
7. Never hide uncertainty, failures or skipped steps.
8. Never weaken security, validation, RLS or tests for convenience.
9. Optimize for the **smallest correct change**.

---

## 6. Special Protocols

### 6.1 Slack sync (Claude as the sync client)

When the owner says "sync the client channel" (or similar):

1. **Read from Slack** with read tools only (`slack_read_channel`, `slack_read_thread`, `slack_read_user_profile`). Fetch since the last sync run (`GET /api/v1/sync-runs/latest`), or the agreed window.
2. **Group by thread.** One task per thread. A standalone message is its own task.
3. For each task, derive: title, short description, task date, Slack link, module guess, tag guess (bug / suggestion / new-feature), assignee Slack IDs (mentioned or replying team members), last client message time, last team reply time, and a priority and status suggestion.
4. **Jira:** if a ticket key or link appears, read it through the Atlassian connector and include the key, link and current status.
5. **Send one batch** to `POST /api/v1/sync` with the API key from the environment (`RELAY_API_KEY`). Never print the key.
6. **Never overwrite** human-edited fields. Send only fields Claude owns (`ENGINEERING_STANDARDS.md` §7).
7. **Report:** counts created, updated, unchanged, failed, plus the threads that need attention.
8. Partial failures are reported, not hidden.

A Claude skill file (Phase 3) will hold these steps so the sync is identical each time.

**Attachments from Slack.** After syncing a thread that has files, `POST /api/v1/attachments` with `{ "thread_ts": "...", "files": [{ "file_name": "x.png", "mime_type": "image/png", "url": "<permalink>", "content_base64": "<optional, under ~3 MB>" }] }`. Files with `content_base64` are stored in Supabase Storage; otherwise the link is shown. Re-sending is safe (same name on the same task is skipped).

### 6.2 Database changes

1. Write a new SQL migration in `supabase/migrations/`, following `ENGINEERING_STANDARDS.md` §6 (`deleted_at`, RLS, indexes, partial unique indexes).
2. Never edit an applied migration. Destructive changes happen in two steps.
3. Regenerate the TypeScript types.
4. Add or update RLS tests.

### 6.3 Roles and permissions

1. The matrix in `ENGINEERING_STANDARDS.md` §5 is the source of truth.
2. Enforce in RLS **and** the route handler. Never only in the UI.
3. Every permission change gets a test for each role.

### 6.4 UI work

1. Follow `DESIGN_SYSTEM.md` §10: plan → implement → validate → evolve.
2. Never invent tokens, colors, fonts or component styles. Status, priority and environment use the shape-based language in `DESIGN_SYSTEM.md` §5.3. Ember is the only signal color.
3. A UI task isn't done until it has been checked in the running app, including loading, empty and error states.

### 6.5 Testing and browser verification (cheap by default)

Do **not** drive the browser click-by-click with screenshots. Use the Playwright suite in `e2e/`:

1. Write or extend a spec in `e2e/` (copy `smoke.spec.ts`; import `test` from `./fixtures` so page errors and 5xx responses fail the test).
2. Start the dev server for tests with the test accounts visible: `NEXT_PUBLIC_SHOW_TEST_USERS=1 PORT=3001 npm run dev` (Playwright does this itself when it starts the server). Without that flag the UI hides `profiles.is_test` accounts, so the user and assignee specs cannot find them. Then run one spec, headless: `npx playwright test e2e/<file>.spec.ts`. Logins are saved once per role by `auth.setup.ts`. The dev server is reused if it is already running. If port 3000 is busy, set `E2E_BASE_URL=http://localhost:3001` and start Relay with `PORT=3001 npm run dev`.
3. Assert on roles and text, never pixels. Only failures print detail. Read `test-results/` for the failure screenshot and trace.
4. Visual check, once: `E2E_SHOTS=1 npx playwright test e2e/shots.spec.ts` writes screenshots to `test-results/shots/`. View one or two, not every step.
5. For ad-hoc exploration use the `agent-browser` skill, in a subagent, and report failures only.
6. Test only the changed flow. Test accounts live in `.env.e2e` (gitignored, created by `npm run e2e:users`). They are test accounts in the real Supabase project, so never use real users.
7. Roles: `super_admin`, `project_manager`, `developer`, `tester`. Put `asRole("developer")` at the top of a spec to test as one role, or loop `ROLES` like `smoke.spec.ts`. Test permissions both ways: the allowed role sees it, the blocked role does not.
8. `rls.spec.ts` talks to the database directly as each role. Any change to RLS, triggers or the `sync_threads` function needs a case there.
9. Re-login only if sessions expired: `npx playwright test --project=setup`.
10. Tests that would send real email are opt-in (`E2E_INVITES=1`). Supabase's built-in mailer allows only a few emails an hour.
11. The suite cleans up after itself (`e2e/global-teardown.ts` soft-deletes test tasks).

Also run `npm test` (Vitest, pure logic), `npm run lint`, `npm run typecheck` and `npm run build`.

### 6.6 Context doc changes

- Update the doc's `Status` line and the `PROJECT_CONTEXT.md` §9 table, and add decisions to the §10 log.
- If a section is added or renumbered, update the doc index in the root `CLAUDE.md`.

---

## 7. Verification Commands

Run what's relevant. **Report actual results, not assumptions.**

| Check | Command |
|---|---|
| Build | `npm run build` |
| Lint | `npm run lint` |
| Types | `npx tsc --noEmit` |
| Unit tests | `npm test` |
| Migrations | `npx supabase db lint` / `npx supabase db reset` (local only) |
| E2E | `npx playwright test e2e/<file>.spec.ts` (see §6.5) |
| UI behavior | Run the dev server and check changed screens, including loading, empty and error states |

A change isn't "done" until it builds, its tests pass, and the changed behavior has been exercised.

---

## 8. Self-Review Checklist

```text
□ Does it solve the actual request, and only that?
□ Did I read every file I changed?
□ Did I break the Claude-facing API contract?
□ Did I duplicate logic that already exists?
□ Is the permission enforced in RLS and the route, not only the UI?
□ Are inputs validated with Zod and errors handled (no silent catches)?
□ Are deletes soft, and are reads soft-delete-aware?
□ Are loading, empty, error and partial states handled?
□ Is there any secret in the code, the bundle or the logs?
□ Did I update the living context (§11)?
```

---

## 9. Report Format

**Trivial tasks:** 1–3 lines covering what changed and how it was verified.

**Standard and major tasks:**

```text
DONE
<one-line summary>

CHANGED
<files/modules>

DATA / API
<schema, migration, endpoint or contract changes. "None" if none.>

VERIFIED
<commands run + results. What was exercised manually.>

NOT DONE / RISKS
<skipped steps, failing checks, open issues. Be honest.>

NEXT
<the single highest-value next step, if useful>
```

Never claim a check passed if it wasn't run.

---

## 10. Git Behavior for Agents

- **Commit or push only when the owner asks.**
- Use the branch and commit conventions in `ENGINEERING_STANDARDS.md` §14.
- Never force-push or rewrite published history.
- Never commit `.env*` (except `.env.example`) or secrets.
- Check `git status` before committing. Stage specific files.

---

## 11. Keeping Context Current

The context docs must always describe the project **as it actually is**.

### Core context (stable, owner-approved)

Change only with **explicit owner approval**: identity, problem, users and principles (`PROJECT_CONTEXT.md` §1–3, §7), the role matrix, approved decisions in `TECH_DECISIONS.md`, `ENGINEERING_STANDARDS.md`, `AI_WORKFLOW.md` and `DESIGN_SYSTEM.md` §2–3, §8–9.

If the implementation needs to differ, **stop and ask**.

### Living context (agents keep it current)

Sections marked `<!-- LIVING -->`, plus:

| What changed | Update |
|---|---|
| A module gained or changed a capability | `PROJECT_CONTEXT.md` §8 *Implementation Status* |
| A phase started or finished | `ROADMAP.md` status and changelog, and the stage line in `PROJECT_CONTEXT.md` §8 |
| The owner made a decision | `PROJECT_CONTEXT.md` §10 *Decisions Log* (append) |
| A dependency was added | `TECH_DECISIONS.md` §2 and §10 |
| A new domain term entered the code | `PROJECT_CONTEXT.md` §6 (append) |
| A new approved UI pattern or token | `DESIGN_SYSTEM.md` §5–6 |
| An idea not for now | `ROADMAP.md` *Parked* |

Rules: **additive and minimal**, **facts only**, **append-only logs**, **dated** (YYYY-MM-DD), and **reported** in the task report.
