import { z } from 'zod';
import { documentContentSchema, documentSchema } from './document';

/** POST /documents: every field optional; the server fills defaults. */
export const createDocumentRequestSchema = documentContentSchema.partial();
export type CreateDocumentRequest = z.infer<typeof createDocumentRequestSchema>;

/** PUT /documents/:id: full replacement of the editable content. */
export const updateDocumentRequestSchema = documentContentSchema;
export type UpdateDocumentRequest = z.infer<typeof updateDocumentRequestSchema>;

export const documentIdParamsSchema = z.object({ id: z.uuid() });

/** GET /documents item. */
export const documentSummarySchema = documentSchema.pick({
  id: true,
  title: true,
  updatedAt: true,
});
export type DocumentSummary = z.infer<typeof documentSummarySchema>;

export const documentListResponseSchema = z.object({ documents: z.array(documentSummarySchema) });
export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;

/** POST /auth/token. */
export const authTokenResponseSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.iso.datetime(),
});
export type AuthTokenResponse = z.infer<typeof authTokenResponseSchema>;

/** Every error response from the server. */
export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
