// Fails when a raw colour appears outside a token file (docs/plans/look.md, decision 3).
// Raw colours elsewhere break dark mode and stop hosts from theming the panel.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = {
  'apps/web/src': 'apps/web/src/tokens.css',
  'packages/agent-panel/src': 'packages/agent-panel/src/tokens.css',
};
const RAW_COLOUR = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b|\b(?:rgba?|hsla?)\(/gi;

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'testing') yield* files(path);
    } else if (/\.(css|tsx?)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      yield path;
    }
  }
}

const problems = [];
for (const [root, tokens] of Object.entries(ROOTS)) {
  for (const path of files(root)) {
    if (path === tokens) continue;
    readFileSync(path, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const match of line.matchAll(RAW_COLOUR)) {
          problems.push(
            `${relative('.', path)}:${i + 1} uses the raw colour "${match[0]}". ` +
              `Use a var(--…) token from ${tokens}, or add one there, so dark mode and host theming keep working.`,
          );
        }
      });
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} raw colour(s) outside the token files (docs/plans/look.md).`);
  process.exit(1);
}
