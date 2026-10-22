# 0008. AI review on pull requests

- Status: Accepted
- Date: 2026-10-22

## Context

SPEC §8 lists "an AI review step on pull requests (a reviewer prompt that checks against CLAUDE.md rules)" as a sensor. Lint, types and tests cannot check some rules: one concern per change, docs and ADRs kept up to date, tests that actually cover new behaviour, whether a change respects the approval-first design.

## Decision

- `.github/workflows/review.yml` runs `anthropics/claude-code-action`, pinned to the commit of `v1.0.257` (`e63e2e7e…`), on every non-draft pull request.
- The prompt makes CLAUDE.md the standard: the eight hard rules, the definition of done, and correctness bugs in changed lines. It skips anything ESLint, Prettier or tsc already enforce, and it only comments (no approve / request changes).
- Model `claude-sonnet-5-5`, at most 15 turns. Tools: read files, `gh pr diff/view/comment`, inline comments.
- It authenticates to GitHub with the job's own `GITHUB_TOKEN` (`contents: read`, `pull-requests: write`), not the Claude GitHub App: no third-party app to install, and the token expires with the job. Comments appear as `github-actions[bot]`. (Found on the first run, 2026-10-22: without the app, the default OIDC exchange fails with 401.)
- The repository owner adds the `ANTHROPIC_API_KEY` secret. Without it (and on fork PRs, which get no secrets), the job logs a skip and passes.
- From now on, changes land through branches and pull requests, so every change gets reviewed.

## Consequences

- Easy: the harness gets a sensor for rules that code checks cannot see; its comments are evidence for the harness log.
- Cost: each review is billed to the owner's API key (an estimate of a few cents per PR with Sonnet 5.5; not measured yet).
- Watch: review comments are model output, not rules. A comment that repeats should become a lint rule, test or skill (harness log).
- Watch: the action is pinned by commit; update it on purpose, like other dependencies (ADR 0007).

## Alternatives considered

- **No AI review until Phase 3:** cheaper, but the sensor is a Phase 0 harness item in SPEC §8.
- **Review on every push to main:** no place for inline comments, and no chance to fix before the change lands.
