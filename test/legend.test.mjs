import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderLegend, runLegend } from '../bin/legend.mjs';
import { isLegendOn } from '../lib/legendFlag.mjs';
import { getMessages } from '../lib/messages.mjs';

const cfg = (extra = {}) => ({ locale: 'cs-CZ', style: 'auto', barStyle: 'pill', ...extra });

test('renderLegend: cs on Windows Terminal uses full-tier glyphs, one "sample — meaning" line per item', () => {
  const lines = renderLegend(cfg(), { WT_SESSION: 'x' }, 'win32').split('\n');
  assert.equal(lines.length, 1 + 9 + 1); // header, 9 items, docs link
  assert.match(lines[0], /legenda/);
  assert.equal(lines[1], 'Opus 5.5 — aktivní model');
  assert.match(lines[2], /^▰▰▰▰▱▱▱▱▱▱ 42% — /);
  assert.match(lines[3], /^5h 42% — limit relace/);
  assert.match(lines[5], /^84%↑ — /);
  assert.match(lines[6], /^📈 ~1h40m do 90% — /);
  assert.match(lines[8], /^🔀 my-branch — /);
  assert.match(lines[9], /^📁 scratchpad — odkládací složka/);
  assert.equal(lines[10], 'Podrobnosti: https://github.com/funhunter7/claude-limit-guard/blob/main/docs/legend.cs.md');
});

test('renderLegend: ascii tier uses [#] bar, ^ arrow and no emoji; never emits SGR escapes', () => {
  const out = renderLegend(cfg({ locale: 'en-US' }), { NO_COLOR: '' }, 'win32');
  assert.match(out, /\[####------\] 42% — /);
  assert.match(out, /84%\^ — /);
  assert.doesNotMatch(out, /🔀|📁|\x1b/); // eslint-disable-line no-control-regex
  assert.match(out, /docs\/legend\.en\.md$/);
});

test('renderLegend: a non-cs locale links the English page; unknown locale falls back to English text', () => {
  const out = renderLegend(cfg({ locale: 'is-IS' }), { WT_SESSION: 'x' }, 'win32');
  assert.match(out, /active model/);
  assert.match(out, /legend\.en\.md$/);
});

test('renderLegend: every locale renders a complete legend', async () => {
  for (const lang of ['cs', 'de', 'es', 'fr', 'it', 'pl', 'sk', 'uk', 'ru', 'ja', 'zh', 'ko', 'pt', 'nl', 'tr']) {
    const out = renderLegend(cfg({ locale: lang }), { WT_SESSION: 'x' }, 'win32');
    assert.equal(out.split('\n').length, 11, lang);
    assert.doesNotMatch(out, /undefined/, lang);
  }
});

// --- legend mode toggle (config dir injected through env: never the real ~/.claude) ---

const withDir = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'clg-legend-'));
  try {
    return fn(dir, { CLAUDE_CONFIG_DIR: dir, WT_SESSION: 'x' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test('runLegend on/off: writes then deletes the flag file, localized confirmation', () => withDir((dir, env) => {
  const flag = join(dir, '.limit-guard-legend');
  assert.equal(runLegend('on', cfg(), env, 'win32'), getMessages('cs-CZ').legendOn);
  assert.equal(readFileSync(flag, 'utf8'), 'on');
  assert.equal(isLegendOn(env), true);
  assert.equal(runLegend('off', cfg({ locale: 'en-US' }), env, 'win32'), getMessages('en-US').legendOff);
  assert.equal(existsSync(flag), false);
  assert.equal(isLegendOn(env), false);
  assert.equal(runLegend('off', cfg(), env, 'win32'), getMessages('cs-CZ').legendOff); // already off: still fine
}));

test('runLegend: no argument prints the legend and touches no flag; junk argument throws', () => withDir((dir, env) => {
  assert.match(runLegend('', cfg(), env, 'win32'), /legenda/);
  assert.match(runLegend(undefined, cfg(), env, 'win32'), /legenda/);
  assert.equal(existsSync(join(dir, '.limit-guard-legend')), false);
  assert.throws(() => runLegend('maybe', cfg(), env, 'win32'), /on or off/);
}));

test('isLegendOn: only the content "on" counts (trimmed); missing file or other content is off', () => withDir((dir, env) => {
  assert.equal(isLegendOn(env), false);
  writeFileSync(join(dir, '.limit-guard-legend'), 'on\n');
  assert.equal(isLegendOn(env), true);
  writeFileSync(join(dir, '.limit-guard-legend'), 'off');
  assert.equal(isLegendOn(env), false);
  assert.equal(isLegendOn({ CLAUDE_CONFIG_DIR: join(dir, 'nope', 'x') }), false);
}));

test('every locale has the legend on/off confirmations', async () => {
  for (const lang of ['en', 'cs', 'de', 'es', 'fr', 'it', 'pl', 'sk', 'uk', 'ru', 'ja', 'zh', 'ko', 'pt', 'nl', 'tr']) {
    const m = getMessages(lang);
    assert.ok(m.legendOn && m.legendOff && m.setupHyperlinkOptOut, lang);
  }
});
