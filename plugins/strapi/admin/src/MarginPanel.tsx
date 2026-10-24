import type { PanelComponent } from '@strapi/content-manager/strapi-admin';
import { useMarginSettings } from './settings';

/** The edit view side panel (ADR 0010). Shown only for content types in the plugin config. */
export const MarginPanel: PanelComponent = ({ model }) => {
  const settings = useMarginSettings();
  if (!settings?.contentTypes[model]) return null;
  return {
    title: 'Margin',
    content: <p>The agent panel will appear here.</p>,
  };
};
