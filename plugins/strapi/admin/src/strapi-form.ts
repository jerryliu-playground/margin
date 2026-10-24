/**
 * The only file that imports Strapi admin hooks (ADR 0010, decision 6). `useForm` is
 * exported but undocumented and `unstable_useContentManagerContext` is unstable, so a
 * Strapi upgrade that changes them breaks here, and the Strapi e2e job shows it.
 */
import { getFetchClient, unstable_useContentManagerContext, useForm } from '@strapi/strapi/admin';
import { useCallback } from 'react';
import type { StrapiSchema } from './fields';

export interface StrapiForm {
  values: Record<string, unknown>;
  onChange: (path: string, value: unknown) => void;
  contentType: StrapiSchema | undefined;
  components: Record<string, StrapiSchema>;
}

export function useStrapiForm(): StrapiForm {
  const values = useForm('Margin', (s) => s.values) as Record<string, unknown>;
  const onChange = useForm('Margin', (s) => s.onChange);
  const change = useCallback(
    (path: string, value: unknown) => onChange(path, value as never),
    [onChange],
  );
  const { contentType, components } = unstable_useContentManagerContext();
  return {
    values,
    onChange: change,
    contentType: contentType as StrapiSchema | undefined,
    components: components as unknown as Record<string, StrapiSchema>,
  };
}

/** POST /margin/token with the admin's session (Strapi's fetch client adds it). */
export async function requestAgentToken(): Promise<unknown> {
  const { post } = getFetchClient();
  return (await post('/margin/token')).data;
}
