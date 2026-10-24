import { cmsPanelSettingsSchema, type CmsPanelSettings } from '@margin/shared';
import { useFetchClient } from '@strapi/strapi/admin';
import { useEffect, useState } from 'react';

let cached: Promise<CmsPanelSettings> | undefined;

/** The plugin's settings from GET /margin/settings, fetched once per admin session. */
export function useMarginSettings(): CmsPanelSettings | undefined {
  const { get } = useFetchClient();
  const [settings, setSettings] = useState<CmsPanelSettings>();
  useEffect(() => {
    cached ??= get('/margin/settings').then(({ data }) => cmsPanelSettingsSchema.parse(data));
    let live = true;
    cached.then(
      (s) => live && setSettings(s),
      () => {
        cached = undefined;
      },
    );
    return () => {
      live = false;
    };
  }, [get]);
  return settings;
}
