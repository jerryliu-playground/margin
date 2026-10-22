import { frontendToolDefinitions, type AgentRunRequest } from '@margin/shared';

/** A run request for the seeded-style document, with both frontend tools offered. */
export function testRequest(messages: AgentRunRequest['messages']): AgentRunRequest {
  return {
    threadId: 'thread-1',
    runId: 'run-1',
    tools: frontendToolDefinitions(),
    state: {
      schema: [
        { name: 'title', label: 'Title', kind: 'text', maxLength: 200 },
        { name: 'metaDescription', label: 'Meta description', kind: 'textarea', maxLength: 320 },
        { name: 'tags', label: 'Tags', kind: 'tags' },
      ],
      document: {
        fields: { title: 'Writing for the web', metaDescription: '', tags: [] },
        body: [
          {
            blockId: 'p1',
            type: 'paragraph',
            text: 'People scan web pages. They look for answers.',
          },
          {
            blockId: 'p2',
            type: 'paragraph',
            text: 'In order to help readers, keep sentences short. It is generally a good idea.',
          },
        ],
      },
    },
    messages,
  };
}
