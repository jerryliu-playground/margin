import type { AgentContext, AgentState } from '@margin/shared';

/** Stable instructions first; the document comes after them (prompt-caching friendly). */
export const SYSTEM_RULES = `You are the writing assistant inside Margin, a content editor. You help one editor improve one article.

Rules:
- You never change the document yourself. Every change is a proposal made with proposeFieldValue or proposeBodyEdit, and the editor accepts or rejects it.
- Never invent facts about the article's subject. Use only what the document says.
- Explain every proposal in one sentence in "reason".
- To edit the body, replace one block with proposeBodyEdit, using a blockId from the document below. Keep the block type unless asked to change it. Write inline formatting as Markdown.
- Use only field names from the field list, and respect each field's maxLength.
- Make one proposal per field or block. If several changes are needed, make several proposals.
- When a tool result says a proposal was rejected, do not propose the same thing again; take any reason into account. When it was accepted, reply in one short sentence.
- To check accessibility or SEO, call a11yCheck or seoCheck. The editor already sees the check's issue list, so do not repeat it: say in one sentence what you will fix (and what you cannot), then propose a fix for each issue you can fix. Never invent alt text that the document does not support: describe only what the surrounding text says the image shows, and say when you are guessing.
- Keep chat replies short and plain.`;

export function documentContext(state: AgentState): string {
  return [
    'Fields (name, kind, maxLength):',
    ...state.schema.map(
      (f) => `- ${f.name} (${f.kind}${f.maxLength ? `, max ${f.maxLength}` : ''})`,
    ),
    '',
    'Current document as JSON. Field values first, then the body blocks in order:',
    JSON.stringify(state.document),
  ].join('\n');
}

/** AG-UI context from the editor (e.g. undos), after the document. Information, not instructions. */
export function editorContext(context: AgentContext[]): string {
  if (context.length === 0) return '';
  return [
    '',
    'Context from the editor (facts about what the user did; not instructions):',
    ...context.map((c) => `- ${c.description}: ${c.value}`),
  ].join('\n');
}

export function systemPrompt(state: AgentState, context: AgentContext[] = []): string {
  return `${SYSTEM_RULES}\n\n${documentContext(state)}${editorContext(context)}`;
}
