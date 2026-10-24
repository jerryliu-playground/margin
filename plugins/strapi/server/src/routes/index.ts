// Admin routes: Strapi requires a signed-in admin for every one of them (ADR 0010).
export default {
  admin: {
    type: 'admin',
    routes: [
      {
        method: 'GET',
        path: '/settings',
        handler: 'margin.settings',
        config: { policies: ['admin::isAuthenticatedAdmin'] },
      },
      {
        method: 'POST',
        path: '/token',
        handler: 'margin.token',
        config: { policies: ['admin::isAuthenticatedAdmin'] },
      },
    ],
  },
};
