import type { CmsPanelSettings } from '@margin/shared';
import { strapiFields, type StrapiSchema } from './fields';

/** What the panel needs for one content type: the body attribute, if any. */
export interface PanelPlan {
  bodyField: string | undefined;
}

/** The type's first rich text (Blocks) attribute. */
export function firstBlocksAttribute(contentType: StrapiSchema): string | undefined {
  return Object.entries(contentType.attributes).find(([, a]) => a.type === 'blocks')?.[0];
}

/**
 * Whether a content type gets the panel, and which attribute is its body (ADR 0011):
 * every project content type by default, or only the configured ones; the body is the
 * configured attribute, none (`false`), or the first Blocks attribute. A type with nothing
 * for the agent to work on gets no panel.
 */
export function planPanel(
  settings: CmsPanelSettings,
  model: string,
  contentType: StrapiSchema,
  components: Record<string, StrapiSchema>,
): PanelPlan | null {
  const configured = settings.contentTypes;
  const entry = configured?.[model];
  if (configured ? !entry : !model.startsWith('api::')) return null;

  let bodyField: string | undefined;
  if (entry?.body === false) bodyField = undefined;
  else if (entry?.body) {
    bodyField = contentType.attributes[entry.body]?.type === 'blocks' ? entry.body : undefined;
  } else bodyField = firstBlocksAttribute(contentType);

  const fields = strapiFields(contentType, components, bodyField);
  return fields.length > 0 || bodyField ? { bodyField } : null;
}
