import type { PanelComponent } from '@strapi/content-manager/strapi-admin';
import { MarginAgent } from './MarginAgent';
import { useMarginSettings } from './settings';

/** The edit view side panel (ADR 0010). Shown only for content types in the plugin config. */
export const MarginPanel: PanelComponent = ({ model }) => {
  const settings = useMarginSettings();
  const config = settings?.contentTypes[model];
  if (!settings || !config) return null;
  return {
    title: 'Margin',
    content: <MarginAgent agentUrl={settings.agentUrl} bodyField={config.body} />,
  };
};
