# Relay

Internal team tool: turns a client's Slack channel into a managed task board. Next.js + Supabase. Claude syncs Slack (read-only) into the app through an API.

**Before any work, read the context docs in `docs/ai-context/`**, in this order:

<!-- context-index -->
- `PROJECT_CONTEXT.md`: what we're building and why, modules, status, decisions
- `TECH_DECISIONS.md`: the stack and how to choose technology
- `ENGINEERING_STANDARDS.md`: structure, naming, API, DB, roles, security, testing
- `DESIGN_SYSTEM.md`: Refero style tokens, components, accessibility
- `AI_WORKFLOW.md`: how AI agents work here, including the Slack sync protocol
- `ROADMAP.md`: phases and what's next
<!-- /context-index -->

Commands: `npm run dev`, `npm test` (unit), `npx playwright test e2e/<file>.spec.ts` (e2e, see `AI_WORKFLOW.md` §6.5), `npm run lint`, `npm run typecheck`, `npm run build`. Push database changes with `npx supabase db push --linked` (dry-run first with `--dry-run`).

Do NOT drive the browser click by click with screenshots. Write or extend a Playwright spec in `e2e/`, run it headless, and read only failures. Test accounts per role are in `.env.e2e`.

Hard rules:
- Slack is **read-only**. Never send, reply or react.
- Never put secrets in the repo, the browser bundle or chat. Keys live in `.env.local`.
- No native `<select>`, `<datalist>` or date inputs: use `OptionSelect`, `SuggestInput`, `DatePicker` (`DESIGN_SYSTEM.md` §5.10).
- Deletes are soft. Permissions are enforced in RLS and the server, not only the UI.
- Never invent design tokens or colors. Status, priority and env use the shape-based language in `DESIGN_SYSTEM.md` §5.3. Ember is the only signal color.
