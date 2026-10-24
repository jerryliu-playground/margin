# Example Strapi project

A local Strapi 5 project for developing and testing the Margin plugin (`plugins/strapi`, ADR 0010). It has one content type, **Article** (title, slug, summary, a Blocks `body` and an `seo` component with `metaTitle` and `metaDescription`), and seeds one sample article on first start. SQLite, nothing to set up.

```bash
pnpm dev:strapi   # from the repository root; admin at http://localhost:1337/admin
```

The first run writes `.env` with fresh local secrets. Set `MARGIN_EXAMPLE_ADMIN_EMAIL` and `MARGIN_EXAMPLE_ADMIN_PASSWORD` there to get an admin without the sign-up screen. Delete `.tmp/` to start from an empty database.
