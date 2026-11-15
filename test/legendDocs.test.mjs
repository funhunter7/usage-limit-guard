import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const docs = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const ANCHORS = {
  cs: ['model', 'pamet-konverzace', 'limit-relace-5h', 'tydenni-limit-7d', 'sipka-tempo', 'odhad-do-prahu', 'projekt', 'worktree', 'odkladaci-slozka'],
  en: ['model', 'context-window', 'session-limit-5h', 'weekly-limit-7d', 'pace-arrow', 'projection', 'project', 'worktree', 'scratch-folder'],
};

for (const [lang, anchors] of Object.entries(ANCHORS)) {
  test(`docs/legend.${lang}.md: every help-link anchor exists as an explicit ASCII id`, () => {
    const md = readFileSync(join(docs, `legend.${lang}.md`), 'utf8');
    for (const a of anchors) assert.ok(md.includes(`<a id="${a}"></a>`), `missing anchor ${a}`);
  });
}

test('docs/legend.cs.md: uses "aplikace", never "appka"/"apka"', () => {
  assert.doesNotMatch(readFileSync(join(docs, 'legend.cs.md'), 'utf8'), /\bapp?ka\b/i);
});
