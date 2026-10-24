import { describe, expect, it } from 'vitest';
import {
  fromBodyBlock,
  inlineToMarkdown,
  markdownToInline,
  replaceBlock,
  toBodyBlocks,
  type ImageNode,
  type InlineNode,
  type StrapiBlock,
} from './blocks';

const t = (
  text: string,
  marks: Partial<Record<'bold' | 'italic' | 'underline' | 'strikethrough' | 'code', boolean>> = {},
) => ({ type: 'text', text, ...marks }) as const;

const image: ImageNode = {
  type: 'image',
  image: { url: '/uploads/chart.png', alternativeText: null, name: 'chart.png', width: 800 },
  children: [t('')],
};

const article: StrapiBlock[] = [
  { type: 'heading', level: 2, children: [t('Why short sentences win')] },
  {
    type: 'paragraph',
    children: [
      t('Read '),
      t('the guide', { bold: true }),
      t(' and '),
      { type: 'link', url: 'https://x.test', children: [t('this')] },
      t('.'),
    ],
  },
  { type: 'quote', children: [t('Less is more.')] },
  { type: 'code', language: 'js', children: [t('const a = 1;')] },
  {
    type: 'list',
    format: 'unordered',
    children: [
      { type: 'list-item', children: [t('One')] },
      {
        type: 'list',
        format: 'unordered',
        indentLevel: 1,
        children: [{ type: 'list-item', children: [t('Nested')] }],
      },
      { type: 'list-item', children: [t('Two')] },
    ],
  },
  image,
];

describe('toBodyBlocks', () => {
  it('exposes each block like the demo host does', () => {
    expect(toBodyBlocks(article)).toEqual([
      { blockId: 'b0', type: 'heading', text: 'Why short sentences win', attrs: { level: 2 } },
      { blockId: 'b1', type: 'paragraph', text: 'Read **the guide** and [this](https://x.test).' },
      { blockId: 'b2', type: 'blockquote', text: '> Less is more.' },
      { blockId: 'b3', type: 'codeBlock', text: '```js\nconst a = 1;\n```' },
      { blockId: 'b4', type: 'bulletList', text: '- One\n  - Nested\n- Two' },
      { blockId: 'b5', type: 'image', text: '![](/uploads/chart.png)' },
    ]);
  });

  it('treats an empty or missing body as no blocks', () => {
    expect(toBodyBlocks(null)).toEqual([]);
  });
});

describe('inline Markdown', () => {
  const cases: [string, InlineNode[]][] = [
    ['plain', [t('plain')]],
    [
      '**bold** and *italic*',
      [t('bold', { bold: true }), t(' and '), t('italic', { italic: true })],
    ],
    ['***both***', [t('both', { bold: true, italic: true })]],
    ['`a*b`', [t('a*b', { code: true })]],
    [
      '~~gone~~ <u>under</u>',
      [t('gone', { strikethrough: true }), t(' '), t('under', { underline: true })],
    ],
    ['a \\*star\\* and snake_case', [t('a *star* and snake_case')]],
    [
      '[the **guide**](https://x.test)',
      [{ type: 'link', url: 'https://x.test', children: [t('the '), t('guide', { bold: true })] }],
    ],
  ];
  it.each(cases)('parses %s', (markdown, nodes) => {
    expect(markdownToInline(markdown)).toEqual(nodes);
  });

  it.each(cases)('round-trips %s', (markdown) => {
    expect(markdownToInline(inlineToMarkdown(markdownToInline(markdown)))).toEqual(
      markdownToInline(markdown),
    );
  });

  it('escapes Markdown characters in plain text', () => {
    expect(inlineToMarkdown([t('2 * 3 [x]')])).toBe('2 \\* 3 \\[x\\]');
  });

  it('always returns at least one text node, as Strapi requires', () => {
    expect(markdownToInline('')).toEqual([{ type: 'text', text: '' }]);
  });
});

describe('fromBodyBlock', () => {
  it('round-trips every block type through the body text', () => {
    const body = toBodyBlocks(article);
    article.forEach((block, i) => {
      const { type, text, attrs } = body[i] as (typeof body)[number];
      expect(fromBodyBlock(block, { type, text, ...(attrs ? { attrs } : {}) })).toEqual(block);
    });
  });

  it("changes only an image's alt text, keeping the media file", () => {
    const next = fromBodyBlock(image, {
      type: 'image',
      text: '![Bar chart of reading time](/uploads/chart.png)',
    });
    expect(next).toEqual({
      ...image,
      image: { ...image.image, alternativeText: 'Bar chart of reading time' },
    });
  });

  it('refuses to swap the image itself', () => {
    expect(() =>
      fromBodyBlock(image, { type: 'image', text: '![x](https://evil.test/a.png)' }),
    ).toThrow(/media library/);
  });

  it('refuses unknown types, bad levels and malformed blocks', () => {
    const p: StrapiBlock = { type: 'paragraph', children: [t('x')] };
    expect(() => fromBodyBlock(p, { type: 'table', text: 'x' })).toThrow(/no "table" block/);
    expect(() => fromBodyBlock(p, { type: 'heading', text: 'x', attrs: { level: 9 } })).toThrow(
      /1 to 6/,
    );
    expect(() => fromBodyBlock(p, { type: 'bulletList', text: 'not a list' })).toThrow(/list line/);
    expect(() => fromBodyBlock(p, { type: 'image', text: '![a](b)' })).toThrow(/Only an image/);
  });
});

describe('replaceBlock', () => {
  it('replaces one block by its session id and leaves the rest', () => {
    const next = replaceBlock(article, 'b1', { type: 'paragraph', text: 'Shorter.' });
    expect(next[1]).toEqual({ type: 'paragraph', children: [t('Shorter.')] });
    expect(next.filter((_, i) => i !== 1)).toEqual(article.filter((_, i) => i !== 1));
  });

  it('throws for an id that names no block', () => {
    expect(() => replaceBlock(article, 'b99', { type: 'paragraph', text: 'x' })).toThrow(
      /No block/,
    );
    expect(() => replaceBlock(article, 'p1', { type: 'paragraph', text: 'x' })).toThrow(/No block/);
  });
});
