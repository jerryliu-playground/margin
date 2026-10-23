# Domain glossary

Use these names in code, tests and copy.

| Term                | Meaning                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document**        | One article: fields plus a body. Stored on the server.                                                                                                                       |
| **Field**           | A named, non-body value of a document: `title`, `slug`, `summary`, `metaDescription`, `tags`. Hosts declare their fields with a `FieldDescriptor`.                           |
| **Field value**     | `string`, or `string[]` for `tags`.                                                                                                                                          |
| **Body**            | The rich-text content, as an ordered list of blocks.                                                                                                                         |
| **Block**           | One top-level unit of the body (paragraph, heading, list, quote, image…). Agent-facing shape: `BodyBlock { blockId, type, text, attrs? }`; an image's text is `![alt](src)`. |
| **Block id**        | Opaque, host-issued id of a block, stable for the editing session.                                                                                                           |
| **Base hash**       | Hash of a block's `text` when a proposal was made. Used to detect stale proposals.                                                                                           |
| **Document state**  | What the agent sees: field values plus body blocks. Sent as AG-UI shared state.                                                                                              |
| **Host**            | The editor the panel runs in (our demo, Strapi, WordPress). Implements `EditorHost`.                                                                                         |
| **Outdated**        | A pending body proposal whose block changed since it was made. It can only be dismissed, which answers `stale`.                                                              |
| **Proposal**        | A suggested change from the agent, shown as a card with old vs new. Kinds: field proposal, body proposal. States: `pending`, `accepted`, `rejected`, `stale`, `undone`.      |
| **Accept / Reject** | The user's answer to a proposal. Accept applies it to the editor (not saved). Reject may carry a reason.                                                                     |
| **Undo**            | Restores what an accepted proposal replaced, only while the value is still exactly as Accept left it. The agent is told on its next run (AG-UI `context`).                   |
| **Interrupt**       | The pause between a frontend tool call and the user's answer. The run ends; the next run carries the answer.                                                                 |
| **Frontend tool**   | A tool the agent calls that runs in the browser (`proposeFieldValue`, `proposeBodyEdit`).                                                                                    |
| **Server tool**     | A tool that runs on the server (`a11yCheck`, `seoCheck`).                                                                                                                    |
| **Run**             | One AG-UI request/stream from `RUN_STARTED` to `RUN_FINISHED` or `RUN_ERROR`.                                                                                                |
