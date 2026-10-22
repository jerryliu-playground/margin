import type { DocumentRepository } from './repository';

export const SEED_DOCUMENT_ID = '00000000-0000-4000-8000-000000000001';

const paragraph = (id: string, text: string) => ({
  type: 'paragraph',
  attrs: { id },
  content: [{ type: 'text', text }],
});

/** Adds one sample article when the database is empty, so the demo has something to open. */
export function seedIfEmpty(repo: DocumentRepository): void {
  if (!repo.isEmpty()) return;
  repo.create(
    {
      title: 'Writing for the web',
      slug: 'writing-for-the-web',
      summary: '',
      metaDescription: '',
      tags: ['writing'],
      body: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { id: 'seed-h1', level: 2 },
            content: [{ type: 'text', text: 'Why short sentences win' }],
          },
          paragraph(
            'seed-p1',
            'People do not read web pages word by word. They scan them, looking for the part that answers their question, and they leave as soon as they think it is not there.',
          ),
          paragraph(
            'seed-p2',
            'In order to make sure that your readers are actually able to find what it is that they are looking for, it is generally a good idea to try to keep your sentences fairly short and to the point whenever that is possible.',
          ),
        ],
      },
    },
    SEED_DOCUMENT_ID,
  );
}
