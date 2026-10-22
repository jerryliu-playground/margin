import type { FieldValue } from '@margin/shared';

export type FieldValues = Record<string, FieldValue>;
/** Who made a change: the person typing in the form, or the host applying an accepted proposal. */
export type ChangeOrigin = 'user' | 'host';

/** External store for field values, shared by the form and the EditorHost. */
export function createFieldStore(initial: FieldValues) {
  let values = initial;
  const listeners = new Set<(name: string, origin: ChangeOrigin) => void>();
  return {
    get: () => values,
    set(name: string, value: FieldValue, origin: ChangeOrigin = 'user') {
      values = { ...values, [name]: value };
      listeners.forEach((l) => l(name, origin));
    },
    subscribe(listener: (name: string, origin: ChangeOrigin) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type FieldStore = ReturnType<typeof createFieldStore>;
