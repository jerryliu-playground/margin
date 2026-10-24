import type { BodyBlock, BodyBlockContent } from '@margin/shared';

/*
 * Strapi Blocks <-> the host-neutral body (ADR 0006, ADR 0010), with the same conventions as
 * the demo's TipTap host: paragraphs and headings expose inline Markdown (level in attrs);
 * lists, quotes and code expose their whole Markdown; images are `![alt](url)`.
 * Inline marks: **bold**, *italic*, `code`, ~~strikethrough~~, <u>underline</u>, [links](url).
 */

export interface TextNode {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}
export interface LinkNode {
  type: 'link';
  url: string;
  children: TextNode[];
}
export type InlineNode = TextNode | LinkNode;
export interface ListItemNode {
  type: 'list-item';
  children: InlineNode[];
}
export interface ListNode {
  type: 'list';
  format: 'ordered' | 'unordered';
  indentLevel?: number;
  children: (ListItemNode | ListNode)[];
}
export interface ImageNode {
  type: 'image';
  image: { url: string; alternativeText?: string | null; [key: string]: unknown };
  children: InlineNode[];
}
export type StrapiBlock =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineNode[] }
  | { type: 'quote'; children: InlineNode[] }
  | { type: 'code'; language?: string; children: InlineNode[] }
  | ListNode
  | ImageNode;

export class BlockError extends Error {}

/* ---------- inline: Strapi -> Markdown ---------- */

const escape = (text: string) => text.replace(/([\\*`~[\]<])/g, '\\$1');

function textMarkdown(node: TextNode): string {
  if (node.code) return `\`${node.text}\``;
  let out = escape(node.text);
  if (!out.trim()) return out;
  if (node.underline) out = `<u>${out}</u>`;
  if (node.strikethrough) out = `~~${out}~~`;
  if (node.italic) out = `*${out}*`;
  if (node.bold) out = `**${out}**`;
  return out;
}

export function inlineToMarkdown(nodes: InlineNode[]): string {
  return nodes
    .map((n) =>
      n.type === 'link' ? `[${inlineToMarkdown(n.children)}](${n.url})` : textMarkdown(n),
    )
    .join('');
}

const plain = (nodes: InlineNode[]): string =>
  nodes.map((n) => (n.type === 'link' ? plain(n.children) : n.text)).join('');

/* ---------- inline: Markdown -> Strapi ---------- */

type Marks = Pick<TextNode, 'bold' | 'italic' | 'underline' | 'strikethrough'>;

const DELIMITERS: [string, string, keyof Marks][] = [
  ['**', '**', 'bold'],
  ['~~', '~~', 'strikethrough'],
  ['<u>', '</u>', 'underline'],
  ['*', '*', 'italic'],
];

/** Index of the closing delimiter at depth 0, skipping escapes and code spans. */
function findClose(text: string, from: number, close: string): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
      continue;
    }
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > 0) i = end;
      continue;
    }
    if (text.startsWith(close, i)) {
      // `**` must not close a single `*` italic.
      if (close === '*' && text.startsWith('**', i)) {
        i++;
        continue;
      }
      // In `***`, bold closes on the last two stars and leaves the first to the italic inside.
      if (close === '**' && text[i + 2] === '*') return i + 1;
      return i;
    }
  }
  return -1;
}

function parseInline(text: string, marks: Marks): TextNode[] {
  const out: TextNode[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) out.push({ type: 'text', text: buffer, ...marks });
    buffer = '';
  };
  for (let i = 0; i < text.length;) {
    const ch = text[i] ?? '';
    if (ch === '\\' && i + 1 < text.length) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i) {
        flush();
        out.push({ type: 'text', text: text.slice(i + 1, end), code: true });
        i = end + 1;
        continue;
      }
    }
    const delimiter = DELIMITERS.find(([open]) => text.startsWith(open, i));
    if (delimiter) {
      const [open, close, mark] = delimiter;
      const end = findClose(text, i + open.length, close);
      if (end > i + open.length) {
        flush();
        out.push(...parseInline(text.slice(i + open.length, end), { ...marks, [mark]: true }));
        i = end + close.length;
        continue;
      }
    }
    buffer += ch;
    i += 1;
  }
  flush();
  return out;
}

const LINK = /\[((?:\\.|[^\]\\])*)\]\(([^)\s]+)\)/g;

export function markdownToInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const index = match.index ?? 0;
    // An escaped "\[" is text, not a link.
    if (index > 0 && text[index - 1] === '\\') continue;
    nodes.push(...parseInline(text.slice(last, index), {}));
    nodes.push({ type: 'link', url: match[2] ?? '', children: parseInline(match[1] ?? '', {}) });
    last = index + match[0].length;
  }
  nodes.push(...parseInline(text.slice(last), {}));
  // Strapi requires at least one text child.
  return nodes.length > 0 ? nodes : [{ type: 'text', text: '' }];
}

/* ---------- lists ---------- */

function listToMarkdown(list: ListNode, depth = 0): string {
  let n = 0;
  return list.children
    .map((child) => {
      if (child.type === 'list') return listToMarkdown(child, depth + 1);
      n += 1;
      const marker = list.format === 'ordered' ? `${n}.` : '-';
      return `${'  '.repeat(depth)}${marker} ${inlineToMarkdown(child.children)}`;
    })
    .join('\n');
}

function markdownToList(text: string, format: ListNode['format']): ListNode {
  const root: ListNode = { type: 'list', format, children: [] };
  const stack: ListNode[] = [root];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const match = /^( *)(?:[-*+]|\d+\.) (.*)$/.exec(line);
    if (!match) throw new BlockError(`Each list line must start with "- " or "1. ": "${line}".`);
    const depth = Math.floor((match[1] ?? '').length / 2);
    while (stack.length - 1 > depth) stack.pop();
    while (stack.length - 1 < depth) {
      const parent = stack[stack.length - 1] as ListNode;
      const nested: ListNode = { type: 'list', format, indentLevel: stack.length, children: [] };
      parent.children.push(nested);
      stack.push(nested);
    }
    (stack[stack.length - 1] as ListNode).children.push({
      type: 'list-item',
      children: markdownToInline(match[2] ?? ''),
    });
  }
  if (root.children.length === 0) throw new BlockError('A list needs at least one item.');
  return root;
}

/* ---------- blocks ---------- */

const imageMarkdown = (node: ImageNode) =>
  `![${(node.image.alternativeText ?? '').replace(/[[\]]/g, '')}](${node.image.url})`;

/** Session-scoped block ids (ADR 0006): the position in this editing session. */
export const blockId = (index: number) => `b${index}`;
const indexOf = (id: string) => (/^b(\d+)$/.test(id) ? Number(id.slice(1)) : -1);

export function toBodyBlocks(blocks: StrapiBlock[] | null | undefined): BodyBlock[] {
  return (blocks ?? []).map((block, index): BodyBlock => {
    const id = blockId(index);
    switch (block.type) {
      case 'paragraph':
        return { blockId: id, type: 'paragraph', text: inlineToMarkdown(block.children) };
      case 'heading':
        return {
          blockId: id,
          type: 'heading',
          text: inlineToMarkdown(block.children),
          attrs: { level: block.level },
        };
      case 'quote':
        return { blockId: id, type: 'blockquote', text: `> ${inlineToMarkdown(block.children)}` };
      case 'code':
        return {
          blockId: id,
          type: 'codeBlock',
          text: `\`\`\`${block.language ?? ''}\n${plain(block.children)}\n\`\`\``,
        };
      case 'list':
        return {
          blockId: id,
          type: block.format === 'ordered' ? 'orderedList' : 'bulletList',
          text: listToMarkdown(block),
        };
      case 'image':
        return { blockId: id, type: 'image', text: imageMarkdown(block) };
    }
  });
}

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

/**
 * The Strapi block for a proposed replacement of `current`. Images keep their media file;
 * only the alt text can change, because a new image comes from Strapi's media library.
 */
export function fromBodyBlock(current: StrapiBlock, block: BodyBlockContent): StrapiBlock {
  const text = block.text.trim();
  switch (block.type) {
    case 'paragraph':
      return { type: 'paragraph', children: markdownToInline(text) };
    case 'heading': {
      const level = Number(block.attrs?.level ?? (current.type === 'heading' ? current.level : 2));
      const valid = LEVELS.find((l) => l === level);
      if (!valid) throw new BlockError(`A heading level is 1 to 6, not ${String(level)}.`);
      return { type: 'heading', level: valid, children: markdownToInline(text) };
    }
    case 'blockquote':
      return { type: 'quote', children: markdownToInline(text.replace(/^> ?/gm, '')) };
    case 'codeBlock': {
      const match = /^```([\w-]*)\n([\s\S]*?)\n?```$/.exec(text);
      if (!match) throw new BlockError('A code block must be fenced with ```.');
      return {
        type: 'code',
        ...(match[1] ? { language: match[1] } : {}),
        children: [{ type: 'text', text: match[2] ?? '' }],
      };
    }
    case 'bulletList':
    case 'orderedList':
      return markdownToList(text, block.type === 'orderedList' ? 'ordered' : 'unordered');
    case 'image': {
      if (current.type !== 'image')
        throw new BlockError('Only an image block can become an image.');
      const match = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(text);
      if (!match) throw new BlockError('An image must be written as ![alt text](url).');
      if (match[2] !== current.image.url) {
        throw new BlockError(
          "Only the alt text can change; pick a new image in Strapi's media library.",
        );
      }
      const alt = match[1] ?? '';
      // An unchanged empty alt keeps Strapi's own value (null or missing).
      if (alt === '' && !current.image.alternativeText) return current;
      return { ...current, image: { ...current.image, alternativeText: alt } };
    }
    default:
      throw new BlockError(`Strapi has no "${block.type}" block.`);
  }
}

/** The body with one block replaced. Throws if the id does not name a block. */
export function replaceBlock(
  blocks: StrapiBlock[] | null | undefined,
  id: string,
  block: BodyBlockContent,
): StrapiBlock[] {
  const list = blocks ?? [];
  const index = indexOf(id);
  const current = list[index];
  if (!current) throw new BlockError(`No block with id "${id}". It may have been deleted.`);
  return list.map((b, i) => (i === index ? fromBodyBlock(current, block) : b));
}
