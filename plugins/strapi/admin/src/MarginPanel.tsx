import type { PanelComponent } from '@strapi/content-manager/strapi-admin';
import { planPanel } from './content-types';
import { MarginAgent } from './MarginAgent';
import { useMarginSettings } from './settings';
import { useStrapiForm } from './strapi-form';

/**
 * The edit view side panel (ADR 0010). Every project content type gets it by default, or
 * only the configured ones (ADR 0011).
 */
export const MarginPanel: PanelComponent = ({ model }) => {
  const settings = useMarginSettings();
  const { contentType, components } = useStrapiForm();
  if (!settings || !contentType) return null;
  const plan = planPanel(settings, model, contentType, components);
  if (!plan) return null;
  return {
    title: 'Margin',
    content: <MarginAgent agentUrl={settings.agentUrl} bodyField={plan.bodyField} />,
  };
};
