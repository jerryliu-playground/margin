import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  summary: text('summary').notNull(),
  metaDescription: text('meta_description').notNull(),
  /** JSON array of strings. */
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),
  /** TipTap JSON (ADR 0001). */
  body: text('body', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type DocumentRow = typeof documents.$inferSelect;
