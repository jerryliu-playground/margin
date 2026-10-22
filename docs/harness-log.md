# Harness log

Every time the agent makes the same kind of mistake twice, or the owner corrects the same thing twice, add an entry. Each entry names the guide or sensor added to prevent it.

| Date | Mistake (seen twice) | Fix: guide or sensor | Where |
| ---- | -------------------- | -------------------- | ----- |
| —    | —                    | —                    | —     |

## Phase 0 baseline

Guides and sensors in place at the start (2026-10-21):

- Guides: `CLAUDE.md`, `SPEC.md`, `docs/architecture.md`, `docs/domain.md`, `docs/adr/`, skills `add-agent-tool` and `write-e2e-test`.
- Sensors: `tsc --noEmit` (strict), ESLint boundary rules with fix-it messages, Prettier check, Vitest, Playwright smoke + axe, CI on every push and PR.
