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

const SERVER_BROWSER_IMPORT = {
  group: ['@margin/web', '@margin/web/*', '@margin/agent-panel', '**/apps/web/**', '**/web/src/**'],
  message:
    'CLAUDE.md rule 4: the server must not import browser code. Shared contracts belong in "@margin/shared".',
};
const TOKEN_IMPORT = {
  group: ['@margin/agent-token', '@margin/agent-token/*'],
  message:
    'ADR 0010: @margin/agent-token is Node-only and holds the signing code. Browser code gets a token from EditorHost.getAuthToken(); mint tokens on a server.',
};
const TESTING_IMPORT = {
  group: ['**/testing/*', './testing/*', '../testing/*'],
  message:
    'Test helpers in src/testing/ are for tests only. Import them from *.test.ts(x) files or other testing/ files; production code must not depend on test doubles.',
};
const TEST_FILES = ['**/*.test.{ts,tsx}', '**/testing/**'];

/**
 * Import boundaries for one package. Production files also may not import src/testing/.
 * (Flat config replaces a rule's options per block, so both variants carry the full list.)
 */
function boundaries(glob, patterns) {
  const rule = (extra) => ({
    'no-restricted-imports': ['error', { patterns: [...patterns, ...extra] }],
  });
  return [
    { files: [glob], ignores: TEST_FILES, rules: rule([TESTING_IMPORT]) },
    { files: TEST_FILES.map((test) => [glob, test]), rules: rule([]) },
  ];
}

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      // Strapi regenerates these on every start.
      'examples/strapi/.strapi/**',
      'examples/strapi/types/generated/**',
    ],
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
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/agent-panel/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  ...boundaries('apps/web/**/*.{ts,tsx}', [SERVER_IMPORT, TOKEN_IMPORT]),
  ...boundaries('packages/agent-panel/**/*.{ts,tsx}', [
    SERVER_IMPORT,
    APP_IMPORT,
    HOST_IMPORT,
    TOKEN_IMPORT,
  ]),
  ...boundaries('packages/shared/**/*.ts', [
    SERVER_IMPORT,
    APP_IMPORT,
    PANEL_IMPORT,
    IO_IMPORT,
    TOKEN_IMPORT,
  ]),
  ...boundaries('apps/server/**/*.ts', [SERVER_BROWSER_IMPORT]),
  {
    files: ['packages/shared/**/*.ts'],
    rules: {
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
);
