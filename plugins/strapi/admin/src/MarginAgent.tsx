import { AgentPanel } from '@margin/agent-panel';
import panelCss from '@margin/agent-panel/styles.css?inline';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'styled-components';
import { strapiFields, type StrapiSchema } from './fields';
import { createStrapiHost } from './strapi-host';
import { requestAgentToken, useStrapiForm } from './strapi-form';
import { strapiPanelCss, type StrapiColors } from './strapi-theme';
import { createTokenSource } from './token';

const getAuthToken = createTokenSource(requestAgentToken);

/** The agent panel on this entry's form. Rendered only once Strapi has the schema. */
function AgentForEntry({
  agentUrl,
  bodyField,
  contentType,
}: {
  agentUrl: string;
  bodyField: string | undefined;
  contentType: StrapiSchema;
}) {
  const { values, onChange, components } = useStrapiForm();
  const fields = useMemo(
    () => strapiFields(contentType, components, bodyField),
    [contentType, components, bodyField],
  );
  const [host] = useState(() => createStrapiHost({ fields, bodyField, values, getAuthToken }));
  useEffect(() => host.update(values, onChange), [host, values, onChange]);
  return <AgentPanel host={host} agentUrl={agentUrl} />;
}

/** The side panel's content: the panel's own styles (it has no global CSS) and the panel. */
export function MarginAgent({
  agentUrl,
  bodyField,
}: {
  agentUrl: string;
  bodyField: string | undefined;
}) {
  const { contentType } = useStrapiForm();
  // Strapi's design system theme (light or dark), from its styled-components provider.
  const theme = useTheme() as unknown as { colors?: StrapiColors };
  if (!contentType) return null;
  return (
    <div className="margin-strapi">
      <style>{panelCss}</style>
      <style>{strapiPanelCss(theme.colors ?? {})}</style>
      <AgentForEntry agentUrl={agentUrl} bodyField={bodyField} contentType={contentType} />
    </div>
  );
}
