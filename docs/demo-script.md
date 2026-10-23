# Demo video script (2–3 minutes)

> Recording moved to after Phase 4 (SPEC §7). Add a short Strapi segment before recording.

For the owner to record. Narration in English; timings are targets.

## Before recording

- Use https://margin-demo.fly.dev on a desktop browser at full width; zoom to 125% so text is readable.
- Record shortly after 10:00 UTC, or open the sample article ("Writing for the web") and check it is unchanged. It resets daily.
- Rehearse the prompts once: the real model's wording varies, but the flow is the same.
- Have the repository open in a second tab (README, `docs/harness-log.md`, one PR with the AI review).

## Shot list

### 1. The problem (0:00–0:15)

**Screen:** the editor with the sample article; the Agent panel on the right.

**Say:** "Most AI writing tools either chat next to your document or rewrite it for you. Margin puts an agent inside the editor, and it never changes anything without your approval."

### 2. Check, explain, refuse to invent (0:15–0:50)

**Do:** type "Check accessibility and fix what you can." and send.

**Show:** the status line ("Checking accessibility…"), the check result with the missing alt text, then the agent's reply.

**Say:** "The check runs on the server. The agent found an image without alt text, and it does not make one up: the article never says what the chart shows, so it asks me instead. Not inventing facts is one of its rules."

### 3. Propose, review, accept (0:50–1:25)

**Do:** type "Write a meta description." and send.

**Show:** the proposal card: the field, the agent's one-sentence reason, the diff. Click **Accept**; the Meta description field fills in.

**Say:** "Every change is a proposal: what changes, why, and a diff. When I accept, the editor changes and the agent is told. I could reject it with a reason instead, and Undo is there if I change my mind."

### 4. Speed tools (1:25–1:50)

**Do:** click **Shorter** in the Tone group. When the card arrives, point at it; then ask "Suggest a title and tags" and use **Accept all**.

**Say:** "Tone presets are one click. When the agent makes several proposals, I can review them one by one or accept them all at once."

### 5. Keyboard and accessibility (1:50–2:05)

**Do:** with the keyboard only: Tab to the message box, send a request, Shift+Tab to Accept, Enter.

**Say:** "Everything works from the keyboard, focus lands somewhere sensible after each answer, and new proposals are announced to screen readers."

### 6. How it works (2:05–2:25)

**Screen:** README architecture section.

**Say:** "Under the hood the panel speaks AG-UI: streamed text, shared editor state, and frontend tool calls that become these cards. The panel only knows an `EditorHost` interface, so it can move into Strapi or WordPress later."

### 7. How it was built (2:25–2:50)

**Screen:** `docs/harness-log.md`, then a pull request with the AI review comment.

**Say:** "The whole codebase was written by Claude Code inside a harness: rules and skills before it acts, strict types, boundary lint rules, tests with a mock model, axe checks and an AI review after it acts. When it repeats a mistake, the fix becomes a new rule or check, and this log is the record."

### 8. Close (2:50–3:00)

**Screen:** the live URL and the repository URL.

**Say:** "It is live at margin-demo.fly.dev, and the code and the harness are on GitHub."

## If something goes wrong on camera

- **"The demo has used today's agent runs":** the daily cap (300) was hit; record the next day or raise `DAILY_AGENT_RUN_LIMIT` in `fly.toml` and redeploy.
- **The agent proposes something odd:** reject it with a reason. That is part of the story.
- **Slow first reply:** the machine is always on, so this is the model; keep talking over it.
