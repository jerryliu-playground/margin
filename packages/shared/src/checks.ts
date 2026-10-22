import { z } from 'zod';
import type { BodyBlock, DocumentState } from './editor-host';

/**
 * Server tools (SPEC §4, features 7–8). Both are pure and deterministic: they read the
 * document state the panel sent and return issues; they never change the document.
 * Fixes are proposed separately, through the frontend tools.
 */

/** Common SEO guidance, shared by the checks and the demo host's field limits. */
export const SEO_LIMITS = {
  title: 60,
  titleMin: 10,
  metaDescription: 160,
  metaDescriptionMin: 50,
  /** Above this many words, an article without subheadings gets a warning. */
  longArticleWords: 300,
} as const;

/** Link texts that say nothing about where the link goes (WCAG 2.4.4). */
const VAGUE_LINK_TEXT = new Set([
  'click here',
  'here',
  'read more',
  'more',
  'learn more',
  'link',
  'this',
  'this link',
  'click',
]);

export const checkIssueSchema = z.object({
  rule: z.string().min(1),
  severity: z.enum(['error', 'warning']),
  message: z.string().min(1),
  blockId: z.string().optional(),
  field: z.string().optional(),
});
export type CheckIssue = z.infer<typeof checkIssueSchema>;

export const checkResultSchema = z.object({
  summary: z.string(),
  issues: z.array(checkIssueSchema),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

export const a11yCheckArgsSchema = z.object({});
export const seoCheckArgsSchema = z.object({
  keyword: z
    .string()
    .min(1)
    .max(60)
    .optional()
    .describe(
      'Optional focus keyword or phrase to look for in the title, meta description, first paragraph and headings.',
    ),
});
export type SeoCheckArgs = z.infer<typeof seoCheckArgsSchema>;

/** Tools that run on the server. Results go back to the model in the same run. */
export const serverTools = {
  a11yCheck: {
    description:
      'Check the article for accessibility problems: skipped heading levels, empty headings, vague or empty link text, images without alt text. Returns issues; it changes nothing.',
    args: a11yCheckArgsSchema,
  },
  seoCheck: {
    description:
      'Check the article for SEO problems: title and meta description length, missing slug, no subheadings in a long article, and an optional keyword. Returns issues; it changes nothing.',
    args: seoCheckArgsSchema,
  },
} as const;
export type ServerToolName = keyof typeof serverTools;

function summarize(issues: CheckIssue[], none: string): CheckResult {
  if (issues.length === 0) return { summary: none, issues };
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const parts = [
    errors && `${errors} error${errors > 1 ? 's' : ''}`,
    warnings && `${warnings} warning${warnings > 1 ? 's' : ''}`,
  ];
  return { summary: `Found ${parts.filter(Boolean).join(' and ')}.`, issues };
}

const headingLevel = (block: BodyBlock) =>
  typeof block.attrs?.level === 'number' ? block.attrs.level : 2;

/** Markdown links `[text](url)`, not images `![alt](src)`. */
function links(text: string): { text: string; url: string }[] {
  return [...text.matchAll(/(?<!!)\[([^\]]*)\]\(([^)\s]*)[^)]*\)/g)].map((m) => ({
    text: (m[1] ?? '').replace(/[*_`]/g, '').trim(),
    url: m[2] ?? '',
  }));
}

/** Markdown images `![alt](src)` inside a block's text. */
function inlineImages(text: string): { alt: string; src: string }[] {
  return [...text.matchAll(/!\[([^\]]*)\]\(([^)\s]*)[^)]*\)/g)].map((m) => ({
    alt: (m[1] ?? '').trim(),
    src: m[2] ?? '',
  }));
}

export function a11yCheck(document: DocumentState): CheckResult {
  const issues: CheckIssue[] = [];
  // The document title is the page's h1, so body headings start at level 2.
  let previousLevel = 1;

  for (const block of document.body) {
    if (block.type === 'heading') {
      const level = headingLevel(block);
      if (block.text.trim() === '') {
        issues.push({
          rule: 'heading-empty',
          severity: 'error',
          message: 'A heading has no text. Screen reader users navigate by headings.',
          blockId: block.blockId,
        });
      }
      if (level > previousLevel + 1) {
        issues.push({
          rule: 'heading-skipped',
          severity: 'error',
          message: `The heading "${block.text.trim()}" jumps from level ${previousLevel} to level ${level}. Use level ${previousLevel + 1}.`,
          blockId: block.blockId,
        });
      }
      previousLevel = level;
    }

    // An image block is `![alt](src)` (or carries `attrs.alt`); inline images can sit in any text.
    const images =
      block.type === 'image' && typeof block.attrs?.alt === 'string'
        ? [{ alt: block.attrs.alt.trim() }]
        : inlineImages(block.text);
    for (const image of images) {
      if (!image.alt) {
        issues.push({
          rule: 'image-alt-missing',
          severity: 'error',
          message:
            'An image has no alt text. Describe what the image shows, or mark it as decorative.',
          blockId: block.blockId,
        });
      }
    }

    for (const link of links(block.text)) {
      if (!link.text) {
        issues.push({
          rule: 'link-text-empty',
          severity: 'error',
          message: `A link to ${link.url} has no text.`,
          blockId: block.blockId,
        });
      } else if (VAGUE_LINK_TEXT.has(link.text.toLowerCase())) {
        issues.push({
          rule: 'link-text-vague',
          severity: 'warning',
          message: `The link text "${link.text}" does not say where it goes. Describe the destination.`,
          blockId: block.blockId,
        });
      }
    }
  }
  return summarize(issues, 'No accessibility issues found.');
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function seoCheck(document: DocumentState, args: SeoCheckArgs = {}): CheckResult {
  const issues: CheckIssue[] = [];
  const title = text(document.fields.title);
  const meta = text(document.fields.metaDescription);
  const slug = text(document.fields.slug);

  if (!title) {
    issues.push({
      rule: 'title-missing',
      severity: 'error',
      message: 'The article has no title.',
      field: 'title',
    });
  } else if (title.length > SEO_LIMITS.title) {
    issues.push({
      rule: 'title-too-long',
      severity: 'warning',
      message: `The title has ${title.length} characters; search results show about ${SEO_LIMITS.title}.`,
      field: 'title',
    });
  } else if (title.length < SEO_LIMITS.titleMin) {
    issues.push({
      rule: 'title-too-short',
      severity: 'warning',
      message: `The title has ${title.length} characters; aim for ${SEO_LIMITS.titleMin}–${SEO_LIMITS.title}.`,
      field: 'title',
    });
  }

  if (!meta) {
    issues.push({
      rule: 'meta-missing',
      severity: 'error',
      message: 'The article has no meta description.',
      field: 'metaDescription',
    });
  } else if (meta.length > SEO_LIMITS.metaDescription) {
    issues.push({
      rule: 'meta-too-long',
      severity: 'warning',
      message: `The meta description has ${meta.length} characters; keep it under ${SEO_LIMITS.metaDescription}.`,
      field: 'metaDescription',
    });
  } else if (meta.length < SEO_LIMITS.metaDescriptionMin) {
    issues.push({
      rule: 'meta-too-short',
      severity: 'warning',
      message: `The meta description has ${meta.length} characters; aim for ${SEO_LIMITS.metaDescriptionMin}–${SEO_LIMITS.metaDescription}.`,
      field: 'metaDescription',
    });
  }

  if (!slug) {
    issues.push({
      rule: 'slug-missing',
      severity: 'warning',
      message: 'The article has no slug.',
      field: 'slug',
    });
  }

  const headings = document.body.filter((b) => b.type === 'heading');
  const bodyWords = document.body.reduce((n, b) => n + words(b.text), 0);
  if (headings.length === 0 && bodyWords > SEO_LIMITS.longArticleWords) {
    issues.push({
      rule: 'no-subheadings',
      severity: 'warning',
      message: `The article has ${bodyWords} words and no subheadings. Add headings so readers and search engines can scan it.`,
    });
  }

  const keyword = args.keyword?.trim().toLowerCase();
  if (keyword) {
    const has = (s: string) => s.toLowerCase().includes(keyword);
    const firstParagraph = document.body.find((b) => b.type === 'paragraph' && b.text.trim());
    const places: [string, boolean, Partial<CheckIssue>][] = [
      ['title', has(title), { field: 'title' }],
      ['meta description', has(meta), { field: 'metaDescription' }],
      [
        'first paragraph',
        !!firstParagraph && has(firstParagraph.text),
        firstParagraph ? { blockId: firstParagraph.blockId } : {},
      ],
      ['headings', headings.some((h) => has(h.text)), {}],
    ];
    for (const [where, found, target] of places) {
      if (!found) {
        issues.push({
          rule: 'keyword-missing',
          severity: 'warning',
          message: `The keyword "${args.keyword?.trim()}" is not in ${where === 'headings' ? 'any heading' : `the ${where}`}.`,
          ...target,
        });
      }
    }
  }
  return summarize(issues, 'No SEO issues found.');
}
