# DESIGN_SYSTEM

> How should Relay look, feel and behave?
> Read `PROJECT_CONTEXT.md` first. The UI exists to make a busy team's task list easy to scan.

Status: **v1.1**, 2026-10-29 (v1.1 adds §5.3 meaning language and §5.9 density and interaction, pending owner review)

Source of the visual language: the Refero style `https://styles.refero.design/style/031056ff-7af1-46db-8daa-115f731c5d26` (an editorial, warm-neutral style). Component source: shadcn/ui, plus ElevenLabs UI (`https://ui.elevenlabs.io`) only where a component fits.

---

## 1. UI Stack

| Layer | Choice | Notes |
|---|---|---|
| Components | **shadcn/ui**, code copied into `src/components/ui/` and owned by us | Adapted to our tokens. |
| Primitives | **Base UI**. Radix is not used. | One headless primitive library. |
| Styling | **Tailwind CSS 4** with CSS-variable tokens | No hardcoded colors or one-off values in components. |
| Icons | `lucide-react` | One icon set. |
| ElevenLabs UI | Optional shadcn registry (`npx shadcn@latest add https://ui.elevenlabs.io/r/<component>.json`) | Mostly audio and agent components (orb, waveform, voice). Our product has little need for them. Add one only with a stated reason. |

Rules:
- New UI starts from an existing shadcn component. Otherwise build on Base UI primitives.
- Components in `components/ui/` hold **no business logic**.
- Check that any ElevenLabs UI component does not pull in Radix before adding it.

---

## 2. Design Principles

1. **Scan first.** A user should read a task's status, priority, owner and age in one glance.
2. **Calm and editorial.** Warm neutrals, light type, hairlines instead of heavy boxes.
3. **Color only for meaning.** Status, priority and env colors are the only strong colors. Never decorative.
4. **Dense where it counts.** The task table is dense. Settings and forms are airy.
5. **Reply debt is visible.** Unreplied and forgotten threads are always one click away.
6. **Fast and quiet.** Instant feedback, minimal motion.
7. **Accessible.** Color is never the only signal.

---

## 3. Anti-Patterns

Never use these without a specific product reason:

- gradients and glow in the app (the Refero style uses gradient "audio spheres" only in marketing artwork)
- glassmorphism and frosted panels
- heavy or blurred drop shadows
- rows of identical decorative stat cards
- random pills and badges
- decorative blobs, grid backgrounds, noise textures
- emoji as UI elements
- bold display type (see §5)

---

## 4. Theme

- **Light theme only for now.** The Refero style defines no dark mode.
- A dark theme is a future, owner-approved addition. **Do not invent dark values.**

---

## 5. Foundations (from the Refero style)

Components use **semantic tokens only**, never raw values. Three layers: primitive → semantic → component.

### 5.1 Color: neutrals (primitive)

| Name | Hex | Semantic use |
|---|---|---|
| Ink | `#000000` | Primary text, filled buttons, links |
| Graphite | `#44403b` | Strong secondary text, section labels |
| Smoke | `#777169` | Body text, muted descriptions |
| Ash | `#a59f97` | Helper text, tertiary |
| Stone | `#ebe8e4` | Hairline borders, dividers |
| Warm Taupe | `#f5f3f1` | Section bands, secondary surface, cards |
| Eggshell | `#fdfcfc` | Page canvas, button and card surfaces |

Surface stack: **Eggshell** (canvas) → **Warm Taupe** (bands, cards) → **Stone** (plates and dividers). Pure white and pure gray are avoided.

### 5.2 Color: accents

| Name | Hex | Rule |
|---|---|---|
| Violet Spark | `#0447ff` | Reserved for focus ring and links if needed. Not for chrome or status. |
| Ember Orange | `#ff4704` | Reserved for error/destructive emphasis if needed. |

### 5.3 Meaning language (decided 2026-10-29, owner may veto)

The Refero style has no status, priority or environment colors. Rather than add a rainbow, Relay carries meaning by **shape first, color second**. The whole app stays achromatic except one accent.

| Meaning | Treatment |
|---|---|
| **Status** | A 14px glyph plus its label. Backlog: dashed ring (Ash). To do: hollow ring (Smoke). In progress: ring with a filled half (Ink). In review: ring with a dot (Ink). Blocked: filled **Ember** disc with a dash. Done: filled Ink disc with a check, label muted. |
| **Priority** | Three ascending bars plus the label. Low 1 bar, Medium 2, High 3 (Ink). Urgent: 3 bars in **Ember**. Unfilled bars are Stone. |
| **Environments** | Four fixed slots in pipeline order `L D S P` (local, development, staging, production). Deployed slots are filled Ink squares, the rest are hairline outlines in Ash. Screen readers get the full names. |
| **Changes in** | Small mono tags with a hairline ring (`FE`, `BE`, `DB`…). |
| **Needs attention** | A 6px **Ember** dot beside the word "Forgotten". Age is shown as a large light number. |

Rules:
- **Ember `#ff4704` is the only signal color**: blocked, urgent, forgotten, unsaved changes, and destructive actions. Never decorative.
- Meaning is never color alone: every glyph has a distinct shape and a text label.
- Ember on Eggshell is about 3.4:1, which fails AA for small text. Use it for glyphs and dots, never for body text. Text that sits beside an Ember dot stays Ink.
- Violet Spark `#0447ff` is used only for the focus ring and text selection tint.

### 5.4 Typography

| Font | Use |
|---|---|
| **Waldenburg** (fallback Inter 300) | Display and headings, 32px and up, **weight 300 only**, never bold |
| **Inter** | Everything else. Weights 400 and 500 |
| **Geist Mono** | Technical micro-copy only (IDs, Slack timestamps, ticket keys), 13px |

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| caption | 10–12px | 400 | 1.6 | normal |
| body-sm | 14px | 400 | 1.5 | 0.14px |
| body | 16px | 400 | 1.5 | 0.16px |
| subheading | 18px | 400 | 1.6 | normal |
| heading-sm | 32px | 300 | 1.13 | −0.64px |
| heading | 36px | 300 | 1.17 | −0.72px |
| display | 48px | 300 | 1.08 | −0.96px |

Waldenburg is a licensed font. Until it is licensed and added, use **Inter 300** for headings. Table text and controls use Inter 14px. Numbers in the table use tabular figures.

### 5.5 Spacing and layout

- Base unit **4px**. Scale: 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96.
- Max content width 1280px, centered. The task table may use the full width.
- Card padding 32px (settings, forms). Table cell padding is compact (8–12px). Element gap 8–16px.

### 5.6 Radius

| Element | Radius |
|---|---|
| Pill buttons, tags, chips | 9999px |
| Large cards | 24px |
| Cards | 20px |
| Small elements | 4–10px |
| Inputs | 4px |

### 5.7 Borders and elevation

- **Hairlines:** 1px solid Stone `#ebe8e4`. Preferred over whitespace for section breaks.
- Button outline: 1px solid `#e5e5e5`.
- Elevation (sparing): `rgba(0,0,0,0.4) 0 0 1px, rgba(0,0,0,0.04) 0 1px 1px, rgba(0,0,0,0.04) 0 2px 4px`.
- Flat or near-flat is the default. No heavy drop shadows.

### 5.8 Motion

One easing, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out quint), and short durations so the UI feels instant: **75ms** for hover, press and color changes; **100–150ms** for dialogs, drawers and popovers; **160ms** for the page entrance (6px rise plus fade). Actions never wait for the server: create, edit, delete, assign, dismiss and comment update the screen first (optimistic) and call the API after, rolling back with a message on failure. Loading uses shimmer placeholders, never spinners or blank screens.
- Buttons and pills press to `scale(0.97)`. Skeletons shimmer. New chips, comments and empty states "pop" in (220ms).
- Optimistic updates: status changes appear instantly and roll back with a toast if the server refuses them.
- Nothing animates for its own sake. `prefers-reduced-motion` collapses every animation and transition to near zero.

### 5.9 Density and interaction (decided 2026-10-29)

- **Compact header.** The title, counts, search and quick views take one slim row. The arrow beside the title opens the dropdown filters (remembered per browser). Board is reached from the Table/Board switch inside Tasks, not the top menu.
- **Fit the screen.** Tasks, Board and Activity never scroll the page. The table rows, each board column and the activity feed scroll inside their own area; headers stay pinned.
- **Resizable task panel.** Hover the left edge of the task panel to see a line, drag to resize (remembered), double-click to widen or restore, drag it away to close.
- Table rows have two densities, **Comfortable** (default) and **Compact**, remembered per browser. Header row is sticky, the whole row opens the task, and row actions appear on hover or focus.
- Keyboard: `/` focuses search, `N` opens New task, `Esc` closes drawers and dialogs, `⌘/Ctrl + S` saves the open task, `⌘/Ctrl + Enter` sends a comment.
- Quick views (Mine, Unassigned, Blocked, Urgent, Hide done) toggle a single filter each and combine with every other filter. Active filters appear as removable chips.
- Toasts are Ink pills with Eggshell text. Dialogs and drawers use a 20px radius, a hairline border and the whisper shadow.

### 5.10 Dropdowns (one primitive each)

Never use native `<select>`, `<datalist>` or `<input type="date">`: browsers render them in their own style and Relay cannot theme them. Use:
- `OptionSelect` (`components/ui/option-select.tsx`) for choosing one value. `variant="field"` in forms, `variant="pill"` in filter bars. Options can carry an icon (status and priority glyphs).
- `SuggestInput` for free text with suggestions (e.g. module).
- `DatePicker` for dates (value `yyyy-mm-dd`).
- `MultiSelectFilter` for choosing several values.
All four share the 12px radius, hairline border and whisper shadow of the menus. Tests open them by label and click the option (`choose()` in `e2e/helpers.ts`).

### 5.11 Emails

Auth emails use the same language: Warm Taupe page, Eggshell card with a Stone hairline and 20px radius, Helvetica Neue light headline (Inter and Waldenburg are not safe in email clients), one black pill button, and a plain-text fallback link. They are generated from one layout in `scripts/build-email-templates.mjs` into `supabase/templates/`. Email HTML must stay table-based with inline styles.

### 5.12 Breakpoints ⏳

Desktop first (the table is the main work surface). Tablet and mobile web must remain usable for reading and commenting. Exact breakpoints are decided at implementation using Tailwind defaults.

---

## 6. Components

### 6.1 From the Refero style

| Component | Spec |
|---|---|
| **Primary button** | Ink fill, Eggshell text, pill, 16px horizontal padding, Inter 14px/500, 1px `#e5e5e5` border |
| **Secondary button** | Eggshell fill, Ink text, pill, 14px horizontal padding, Inter 14px/500, 1px `#e5e5e5` border |
| **Ghost button** | Transparent, Ink text, pill, Inter 14px/500. Fill on hover only |
| **Card (taupe)** | `#f5f3f1` fill, 20px radius, 32px padding, no border or shadow |
| **Elevated card** | Eggshell fill, 20px radius, 16px padding, whisper shadow. Sparingly |
| **Tab pill** | Eggshell fill, Ink text, pill, 1px border. Active shown by a small dot |
| **Divider** | 1px Stone line |
| **Input** | 4px radius, Stone border, Inter 14px |
| **Top nav** | About 50px, transparent on Eggshell |

### 6.2 Relay patterns ⏳ (designed during Phase 2)

| Pattern | Purpose |
|---|---|
| **Task table** | Dense, sortable, filterable table with column visibility, sticky header, and a row detail drawer |
| **Task row detail** | Side drawer with description, assignees, status, env, comments chat |
| **Status / Priority glyph** | Shape-based, see §5.3 |
| **Env strip** | Four-slot pipeline strip, see §5.3 |
| **Sync status bar** | Top of the page: last sync time, new/updated counts, errors |
| **Needs-attention list** | Unreplied and forgotten threads with age |
| **Kanban board** | Columns by status, draggable cards |
| **Comment thread** | Chat-style internal comments, realtime |
| **Activity log row** | Actor, action, target, time |
| **Empty / error / loading states** | Per page |

Each approved pattern is added here with purpose, when to use, variants, states, responsive behavior and accessibility.

---

## 7. Design for Real Data

Every screen must handle:

- **States:** loading, empty (first-time and filtered-to-nothing), error, partial data
- **Extremes:** very long titles and descriptions, 500+ tasks, many assignees, many comments, many filters active
- **Sync realism:** a sync in progress, a failed sync, stale data (not synced for days), thousands of unreplied threads after a client burst
- **Missing values:** no assignee, no module, no Jira link. Show an em dash `—`, never an empty cell or `null`.

---

## 8. Data Display Rules

| Data | Rule |
|---|---|
| **Dates** | Shown in the user's timezone. Relative time ("3 h ago") with the exact date on hover. |
| **Age of unreplied** | Always shown, with the forgotten threshold visible. |
| **Slack link** | Opens in a new tab. Labelled "Slack", with an external-link icon. |
| **Jira key** | Monospace (Geist Mono), links to the ticket. |
| **Counts** | Show the count next to each filter and tab. |
| **Missing** | Em dash `—` with a hover explanation where helpful. |

---

## 9. Accessibility Baseline

Target **WCAG 2.2 AA**.

- Contrast ≥ 4.5:1 for text and ≥ 3:1 for UI elements. **Check Smoke `#777169` and Ash `#a59f97` on Eggshell and Taupe.** Ash likely fails 4.5:1, so use it for non-essential helper text only.
- Everything works by keyboard with a visible focus ring and logical tab order. Dialogs and drawers trap focus (Base UI provides this).
- Every input has a label. Errors are announced and linked to their fields.
- Color is never the only signal.
- Respect `prefers-reduced-motion`.
- Touch targets ≥ 24×24px.

---

## 10. Workflow (shortened)

The design system is chosen, so the staged low-fi and hi-fi artboard process is skipped.

```text
1. PLAN      → short plan per screen, owner approval for major screens
2. IMPLEMENT → build with tokens and components from this doc
3. VALIDATE  → run the app, compare against this doc, check loading/empty/error states
4. EVOLVE    → add approved reusable patterns and tokens to this doc
```

Stop and ask the owner when a screen needs a token, color or pattern not defined here.

---

## 11. Evolution

When a new reusable pattern is approved:
1. Add it to §6.2 with purpose, variants, states, responsive behavior and accessibility.
2. Add any new tokens to §5.
3. Future UI reuses it. No one-off recreations.

Token and pattern additions after approval are living updates. Changing a principle (§2) or a rule (§3, §8, §9) needs owner approval.
