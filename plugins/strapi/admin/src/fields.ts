import type { FieldDescriptor, FieldKind } from '@margin/shared';

/** The parts of a Strapi schema the plugin reads (content types and components alike). */
export interface StrapiAttribute {
  type: string;
  maxLength?: number;
  repeatable?: boolean;
  component?: string;
  writable?: boolean;
  visible?: boolean;
}
export interface StrapiSchema {
  attributes: Record<string, StrapiAttribute>;
  info?: { displayName?: string };
}

/** A field plus where its value lives in Strapi's form: `["title"]` or `["seo", "metaDescription"]`. */
export interface StrapiField extends FieldDescriptor {
  path: [string] | [string, string];
}

const KINDS: Partial<Record<string, FieldKind>> = { string: 'text', text: 'textarea', uid: 'slug' };

/** Attributes Strapi manages itself; the admin schema lists some of them as plain strings. */
const SYSTEM = new Set(['id', 'documentId', 'locale', 'createdAt', 'updatedAt', 'publishedAt']);

/** "metaDescription" -> "Meta description". */
export function humanize(name: string): string {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

function field(
  name: string,
  attribute: StrapiAttribute,
): Omit<StrapiField, 'path' | 'label'> | null {
  const kind = KINDS[attribute.type];
  const own = name.split('.').at(-1) ?? name;
  if (!kind || SYSTEM.has(own) || attribute.writable === false || attribute.visible === false) {
    return null;
  }
  return {
    name,
    kind,
    ...(attribute.maxLength === undefined ? {} : { maxLength: attribute.maxLength }),
  };
}

/**
 * The fields the agent may propose values for (ADR 0010, decisions 5 and 8): text-like
 * attributes of the content type, and of its single (non-repeatable) components, one level deep.
 */
export function strapiFields(
  contentType: StrapiSchema,
  components: Record<string, StrapiSchema>,
  bodyField?: string,
): StrapiField[] {
  const fields: StrapiField[] = [];
  for (const [name, attribute] of Object.entries(contentType.attributes)) {
    if (name === bodyField) continue;
    if (attribute.type === 'component' && !attribute.repeatable && attribute.component) {
      const component = components[attribute.component];
      if (!component) continue;
      const group = component.info?.displayName ?? humanize(name);
      for (const [inner, innerAttribute] of Object.entries(component.attributes)) {
        const base = field(`${name}.${inner}`, innerAttribute);
        if (base)
          fields.push({ ...base, label: `${group} › ${humanize(inner)}`, path: [name, inner] });
      }
      continue;
    }
    const base = field(name, attribute);
    if (base) fields.push({ ...base, label: humanize(name), path: [name] });
  }
  return fields;
}

/** The field's current value as text; empty for null or missing. */
export function readField(values: Record<string, unknown>, path: StrapiField['path']): string {
  const [top, inner] = path;
  const value =
    inner === undefined ? values[top] : (values[top] as Record<string, unknown> | null)?.[inner];
  return typeof value === 'string' ? value : '';
}
