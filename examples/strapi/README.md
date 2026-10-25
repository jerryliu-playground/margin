# Example Strapi project

A local Strapi 5 project for developing and testing the Margin plugin (`plugins/strapi`, ADR 0010). It has two content types: **Article** (title, slug, summary, a Blocks `body` and an `seo` component with `metaTitle` and `metaDescription`), which seeds one sample article on first start, and **Product** (name, tagline, price, a Blocks `description` and the same `seo` component), which no plugin config names, to show that any content type gets the panel (ADR 0011). SQLite, nothing to set up.

```bash
pnpm dev:strapi   # from the repository root; admin at http://localhost:1337/admin
```

The first run writes `.env` with fresh local secrets. Set `MARGIN_EXAMPLE_ADMIN_EMAIL` and `MARGIN_EXAMPLE_ADMIN_PASSWORD` there to get an admin without the sign-up screen. Delete `.tmp/` to start from an empty database.
