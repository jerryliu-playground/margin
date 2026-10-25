/**
 * The panel themed like the Strapi admin around it (ADR 0010): Strapi's design system
 * colours, light or dark, mapped onto the panel's tokens, plus a border, rounded corners
 * and a height cap so a long conversation scrolls inside the panel, not the page.
 */
export type StrapiColors = Partial<Record<string, string>>;

const TOKENS: [token: string, color: string][] = [
  ['--margin-color-bg', 'neutral0'],
  ['--margin-color-surface', 'neutral0'],
  ['--margin-color-surface-muted', 'neutral100'],
  ['--margin-color-text', 'neutral800'],
  ['--margin-color-text-muted', 'neutral600'],
  ['--margin-color-border', 'neutral150'],
  ['--margin-color-border-strong', 'neutral300'],
  ['--margin-color-control-border', 'neutral200'],
  // Strapi's button colour; primary600 is a text colour and too light behind white text in
  // the dark theme. Hover keeps it: Strapi's hover colour (buttonPrimary500) fails AA.
  ['--margin-color-accent', 'buttonPrimary600'],
  ['--margin-color-accent-hover', 'buttonPrimary600'],
  ['--margin-color-accent-text', 'primary600'],
  ['--margin-color-accent-soft', 'primary100'],
  ['--margin-color-on-accent', 'buttonNeutral0'],
  ['--margin-color-focus', 'primary600'],
  ['--margin-color-success', 'success600'],
  ['--margin-color-success-soft', 'success100'],
  ['--margin-color-warning', 'warning600'],
  ['--margin-color-danger', 'danger600'],
  ['--margin-color-del-bg', 'danger100'],
  ['--margin-color-del-text', 'danger700'],
  ['--margin-color-ins-bg', 'success100'],
  ['--margin-color-ins-text', 'success700'],
];

export function strapiPanelCss(colors: StrapiColors): string {
  const tokens = TOKENS.flatMap(([token, color]) => {
    const value = colors[color];
    return value ? [`${token}: ${value};`] : [];
  });
  return `.margin-strapi .margin-panel {
  ${['--margin-font: inherit;', ...tokens].join('\n  ')}
  border: 1px solid var(--margin-color-border);
  border-radius: 8px;
  overflow: hidden;
  height: min(70vh, 640px);
}
.margin-strapi .margin-panel__body {
  scrollbar-color: var(--margin-color-border-strong) transparent;
}`;
}
