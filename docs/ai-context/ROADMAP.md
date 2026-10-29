# ROADMAP

> What's next and why?

Status: **v1.1**, 2026-10-29

Legend: ⬜ not started · 🟦 in progress · ✅ done

---

## 1. Where We Are <!-- LIVING -->

Phases 1–4 are built, tested and styled. What remains is owner setup (Resend, first sign-in, API key), a first real Slack sync, and tuning from real use.

---

## 2. Phases

### Phase 1: Foundation ✅
- Next.js app scaffold, tooling, env validation
- Supabase schema: profiles, roles, tasks base, RLS
- Auth: sign in, forgot password, change password
- Users: add, invite, resend invite, edit, delete (Super Admin and PM)
- Resend SMTP for invite and reset emails (owner setup, still pending)
- Design tokens and base shadcn components

**Gate:** a Super Admin can sign in, invite a user, the user accepts, and role permissions are enforced and tested.

### Phase 2: Tasks ✅
- Task table with all columns, filters and search
- Parent and sub-tasks, edit, delete (soft)
- Multiple assignees, tags, module, env status, changes-in
- Internal comments (realtime)
- Kanban view
- Task detail drawer

**Gate:** the team can manage tasks end to end from manually entered data.

### Phase 3: Claude sync ✅
- `/api/v1` endpoints, API key management
- Idempotent `/sync` batch, sync runs, sync status bar
- Slack-user mapping and assignee auto-select
- Claude skill file for the sync flow

**Gate:** "sync the client channel" creates and updates tasks without duplicates and without overwriting human edits.

### Phase 4: Attention and polish ✅
- Needs-attention section (unreplied, forgotten) with a configurable threshold
- Jira link and mirrored status
- Project-wide Activity Log
- Settings page, empty/error states, accessibility pass

**Gate:** the team uses Relay as the daily source of truth for client requests.

---

## 3. Parked

- Dark theme (not defined in the Refero style)
- Multiple client channels
- Waldenburg font licensing
- Verify native drag-and-drop on the board by hand (Playwright cannot drive it)
- Rate limiting on sign-in and API-key routes beyond Supabase's own limits
- Reuse of a deleted user's email address (the auth user is banned, not removed)
- Mobile layout review

---

## 4. Changelog <!-- LIVING: append-only -->

| Date | Change |
|---|---|
| 2026-10-29 | Context docs written. Phase 1 started. |
| 2026-10-29 | Next.js scaffold, env validation, Supabase clients, role matrix with tests, and foundation migration written. |
| 2026-10-29 | Tasks, board, comments, filters, sync API, needs-attention, activity log, settings, API keys, Claude skill built. 51 Playwright and 40 unit tests pass. Design pass applied. |
