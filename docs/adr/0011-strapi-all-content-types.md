# 0011. Strapi: the panel on every content type by default

- Status: Accepted
- Date: 2026-10-24
- Supersedes: part of ADR 0010, decision 5 (the plugin config lists the content types and names the body field)

## Context

Strapi's strength is that editors build their own content types. With ADR 0010 the panel appeared only on content types listed in `config/plugins.ts`, so every new type needed a developer to edit config. Fields were already read from each type's schema, so the list was the only obstacle.

## Decision

- Without a `contentTypes` setting, every content type the project defines (`api::…`) gets the panel, if it has at least one field the agent can use or a body.
- The body is the first `blocks` attribute, unless the config names one (`body: 'description'`) or turns it off (`body: false`).
- With `contentTypes`, only the listed types get the panel (an allowlist), each with the same optional `body`.
- Plugin types (`plugin::…`, such as Strapi's users) never get the panel by default.

## Consequences

- Easy: a new content type works with no config; the example project's Product type proves it in e2e.
- Watch: a type with several Blocks attributes uses the first one; a project that wants another names it in config.
- Not covered (unchanged): relations, media, enumerations, Markdown rich text, repeatable components and dynamic zones are not given to the agent.

## Alternatives considered

- **A settings page in the Strapi admin** to tick content types: friendlier for editors, but a page, storage and permissions for a choice most projects never change. Can come later on top of this default.
- **Keep the explicit list:** safest, but every content type needs a developer.
