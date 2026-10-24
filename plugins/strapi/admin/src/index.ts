import type { ContentManagerPlugin } from '@strapi/content-manager/strapi-admin';
import type { StrapiApp } from '@strapi/strapi/admin';
import { MarginPanel } from './MarginPanel';

const PLUGIN_ID = 'margin';

export default {
  register(app: StrapiApp) {
    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID });
  },
  bootstrap(app: StrapiApp) {
    // `apis` is typed unknown in Strapi 5.59; this is the documented side panel API.
    const contentManager = app.getPlugin('content-manager');
    const apis = contentManager.apis as ContentManagerPlugin['config']['apis'];
    apis.addEditViewSidePanel([MarginPanel]);
  },
};
