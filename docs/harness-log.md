# Harness log

Every time the agent makes the same kind of mistake twice, or the owner corrects the same thing twice, add an entry. Each entry names the guide or sensor added to prevent it.

| Date       | Mistake (seen twice)                                                                                                                                                         | Fix: guide or sensor                                                                                                                                                                                                                                               | Where                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 2026-10-22 | E2E locators matched both the editor form and the agent panel (`getByRole('status')`, then `getByLabel('Meta description')` matched a proposal card titled the same).        | Guide: e2e helpers `field()` and `panel()` scope every lookup; rule added to the `write-e2e-test` skill.                                                                                                                                                           | `e2e/helpers.ts`, `.claude/skills/write-e2e-test/SKILL.md` |
| 2026-10-22 | Scripted edits to Markdown tables and TS signatures missed their target after Prettier had reflowed the text (seen 3 times; the third silently dropped a mock-model branch). | Guide: edit first, format once at the end; match on short unique substrings, never on padded table rows. Every scripted replace asserts that it matched, so a miss fails loudly. Sensor: `run.test.ts` now runs the AG-UI client's `verifyEvents` on every stream. | this log (agent working note)                              |

## Clarifications

- 2026-10-22 — **Rule 8 was ambiguous.** The first AI review of PR #1 read "one concern per change" as one concern per pull request and asked to split the Phase 2 PR, whose commits each held one concern. Owner's decision: rule 8 is per commit; a PR may group single-concern commits from one approved plan. Guide: CLAUDE.md rule 8 reworded. Sensor: the review prompt judges rule 8 per commit.

## Phase 0 baseline

Guides and sensors in place at the start (2026-10-21):

- Guides: `CLAUDE.md`, `SPEC.md`, `docs/architecture.md`, `docs/domain.md`, `docs/adr/`, skills `add-agent-tool` and `write-e2e-test`.
- Added in Phase 2: skill `add-document-field`; sensors `verifyEvents` on every agent stream, axe on every screen and card state, a keyboard-only e2e, and the AI review on pull requests (2026-10-22).
- Sensors: `tsc --noEmit` (strict), ESLint boundary rules with fix-it messages, Prettier check, Vitest, Playwright smoke + axe, CI on every push and PR.
