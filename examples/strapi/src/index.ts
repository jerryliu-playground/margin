import type { Core, Schema } from '@strapi/strapi';

const ARTICLE = 'api::article.article';

/** The sample article: a Blocks body and an empty meta description for the agent to write. */
const SEED_ARTICLE = {
  title: 'Writing for the web',
  slug: 'writing-for-the-web',
  summary: '',
  seo: { metaTitle: '', metaDescription: '' },
  body: [
    { type: 'heading', level: 2, children: [{ type: 'text', text: 'Why short sentences win' }] },
    {
      type: 'paragraph',
      children: [
        {
          type: 'text',
          text: 'People do not read web pages word by word. They scan them, looking for the part that answers their question, and they leave as soon as they think it is not there.',
        },
      ],
    },
    {
      type: 'paragraph',
      children: [
        {
          type: 'text',
          text: 'In order to make sure that your readers are actually able to find what it is that they are looking for, it is generally a good idea to try to keep your sentences fairly short and to the point whenever that is possible.',
        },
      ],
    },
  ] satisfies Schema.Attribute.BlocksValue,
};

/**
 * A local admin for development and the e2e test, from MARGIN_EXAMPLE_ADMIN_EMAIL and
 * MARGIN_EXAMPLE_ADMIN_PASSWORD. Created once, only when no admin exists yet.
 */
async function ensureAdmin(strapi: Core.Strapi): Promise<void> {
  const email = process.env.MARGIN_EXAMPLE_ADMIN_EMAIL;
  const password = process.env.MARGIN_EXAMPLE_ADMIN_PASSWORD;
  if (!email || !password) return;
  if ((await strapi.db.query('admin::user').count()) > 0) return;
  const superAdmin = await strapi.service('admin::role').getSuperAdmin();
  await strapi.service('admin::user').create({
    email,
    password,
    firstname: 'Margin',
    lastname: 'Example',
    isActive: true,
    registrationToken: null,
    roles: [superAdmin.id],
  });
  strapi.log.info(`Created the example admin ${email}.`);
}

async function ensureArticle(strapi: Core.Strapi): Promise<void> {
  if ((await strapi.documents(ARTICLE).count({})) > 0) return;
  await strapi.documents(ARTICLE).create({ data: SEED_ARTICLE });
  strapi.log.info('Created the sample article.');
}

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureAdmin(strapi);
    await ensureArticle(strapi);
  },
};
