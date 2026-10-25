import { describe, expect, it } from 'vitest';
import { firstBlocksAttribute, planPanel } from './content-types';
import type { StrapiSchema } from './fields';

const product: StrapiSchema = {
  attributes: {
    name: { type: 'string' },
    description: { type: 'blocks' },
    notes: { type: 'blocks' },
  },
};
const agentUrl = 'http://localhost:8790';

describe('planPanel', () => {
  it('gives every project content type the panel, with the first Blocks attribute as body', () => {
    expect(planPanel({ agentUrl }, 'api::product.product', product, {})).toEqual({
      bodyField: 'description',
    });
  });

  it('leaves plugin types alone by default', () => {
    expect(planPanel({ agentUrl }, 'plugin::users-permissions.user', product, {})).toBeNull();
  });

  it('with a contentTypes list, only those types get it', () => {
    const settings = { agentUrl, contentTypes: { 'api::article.article': {} } };
    expect(planPanel(settings, 'api::product.product', product, {})).toBeNull();
    expect(planPanel(settings, 'api::article.article', product, {})).toEqual({
      bodyField: 'description',
    });
  });

  it('uses a configured body, or none with body: false', () => {
    const named = { agentUrl, contentTypes: { 'api::product.product': { body: 'notes' } } };
    expect(planPanel(named, 'api::product.product', product, {})?.bodyField).toBe('notes');
    const none = { agentUrl, contentTypes: { 'api::product.product': { body: false as const } } };
    expect(planPanel(none, 'api::product.product', product, {})).toEqual({ bodyField: undefined });
  });

  it('ignores a configured body that is not a Blocks attribute', () => {
    const wrong = { agentUrl, contentTypes: { 'api::product.product': { body: 'name' } } };
    expect(planPanel(wrong, 'api::product.product', product, {})?.bodyField).toBeUndefined();
  });

  it('shows no panel when there is nothing for the agent to work on', () => {
    const media: StrapiSchema = { attributes: { cover: { type: 'media' } } };
    expect(planPanel({ agentUrl }, 'api::gallery.gallery', media, {})).toBeNull();
  });
});

describe('firstBlocksAttribute', () => {
  it('finds the first rich text attribute', () => {
    expect(firstBlocksAttribute(product)).toBe('description');
    expect(firstBlocksAttribute({ attributes: {} })).toBeUndefined();
  });
});
