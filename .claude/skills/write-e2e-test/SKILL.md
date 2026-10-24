---
name: write-e2e-test
description: Conventions for writing Margin's Playwright end-to-end tests, including mocking the model, accessibility checks and selectors. Use whenever a task adds or changes an e2e test in e2e/.
---

# Write an e2e test

## Setup you get for free

`playwright.config.ts` starts two servers before the tests:

- `apps/server` with `MARGIN_MODEL=mock` and `NODE_ENV=test` on `http://127.0.0.1:18787` (a dedicated port; `reuseExistingServer` is off; rate limits lifted, because the suite makes many agent runs per minute; test rate limiting with `app.inject()` instead);
- a production build of `apps/web` (`vite preview`) on `http://localhost:14173`, pointing at that server.

Never set `MARGIN_MODEL=anthropic` or an API key in a test (CLAUDE.md rule 5). If a test needs a specific agent answer, add a scripted reply to the server's mock model (keyed by the user's message), not a network intercept in the browser. The point of e2e is to exercise the real AG-UI stream.

## Rules

1. **Files:** `e2e/<feature>.spec.ts`, one user flow per `test`.
2. **Selectors:** by role and accessible name (`getByRole('button', { name: 'Accept' })`). No CSS classes or test ids unless there is no accessible name, and then fix the accessibility first.
3. **Waiting:** use web-first assertions (`await expect(locator).toBeVisible()`). Never `waitForTimeout`.
4. **Accessibility:** every test that renders a new screen or card runs
   ```ts
   const axe = await new AxeBuilder({ page }).analyze();
   expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
   ```
5. **Keyboard:** user flows that matter get one keyboard-only test (see `tabTo` in `e2e/a11y.spec.ts`): reach controls with Tab / Shift+Tab, act with Enter.
6. **Focus:** after Accept or Reject, assert where focus went (`await expect(locator).toBeFocused()`).
7. **Approval flows** need both sides: an Accept test that checks the value changed (and is saved, if the flow saves), and a Reject test that checks nothing changed.
8. **Isolation:** each test creates the document it needs (`createDocument` in `e2e/helpers.ts`); don't depend on another test's data. The seeded article is read-only for tests.
9. **Scope every lookup.** The editor form and the agent panel share roles and labels (two `status` regions; a proposal card is named after the field it changes). Use `field(page, 'Title')` for form fields, `panel(page)` for the panel, and `page.getByRole('main')` for anything else in the editor. Unscoped `page.getByLabel(...)` / `page.getByRole('status')` will hit strict-mode errors.

## When a test finds a problem

Fix it in its own commit (with a unit test if it is logic), then commit the e2e test. Do not fold product changes, config or other docs into the test commit (CLAUDE.md rule 8 is per commit).

## Driving the agent

The mock model (`apps/server/src/agent/mock-model.ts`) answers by keyword in the last user message:

| Message contains                         | Reply                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `accessibility`                          | `a11yCheck` on the server, then an issue list and an image alt-text proposal                           |
| `check seo`                              | `seoCheck` on the server, then an issue list and a meta description proposal if missing                |
| `meta description`                       | text + `proposeFieldValue(metaDescription)` from the first paragraph                                   |
| `title and tags`                         | two proposals in one turn                                                                              |
| `title` / `tags`                         | one `proposeFieldValue`                                                                                |
| `more formal` / `shorter` / `friendlier` | a tone rewrite of the longest paragraph as one `proposeBodyEdit` (the panel's Tone buttons send these) |
| `tighten`                                | `proposeBodyEdit` on the longest paragraph (keeps the first sentence)                                  |
| anything else                            | a short help text                                                                                      |

After a tool result it replies in one sentence (`Done. Save the document…`, `OK, I left it unchanged. Noted: <reason>`, …). Add a keyword there when a new flow needs a scripted answer; keep it deterministic.

## Strapi plugin tests

`e2e-strapi/` holds the tests of `plugins/strapi` (ADR 0010). `playwright.strapi.config.ts` starts the Margin server (mock model) and a fresh `examples/strapi` with the plugin built from source; every secret there is a local test value. Use the helpers in `e2e-strapi/helpers.ts`: `signIn` (turns Strapi's guided tour off), `createArticle` / `readArticle` through Strapi's admin API (each test owns its article), `panel`, `ask`, and `expectPanelHasNoAxeViolations` (axe on our panel only, not Strapi's admin). Strapi labels fields by attribute name (`metaDescription`); the agent's card names them `SEO › Meta description`.

## Run

```bash
pnpm e2e                         # all
pnpm e2e e2e/smoke.spec.ts       # one file
pnpm e2e:strapi                  # the Strapi plugin (slow: builds Strapi's admin)
```

On failure, open the trace that Playwright prints (`pnpm exec playwright show-trace …`) before changing code.
