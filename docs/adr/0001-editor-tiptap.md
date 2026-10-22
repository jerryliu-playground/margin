# 0001. Editor: TipTap v3 with UniqueID

- Status: Accepted
- Date: 2026-10-21

## Context

`proposeBodyEdit(blockId, …)` replaces one top-level block. We need block ids that survive split, merge, paste, undo and a JSON save/load round trip; a reliable programmatic "replace block by id"; an undo stack (Phase 2); keyboard accessibility; MIT-compatible licensing; React 18 support.

## Decision

Use TipTap v3 in `apps/web` only:

- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-unique-id` (all MIT, 3.32.0).
- `UniqueID` is configured for every top-level block type; the id attribute is `id`.
- A block is replaced by finding its position among the doc's top-level children and running one `tr.replaceWith` transaction, so one Undo reverts one accepted change.
- TipTap JSON is an `apps/web` implementation detail. The agent and the panel only see the host-neutral body from ADR 0006.

## Consequences

- Easy: ids are attributes, so they persist in the saved JSON.
- Watch: duplicate ids after pasting the same block twice is not documented. A test must cover it before Phase 1 is done.
- Watch: if Collaboration (Yjs) is ever added, the editor mounts only after the provider syncs.

## Alternatives considered

- **BlockNote**: best block-id API and a Strapi-like JSON shape, but pre-1.0, MPL-2.0 core and GPL `xl-*` packages. Runner-up.
- **Lexical**: `NodeKey` is runtime-only; we would build our own ids with `NodeState`.
- **Slate / Plate**: no ids in Slate; Plate has an id plugin but paid parts and a heavier surface.

Sources: https://tiptap.dev/docs/editor/extensions/functionality/uniqueid, npm registry.
