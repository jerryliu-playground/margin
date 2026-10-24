# Look plan

Approved by the owner on 2026-10-24. One concern per commit; each commit passes `pnpm check` on its own (CLAUDE.md rule 8).

**Goal:** the demo looks like a finished product, works in dark mode, and the panel can take on a host's theme (Strapi next, Phase 4). No behaviour changes, no new dependencies.

**Resuming:** compare the steps with `git log --oneline`. Each step's commit subject starts with its tag (e.g. `L3`). Start at the first unticked step and tick it in the same commit.

## Decisions

1. **Design tokens are CSS custom properties.** The panel's tokens (`--margin-*`) live in `packages/agent-panel/src/tokens.css` and are declared with zero specificity (`:where(.margin-panel)`), so any host rule on `.margin-panel` overrides them. The demo app's tokens (`--app-*`) live in `apps/web/src/tokens.css`, and the app sets the panel's tokens from its own: the same mechanism a Strapi or WordPress host will use.
2. **Dark mode follows the system** (`prefers-color-scheme`) in the demo app. The panel ships light defaults only; a host gives it dark colours by overriding its tokens.
3. **Raw colours only in token files.** A small check (`scripts/check-colors.mjs`, part of `pnpm lint`) rejects hex, `rgb()` and `hsl()` colours anywhere else in `apps/web/src` and `packages/agent-panel/src`.
4. **No new dependencies.** System font stacks (serif for the document, sans for the interface), inline SVG if an icon is needed.
5. **Selectors and accessible names stay the same**, so the e2e tests keep proving behaviour. axe runs in light and dark.

## Steps

PR (`look` branch):

- [ ] **L1 Design tokens**: move every colour, radius and spacing value into the two token files; no visual change. `packages/agent-panel`, `apps/web`.
- [ ] **L2 Colour check**: `scripts/check-colors.mjs` in `pnpm lint`, with a message that says which token file to use; CLAUDE.md commands updated. Root.
- [ ] **L3 Editor page**: top bar (app name, link to all documents, save state), fields grouped into "Content" and "Search and sharing", a reading-width body in a serif face, primary Save button. `apps/web`.
- [ ] **L4 Panel**: message bubbles, the message box pinned at the bottom of the panel, cards with a status badge, a primary Accept button and secondary Reject/Undo. `packages/agent-panel`.
- [ ] **L5 Document list**: documents as cards with relative times ("2 days ago") and an empty state. `apps/web`.
- [ ] **L6 Dark mode**: dark values for the app tokens, mapped into the panel; axe runs on every screen and card state in both schemes. `apps/web`, `e2e/`.

After each step the owner gets a screenshot before the next one starts.
