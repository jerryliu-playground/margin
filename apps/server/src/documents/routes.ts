import {
  createDocumentRequestSchema,
  documentIdParamsSchema,
  updateDocumentRequestSchema,
  type Document,
  type DocumentListResponse,
} from '@margin/shared';
import type { FastifyInstance } from 'fastify';
import { HttpError, parseOr400 } from '../errors';
import type { DocumentRepository } from './repository';

export function documentRoutes(repo: DocumentRepository) {
  return async (app: FastifyInstance) => {
    app.get('/documents', async (): Promise<DocumentListResponse> => ({ documents: repo.list() }));

    app.post('/documents', async (req, reply): Promise<Document> => {
      const input = parseOr400(createDocumentRequestSchema, req.body ?? {});
      reply.code(201);
      return repo.create(input);
    });

    app.get('/documents/:id', async (req): Promise<Document> => {
      const { id } = parseOr400(documentIdParamsSchema, req.params);
      const doc = repo.get(id);
      if (!doc) throw new HttpError(404, 'not_found', 'No document with that id.');
      return doc;
    });

    app.put('/documents/:id', async (req): Promise<Document> => {
      const { id } = parseOr400(documentIdParamsSchema, req.params);
      const input = parseOr400(updateDocumentRequestSchema, req.body);
      const doc = repo.update(id, input);
      if (!doc) throw new HttpError(404, 'not_found', 'No document with that id.');
      return doc;
    });
  };
}
