import { describe, expect, it } from 'vitest';
import { strapiPanelCss } from './strapi-theme';

describe('strapiPanelCss', () => {
  it('maps Strapi theme colours onto the panel tokens', () => {
    const css = strapiPanelCss({
      neutral0: '#212134',
      neutral800: '#ffffff',
      primary600: '#7b79ff',
      buttonPrimary600: '#4945ff',
    });
    expect(css).toContain('--margin-color-bg: #212134;');
    expect(css).toContain('--margin-color-text: #ffffff;');
    // Buttons use Strapi's button colour (also on hover); the lighter primary is for text.
    expect(css).toContain('--margin-color-accent: #4945ff;');
    expect(css).toContain('--margin-color-accent-hover: #4945ff;');
    expect(css).toContain('--margin-color-accent-text: #7b79ff;');
  });

  it('leaves out colours the theme does not have, keeping the panel defaults', () => {
    expect(strapiPanelCss({ neutral0: '#fff' })).not.toContain('--margin-color-danger');
  });

  it('gives the panel a border, rounded corners and a height, so it scrolls inside', () => {
    const css = strapiPanelCss({});
    expect(css).toMatch(/border: 1px solid var\(--margin-color-border\)/);
    expect(css).toMatch(/border-radius: 8px/);
    expect(css).toMatch(/height: min\(70vh, 640px\)/);
    expect(css).toMatch(/scrollbar-color: var\(--margin-color-border-strong\)/);
  });
});
