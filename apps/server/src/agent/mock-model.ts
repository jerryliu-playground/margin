import type {
  LanguageModelV4,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
} from '@ai-sdk/provider';
import {
  checkResultSchema,
  proposalResultSchema,
  type AgentRunRequest,
  type BodyBlock,
  type CheckResult,
  type ProposeBodyEditArgs,
  type ProposeFieldValueArgs,
  type SeoCheckArgs,
} from '@margin/shared';
import { simulateReadableStream } from 'ai';

/**
 * Deterministic stand-in for Claude (CLAUDE.md rule 5). It reads the run request and the
 * prompt of the current step, and answers from a fixed script keyed by the last message:
 * - a check result     -> a short issue list, plus proposals that fix what it can
 * - a proposal answer  -> one short sentence about the outcome
 * - "accessibility"    -> a11yCheck (runs on the server, then the next step continues)
 * - "check seo"        -> seoCheck
 * - "meta description" -> proposeFieldValue(metaDescription)
 * - "title and tags"   -> two proposals in one turn
 * - "title" / "tags"   -> proposeFieldValue(title | tags)
 * - "tighten"          -> proposeBodyEdit on the longest paragraph
 * - anything else      -> a short help text
 */
type Call =
  | { name: 'proposeFieldValue'; args: ProposeFieldValueArgs }
  | { name: 'proposeBodyEdit'; args: ProposeBodyEditArgs }
  | { name: 'a11yCheck'; args: Record<string, never> }
  | { name: 'seoCheck'; args: SeoCheckArgs };
interface Reply {
  text?: string;
  calls?: Call[];
}

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.]$/, '')}…`;
}

const firstSentence = (text: string) => /^.*?[.!?](\s|$)/.exec(text)?.[0].trim() ?? text;

/** Deterministic stand-ins for a tone rewrite; the real model does the actual work. */
function retone(text: string, tone: 'more formal' | 'shorter' | 'friendlier'): string {
  if (tone === 'shorter') return firstSentence(text);
  if (tone === 'friendlier')
    return `Here's the thing: ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  return text
    .replace(/\bdon't\b/gi, 'do not')
    .replace(/\bit's\b/gi, 'it is')
    .replace(/\bcan't\b/gi, 'cannot')
    .replace(/^/, 'Notably, ');
}

function paragraphs(body: BodyBlock[]) {
  return body.filter((b) => b.type === 'paragraph' && b.text.trim() !== '');
}

/** The last tool result in the step's prompt, if the prompt ends with one. */
function lastToolResult(
  prompt: LanguageModelV4Prompt,
): { toolName: string; value: unknown } | undefined {
  const last = prompt.at(-1);
  if (last?.role !== 'tool') return undefined;
  const part = [...last.content].reverse().find((p) => p.type === 'tool-result');
  if (!part || part.type !== 'tool-result') return undefined;
  const { output } = part;
  const value =
    output.type === 'json'
      ? output.value
      : output.type === 'text'
        ? (() => {
            try {
              return JSON.parse(output.value) as unknown;
            } catch {
              return undefined;
            }
          })()
        : undefined;
  return { toolName: part.toolName, value };
}

function checkReply(toolName: string, result: CheckResult, request: AgentRunRequest): Reply {
  const calls: Call[] = [];
  const { body, fields } = request.state.document;
  for (const issue of result.issues) {
    const block = body.find((b) => b.blockId === issue.blockId);
    if (issue.rule === 'image-alt-missing' && block?.type === 'image') {
      const src = /\]\(([^)\s]+)\)/.exec(block.text)?.[1] ?? '';
      calls.push({
        name: 'proposeBodyEdit',
        args: {
          blockId: block.blockId,
          newContent: { type: 'image', text: `![Bar chart from the article](${src})` },
          reason: 'Adds alt text so screen reader users know what the image shows.',
        },
      });
    }
    if (issue.rule === 'meta-missing') {
      const lead =
        paragraphs(body)[0]?.text ?? (typeof fields.title === 'string' ? fields.title : '');
      calls.push({
        name: 'proposeFieldValue',
        args: {
          field: 'metaDescription',
          value: cutAtWord(lead.replace(/[*_`]/g, ''), 155) || 'A short article.',
          reason: 'Adds the missing meta description.',
        },
      });
    }
  }
  // The panel shows the issue list itself, so the reply only says what will be fixed.
  const what = toolName === 'a11yCheck' ? 'accessibility' : 'SEO';
  const fixes = `I propose ${calls.length} fix${calls.length > 1 ? 'es' : ''}`;
  let text: string;
  if (result.issues.length === 0) text = `No ${what} issues to fix.`;
  else if (calls.length === 0) text = `I can't fix these ${what} issues myself.`;
  else if (calls.length < result.issues.length) text = `${fixes}; the rest need your judgement.`;
  else text = `${fixes}.`;
  return { text, calls };
}

export function scriptedReply(request: AgentRunRequest, prompt: LanguageModelV4Prompt = []): Reply {
  const toolResult = lastToolResult(prompt);
  if (toolResult && (toolResult.toolName === 'a11yCheck' || toolResult.toolName === 'seoCheck')) {
    const result = checkResultSchema.safeParse(toolResult.value);
    return result.success
      ? checkReply(toolResult.toolName, result.data, request)
      : { text: 'The check could not run.' };
  }

  const last = request.messages.at(-1);
  if (last?.role === 'tool') {
    const result = proposalResultSchema.safeParse(JSON.parse(last.content || '{}'));
    if (!result.success) return { text: 'That proposal could not be used. I will try again.' };
    switch (result.data.status) {
      case 'accepted':
        return { text: 'Done. Save the document to keep the change.' };
      case 'stale':
        return { text: 'That block changed since I proposed the edit, so I left it alone.' };
      case 'rejected':
        return {
          text: result.data.reason
            ? `OK, I left it unchanged. Noted: ${result.data.reason}`
            : 'OK, I left it unchanged.',
        };
    }
  }

  const ask = last?.role === 'user' ? last.content.toLowerCase() : '';
  const { fields, body } = request.state.document;
  const title = typeof fields.title === 'string' ? fields.title : '';
  const lead = paragraphs(body)[0]?.text ?? title;

  const meta: Call = {
    name: 'proposeFieldValue',
    args: {
      field: 'metaDescription',
      value: cutAtWord(lead.replace(/[*_`]/g, ''), 155) || 'A short article.',
      reason: 'Summarises the opening in under 160 characters.',
    },
  };
  const titleCall: Call = {
    name: 'proposeFieldValue',
    args: {
      field: 'title',
      value: cutAtWord(title || firstSentence(lead), 60),
      reason: 'Keeps the title under 60 characters.',
    },
  };
  const tagsCall: Call = {
    name: 'proposeFieldValue',
    args: {
      field: 'tags',
      value: ['writing', 'web', 'style'],
      reason: 'Matches the topics in the body.',
    },
  };

  if (ask.includes('accessib')) {
    return { text: 'Checking accessibility.', calls: [{ name: 'a11yCheck', args: {} }] };
  }
  if (ask.includes('check seo') || ask.includes('seo check')) {
    return { text: 'Checking SEO.', calls: [{ name: 'seoCheck', args: {} }] };
  }
  if (ask.includes('meta description'))
    return { text: 'Here is a meta description.', calls: [meta] };
  if (ask.includes('title and tags'))
    return { text: 'Two suggestions.', calls: [titleCall, tagsCall] };
  if (ask.includes('title')) return { text: 'Here is a shorter title.', calls: [titleCall] };
  if (ask.includes('tags')) return { text: 'Here are three tags.', calls: [tagsCall] };
  const tone = (['more formal', 'shorter', 'friendlier'] as const).find((t) => ask.includes(t));
  if (tone) {
    const target = [...paragraphs(body)].sort((a, b) => b.text.length - a.text.length)[0];
    if (!target) return { text: 'There is no paragraph to rewrite yet.' };
    return {
      text: `A ${tone} version of the longest paragraph.`,
      calls: [
        {
          name: 'proposeBodyEdit',
          args: {
            blockId: target.blockId,
            newContent: { type: 'paragraph', text: retone(target.text, tone) },
            reason: `Makes it ${tone}.`,
          },
        },
      ],
    };
  }
  if (ask.includes('tighten')) {
    const target = [...paragraphs(body)].sort((a, b) => b.text.length - a.text.length)[0];
    if (!target) return { text: 'There is no paragraph to tighten yet.' };
    return {
      text: 'A tighter version of the longest paragraph.',
      calls: [
        {
          name: 'proposeBodyEdit',
          args: {
            blockId: target.blockId,
            newContent: { type: 'paragraph', text: firstSentence(target.text) },
            reason: 'Keeps the main point and drops the rest.',
          },
        },
      ],
    };
  }
  return {
    text: 'I can write a meta description, suggest a title or tags, or tighten a paragraph.',
  };
}

let callCounter = 0;

function toStreamParts(reply: Reply): LanguageModelV4StreamPart[] {
  const parts: LanguageModelV4StreamPart[] = [{ type: 'stream-start', warnings: [] }];
  if (reply.text) {
    parts.push({ type: 'text-start', id: 't0' });
    // Word-sized deltas, so the UI streams like the real model.
    for (const delta of reply.text.match(/\S+\s*/g) ?? [])
      parts.push({ type: 'text-delta', id: 't0', delta });
    parts.push({ type: 'text-end', id: 't0' });
  }
  for (const call of reply.calls ?? []) {
    const id = `mock-call-${++callCounter}`;
    const input = JSON.stringify(call.args);
    parts.push({ type: 'tool-input-start', id, toolName: call.name });
    parts.push({ type: 'tool-input-delta', id, delta: input });
    parts.push({ type: 'tool-input-end', id });
    parts.push({ type: 'tool-call', toolCallId: id, toolName: call.name, input });
  }
  parts.push({
    type: 'finish',
    finishReason: { unified: reply.calls?.length ? 'tool-calls' : 'stop', raw: undefined },
    usage,
  });
  return parts;
}

export function createMockModel(request: AgentRunRequest): LanguageModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'margin-mock',
    modelId: 'scripted',
    supportedUrls: {},
    doGenerate: () => Promise.reject(new Error('The mock model only streams.')),
    doStream: async ({ prompt }) => ({
      stream: simulateReadableStream({
        chunks: toStreamParts(scriptedReply(request, prompt)),
        chunkDelayInMs: 5,
      }),
    }),
  };
}
