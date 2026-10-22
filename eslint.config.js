// @ts-check
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Boundary rules from CLAUDE.md. Each message tells the reader (human or agent)
 * which rule is broken and what to do instead, so the fix needs no other context.
 */
const SERVER_IMPORT = {
  group: ['@margin/server', '@margin/server/*', '**/apps/server/**', '**/server/src/**'],
  message:
    'CLAUDE.md rule 3/4: browser code must never import apps/server. Move the shared type or schema to packages/shared and import it from "@margin/shared".',
};
const APP_IMPORT = {
  group: ['@margin/web', '@margin/web/*', '**/apps/**'],
  message:
    'CLAUDE.md rule 4: packages must not import from apps/*. Move the code into this package or into packages/shared.',
};
const HOST_IMPORT = {
  group: ['@tiptap/*', '@strapi/*', '@wordpress/*', 'prosemirror-*'],
  message:
    'CLAUDE.md rule 7: packages/agent-panel is host-agnostic. Talk to the editor through the EditorHost interface from "@margin/shared"; put editor-specific code in apps/web or plugins/*.',
};
const PANEL_IMPORT = {
  group: ['@margin/agent-panel', '@margin/agent-panel/*'],
  message:
    'CLAUDE.md rule 4: packages/shared must not depend on the panel. Keep shared free of React and UI code.',
};
const IO_IMPORT = {
  group: [
    'node:*',
    'fs',
    'path',
    'http',
    'https',
    'better-sqlite3',
    'drizzle-orm',
    'drizzle-orm/*',
  ],
  message:
    'CLAUDE.md rule 4: packages/shared has no I/O. Keep it to types, zod schemas and pure functions; do I/O in apps/server or apps/web.',
};

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['**/*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/agent-panel/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [SERVER_IMPORT] }] },
  },
  {
    files: ['packages/agent-panel/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [SERVER_IMPORT, APP_IMPORT, HOST_IMPORT] }],
    },
  },
  {
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [SERVER_IMPORT, APP_IMPORT, PANEL_IMPORT, IO_IMPORT] },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'CLAUDE.md rule 4: packages/shared has no I/O. Do network calls in apps/* and pass data in.',
        },
      ],
    },
  },
  {
    files: ['apps/server/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@margin/web',
                '@margin/web/*',
                '@margin/agent-panel',
                '**/apps/web/**',
                '**/web/src/**',
              ],
              message:
                'CLAUDE.md rule 4: the server must not import browser code. Shared contracts belong in "@margin/shared".',
            },
          ],
        },
      ],
    },
  },
);
