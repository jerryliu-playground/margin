import { describe, expect, it } from 'vitest';
import { a11yCheck, checkResultSchema, seoCheck } from './checks';
import type { BodyBlock, DocumentState } from './editor-host';

const doc = (body: BodyBlock[], fields: DocumentState['fields'] = {}): DocumentState => ({
  fields,
  body,
});
const p = (blockId: string, text: string): BodyBlock => ({ blockId, type: 'paragraph', text });
const h = (blockId: string, level: number, text: string): BodyBlock => ({
  blockId,
  type: 'heading',
  text,
  attrs: { level },
});
const rules = (r: { issues: { rule: string }[] }) => r.issues.map((i) => i.rule);

describe('a11yCheck', () => {
  it('passes a clean article', () => {
    const result = a11yCheck(
      doc([h('h1', 2, 'Intro'), p('p1', 'See [the style guide](https://x.test).')]),
    );
    expect(result).toEqual({ summary: 'No accessibility issues found.', issues: [] });
  });

  it('finds skipped and empty headings, starting from the page h1', () => {
    const result = a11yCheck(
      doc([h('a', 3, 'Too deep'), h('b', 3, ''), h('c', 2, 'Fine'), h('d', 4, 'Skips')]),
    );
    expect(result.issues).toEqual([
      expect.objectContaining({
        rule: 'heading-skipped',
        blockId: 'a',
        message: expect.stringContaining('level 1 to level 3'),
      }),
      expect.objectContaining({ rule: 'heading-empty', blockId: 'b' }),
      expect.objectContaining({ rule: 'heading-skipped', blockId: 'd' }),
    ]);
  });

  it('finds vague and empty link text, but ignores images', () => {
    const result = a11yCheck(
      doc([
        p(
          'p1',
          'To learn more, [click here](https://x.test) or [](https://y.test). ![chart](c.png)',
        ),
      ]),
    );
    expect(rules(result)).toEqual(['link-text-vague', 'link-text-empty']);
  });

  it('finds images without alt, as blocks and inline', () => {
    const result = a11yCheck(
      doc([
        { blockId: 'i1', type: 'image', text: '', attrs: { src: 'a.png', alt: '' } },
        { blockId: 'i2', type: 'image', text: '', attrs: { src: 'b.png', alt: 'A bar chart' } },
        p('p1', 'Inline ![](c.png) image.'),
      ]),
    );
    expect(result.issues.map((i) => [i.rule, i.blockId])).toEqual([
      ['image-alt-missing', 'i1'],
      ['image-alt-missing', 'p1'],
    ]);
    expect(result.summary).toBe('Found 2 errors.');
  });
});

describe('seoCheck', () => {
  const good = {
    title: 'Why short sentences win on the web',
    metaDescription:
      'Readers scan web pages. Short, direct sentences help them find what they need and stay longer.',
    slug: 'short-sentences',
  };

  it('passes a well-formed article', () => {
    expect(seoCheck(doc([p('p1', 'Short sentences.')], good))).toEqual({
      summary: 'No SEO issues found.',
      issues: [],
    });
  });

  it('reports missing title, meta description and slug', () => {
    expect(rules(seoCheck(doc([], {})))).toEqual(['title-missing', 'meta-missing', 'slug-missing']);
  });

  it('reports lengths outside the limits', () => {
    const result = seoCheck(
      doc([], { ...good, title: 'x'.repeat(61), metaDescription: 'Too short.' }),
    );
    expect(rules(result)).toEqual(['title-too-long', 'meta-too-short']);
    expect(result.summary).toBe('Found 2 warnings.');
  });

  it('warns about a long article without subheadings', () => {
    const long = p('p1', Array(301).fill('word').join(' '));
    expect(rules(seoCheck(doc([long], good)))).toEqual(['no-subheadings']);
    expect(rules(seoCheck(doc([h('h1', 2, 'Part one'), long], good)))).toEqual([]);
  });

  it('looks for a keyword in the title, meta, first paragraph and headings', () => {
    const result = seoCheck(doc([h('h1', 2, 'Readers scan'), p('p1', 'Nothing here.')], good), {
      keyword: 'Short sentences',
    });
    expect(result.issues.map((i) => i.message)).toEqual([
      'The keyword "Short sentences" is not in the meta description.',
      'The keyword "Short sentences" is not in the first paragraph.',
      'The keyword "Short sentences" is not in any heading.',
    ]);
  });

  it('returns results that match the shared schema', () => {
    expect(checkResultSchema.safeParse(seoCheck(doc([], {}))).success).toBe(true);
  });
});
