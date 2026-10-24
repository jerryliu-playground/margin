import type { BodyBlockContent, EditorHost, FieldValue } from '@margin/shared';
import { readField, type StrapiField } from './fields';

export interface StrapiHostOptions {
  fields: StrapiField[];
  getAuthToken: () => Promise<string>;
  values: Record<string, unknown>;
}

export type FormChange = (path: string, value: unknown) => void;

export type StrapiHost = EditorHost & {
  /** Called by the panel after each render with Strapi's current values and onChange. */
  update(values: Record<string, unknown>, onChange: FormChange): void;
};

/**
 * `EditorHost` on Strapi's edit form (ADR 0006, ADR 0010). The host keeps its own copy of
 * the values, so the state is current right after an Accept, before React re-renders.
 * Accept changes the form only; saving stays with Strapi's Save button.
 */
export function createStrapiHost(options: StrapiHostOptions): StrapiHost {
  let values = options.values;
  let onChange: FormChange | undefined;
  const listeners = new Set<(state: ReturnType<EditorHost['getState']>) => void>();
  const byName = new Map(options.fields.map((f) => [f.name, f]));

  const getState = () => ({
    fields: Object.fromEntries(options.fields.map((f) => [f.name, readField(values, f.path)])),
    body: [],
  });
  const emit = () => {
    const state = getState();
    for (const listener of listeners) listener(state);
  };

  return {
    getSchema: () => options.fields.map(({ path: _path, ...descriptor }) => descriptor),
    getState,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async applyFieldValue(name: string, value: FieldValue) {
      const field = byName.get(name);
      if (!field) throw new Error(`This entry has no field "${name}".`);
      if (typeof value !== 'string') throw new Error(`"${field.label}" takes text, not a list.`);
      if (!onChange) throw new Error('The Strapi form is not ready yet.');
      const [top, inner] = field.path;
      if (inner === undefined) {
        values = { ...values, [top]: value };
        onChange(top, value);
      } else {
        // Replace the whole component object: Strapi documents onChange for top-level names.
        const component = {
          ...((values[top] as Record<string, unknown> | null) ?? {}),
          [inner]: value,
        };
        values = { ...values, [top]: component };
        onChange(top, component);
      }
      emit();
    },
    async applyBodyEdit(_blockId: string, _block: BodyBlockContent) {
      throw new Error('Body edits are not supported in Strapi yet.');
    },
    getAuthToken: options.getAuthToken,
    update(next, change) {
      onChange = change;
      if (next === values) return;
      values = next;
      emit();
    },
  };
}
