import type {
  CreateDocumentRequest,
  Document,
  DocumentSummary,
  UpdateDocumentRequest,
} from '@margin/shared';
import { EMPTY_BODY, documentSchema } from '@margin/shared';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { documents, type DocumentRow } from '../db/schema';

function toDocument(row: DocumentRow): Document {
  // Rows are written only through this module, so a parse failure means corrupted data.
  return documentSchema.parse(row);
}

export function createDocumentRepository(db: Db, now: () => Date = () => new Date()) {
  return {
    list(): DocumentSummary[] {
      return db
        .select({ id: documents.id, title: documents.title, updatedAt: documents.updatedAt })
        .from(documents)
        .orderBy(desc(documents.updatedAt))
        .all();
    },

    get(id: string): Document | undefined {
      const row = db.select().from(documents).where(eq(documents.id, id)).get();
      return row && toDocument(row);
    },

    create(input: CreateDocumentRequest, id: string = crypto.randomUUID()): Document {
      const row: DocumentRow = {
        id,
        title: input.title ?? '',
        slug: input.slug ?? '',
        summary: input.summary ?? '',
        metaDescription: input.metaDescription ?? '',
        tags: input.tags ?? [],
        body: input.body ?? EMPTY_BODY,
        updatedAt: now().toISOString(),
      };
      db.insert(documents).values(row).run();
      return toDocument(row);
    },

    update(id: string, input: UpdateDocumentRequest): Document | undefined {
      const row = db
        .update(documents)
        .set({ ...input, updatedAt: now().toISOString() })
        .where(eq(documents.id, id))
        .returning()
        .get();
      return row && toDocument(row);
    },

    count(): number {
      return db.select({ id: documents.id }).from(documents).all().length;
    },

    deleteAll(): void {
      db.delete(documents).run();
    },

    isEmpty(): boolean {
      return db.select({ id: documents.id }).from(documents).limit(1).all().length === 0;
    },
  };
}

export type DocumentRepository = ReturnType<typeof createDocumentRepository>;
