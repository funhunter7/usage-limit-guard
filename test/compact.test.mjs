import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GLYPHS, formatStatusLine, paceAhead, resolveTier } from '../lib/format.mjs';
import { fieldsFromPayload } from '../lib/stdinUsage.mjs';
import { buildPaths, resolveScratchDir } from '../lib/statusPaths.mjs';

const NOW = new Date('2026-05-31T10:00:00Z');
const H = 3600000;
const ESC = '\x1b';
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, ''); // eslint-disable-line no-control-regex

const full = (env = {}) => resolveTier('auto', { WT_SESSION: 'x', FORCE_HYPERLINK: '0', ...env }, 'win32');
const usage = (five, seven, fiveReset = NOW.getTime() + 2 * H) => ({
  five_hour: { utilization: five, resets_at: fiveReset },
  seven_day: { utilization: seven, resets_at: NOW.getTime() + 3 * 24 * H },
});
const compact = (u, extra = {}) => formatStatusLine(u, 95, ['five_hour', 'seven_day'], {
  now: NOW, locale: 'en-US', hour12: false, timeZone: 'UTC', layout: 'compact', tier: full(),
  glyphs: GLYPHS.emoji, warnBand: 80, showModel: true, showContext: true, paceArrow: true, showPaths: true, ...extra,
});

// ---- resolveTier ----

const tierOf = (env, platform = 'win32') => resolveTier('auto', env, platform).name;

test('resolveTier: full-tier detection rules', () => {
  for (const env of [{ WT_SESSION: 'a' }, { TERM_PROGRAM: 'vscode' }, { TERM_PROGRAM: 'WezTerm' }, { KITTY_WINDOW_ID: '1' },
    { TERM: 'alacritty' }, { VTE_VERSION: '6800' }]) {
    assert.equal(tierOf(env, 'linux'), 'full', JSON.stringify(env));
  }
  assert.equal(tierOf({ VTE_VERSION: '5000' }, 'linux'), 'basic'); // VTE 0.50.0 is excluded
});

test('resolveTier: tmux/screen override full to basic', () => {
  assert.equal(tierOf({ WT_SESSION: 'a', TMUX: '/tmp/t' }), 'basic');
  assert.equal(tierOf({ TERM_PROGRAM: 'iTerm.app', STY: '1' }, 'darwin'), 'basic');
});

test('resolveTier: basic markers and non-win32 default', () => {
  assert.equal(tierOf({ TERMINAL_EMULATOR: 'JetBrains-JediTerm' }), 'basic');
  assert.equal(tierOf({ KONSOLE_VERSION: '1' }, 'linux'), 'basic');
  assert.equal(tierOf({ TERM_PROGRAM: 'Apple_Terminal' }, 'darwin'), 'basic');
  assert.equal(tierOf({}, 'linux'), 'basic');
});

test('resolveTier: win32 default, ConEmu and dumb terminals are ascii', () => {
  assert.equal(tierOf({}), 'ascii');
  assert.equal(tierOf({ ConEmuANSI: 'ON' }), 'ascii');
  assert.equal(tierOf({ TERM: 'dumb' }, 'linux'), 'ascii');
  assert.equal(tierOf({ TERM: 'linux' }, 'linux'), 'ascii');
});

test('resolveTier: explicit style wins; NO_COLOR only drops color', () => {
  assert.equal(resolveTier('emoji', {}, 'win32').name, 'full');
  assert.equal(resolveTier('basic', { WT_SESSION: 'a' }, 'win32').name, 'basic');
  assert.equal(resolveTier('ascii', { WT_SESSION: 'a' }, 'win32').name, 'ascii');
  const t = resolveTier('auto', { WT_SESSION: 'a', NO_COLOR: '1' }, 'win32');
  assert.equal(t.name, 'full');
  assert.equal(t.color, false);
});

test('resolveTier: bar glyph set and OSC 8 links gating', () => {
  assert.equal(resolveTier('auto', { WT_SESSION: 'a' }, 'win32').bar, 'pill');
  assert.equal(resolveTier('auto', { TERM_PROGRAM: 'vscode' }, 'win32').bar, 'block');
  assert.equal(resolveTier('auto', {}, 'win32').bar, 'ascii');
  const links = (env) => resolveTier('auto', env, 'win32').links;
  assert.equal(links({ WT_SESSION: 'a' }), false); // WT: Claude Code drops links unless forced
  assert.equal(links({ WT_SESSION: 'a', FORCE_HYPERLINK: '1' }), true);
  assert.equal(links({ WT_SESSION: 'a', FORCE_HYPERLINK: '0' }), false);
  assert.equal(links({ TERM_PROGRAM: 'vscode' }), true);
  assert.equal(links({ TERM_PROGRAM: 'vscode', FORCE_HYPERLINK: '0' }), false);
  assert.equal(resolveTier('basic', { FORCE_HYPERLINK: '1' }, 'win32').links, false);
});

// ---- compact rendering ----

test('compact full tier: target look with colors, pill bar, separators', () => {
  const out = compact(usage(84, 25), { model: 'Opus 5.5', contextPct: 42, paths: [{ kind: 'project', name: 'proj', dir: '/p' }] });
  assert.equal(strip(out), '🤖 Opus 5.5 │ 🧠 ▰▰▰▰▱▱▱▱▱▱ 42% │ ⏳ 5h 84%↑ 12:00 │ 📅 7d 25% Wed 10:00 │ 🏠 proj');
  assert.ok(out.includes(`${ESC}[38;5;114m▰▰▰▰▱▱▱▱▱▱ 42%${ESC}[0m`)); // green context
  assert.ok(out.includes(`⏳ ${ESC}[38;5;245m5h${ESC}[0m`)); // dim label, icon uncolored
  assert.ok(out.startsWith('🤖 Opus 5.5 │ 🧠 '));
  assert.ok(out.includes(`${ESC}[38;5;214m84%↑${ESC}[0m`)); // amber band
});

test('compact basic tier: 16 colors, block bar, no emoji prefixes, no links', () => {
  const tier = resolveTier('basic', { FORCE_HYPERLINK: '1' }, 'linux');
  const out = compact(usage(96, 25), { tier, model: 'M', contextPct: 30, glyphs: GLYPHS.ascii,
    paths: [{ kind: 'worktree', name: 'wt', dir: '/w' }, { kind: 'scratch', name: 'sc', dir: '/s' }] });
  assert.equal(strip(out), 'M │ ███░░░░░░░ 30% │ 5h 96%↑ 12:00 │ 7d 25% Wed 10:00 │ wt │ sc');
  assert.ok(out.includes(`${ESC}[31m96%`)); // red
  assert.ok(out.includes(`${ESC}[90m5h`)); // dim
  assert.ok(!out.includes(']8;;'));
});

test('compact ascii tier: [####------] bar, pipe separator, ^ arrow', () => {
  const tier = resolveTier('ascii', {}, 'win32');
  const out = compact(usage(84, 25), { tier, contextPct: 42, model: 'M', glyphs: GLYPHS.ascii });
  assert.equal(strip(out), 'M | [####------] 42% | 5h 84%^ 12:00 | 7d 25% Wed 10:00');
});

test('compact full tier: emoji prefixes for worktree/scratch', () => {
  const out = strip(compact(usage(10, 10), { paths: [{ kind: 'worktree', name: 'rule-fixes', dir: '/w' }, { kind: 'scratch', name: 'scratchpad', dir: '/s' }] }));
  assert.match(out, /│ 🔀 rule-fixes │ 📁 scratchpad$/);
});

test('compact: NO_COLOR strips every SGR sequence', () => {
  const tier = resolveTier('auto', { WT_SESSION: 'a', NO_COLOR: '1', FORCE_HYPERLINK: '0' }, 'win32');
  const out = compact(usage(84, 25), { tier, contextPct: 90, model: 'M' });
  assert.ok(!out.includes(`${ESC}[`));
});

test('compact: context color thresholds 49/50/79/80', () => {
  const colorOf = (pct) => compact(usage(10, 10), { contextPct: pct }).match(/\x1b\[(38;5;\d+)m[▰▱]/)[1]; // eslint-disable-line no-control-regex
  assert.equal(colorOf(49), '38;5;114');
  assert.equal(colorOf(50), '38;5;214');
  assert.equal(colorOf(79), '38;5;214');
  assert.equal(colorOf(80), '38;5;203');
});

test('compact: pace arrow margin 9.9 vs 10, no resets_at, and toggle', () => {
  // five_hour, 2h left of 5h => 60% elapsed
  const reset = NOW.getTime() + 2 * H;
  assert.equal(paceAhead('five_hour', { utilization: 69.9, resets_at: reset }, NOW), false);
  assert.equal(paceAhead('five_hour', { utilization: 70, resets_at: reset }, NOW), true);
  assert.equal(paceAhead('five_hour', { utilization: 99 }, NOW), false);
  assert.equal(paceAhead('seven_day', { utilization: 50, resets_at: NOW.getTime() + 84 * H }, NOW), false); // exactly on pace
  assert.match(strip(compact(usage(70, 10))), /5h 70%↑/);
  assert.doesNotMatch(strip(compact(usage(70, 10), { paceArrow: false })), /↑/);
});

test('compact: nearest picks highest utilization/threshold ratio, honoring overrides', () => {
  const u = usage(50, 60);
  assert.match(strip(compact(u, { windowDisplay: 'nearest' })), /7d 60%/);
  assert.doesNotMatch(strip(compact(u, { windowDisplay: 'nearest' })), /5h/);
  const out = strip(compact(u, { windowDisplay: 'nearest', thresholdOverrides: { five_hour: 60 } }));
  assert.match(out, /5h 50%/);
  assert.doesNotMatch(out, /7d/);
});

test('compact: reset same day vs other day, relative and both', () => {
  const out = strip(compact(usage(10, 10)));
  assert.match(out, /5h 10% 12:00 │ 📅 7d 10% Wed 10:00/);
  assert.match(strip(compact(usage(10, 10), { resetDisplay: 'relative' })), /5h 10% in 2h │ 📅 7d 10% in 72h/);
  assert.match(strip(compact(usage(10, 10), { resetDisplay: 'both' })), /5h 10% 12:00 \(in 2h\)/);
  assert.match(strip(compact(usage(10, 10), { locale: 'cs-CZ' })), /7d 10% st 10:00/);
});

test('compact: missing segments are omitted, no usage keeps classic fallbacks', () => {
  const out = strip(compact(usage(10, 10), { showModel: false, showContext: false, showPaths: false, model: 'M', contextPct: 5 }));
  assert.equal(out, '⏳ 5h 10% 12:00 │ 📅 7d 10% Wed 10:00');
  assert.equal(strip(compact({ five_hour: { utilization: 10 } }, { model: null, contextPct: null })), '⏳ 5h 10%'); // 7d absent, no "?"
  assert.equal(compact(null), '⚪ limit ?');
  assert.match(compact({ authError: true }), /🔑/);
  assert.equal(compact({}, { model: 'M' }), '⚪ limit ?');
});

test('compact: projection segment follows the windows when on', () => {
  const out = strip(compact(usage(10, 10), { projectionDisplay: 'on', projection: { minutes: 100, threshold: 90 }, paths: [{ kind: 'project', name: 'p', dir: '/p' }] }));
  assert.match(out, /Wed 10:00 │ 📈 ~1h40m to 90% │ 🏠 p$/);
});

test('compact: OSC 8 links use BEL terminator and file URL when enabled', () => {
  const dir = tmpdir();
  const tier = resolveTier('auto', { TERM_PROGRAM: 'vscode' }, 'win32');
  const out = compact(usage(10, 10), { tier, paths: [{ kind: 'project', name: 'p', dir }] });
  assert.ok(out.endsWith(`${ESC}]8;;${pathToFileURL(dir).href}\x07🏠 p${ESC}]8;;\x07`));
  const off = compact(usage(10, 10), { paths: [{ kind: 'project', name: 'p', dir }] }); // WT w/o FORCE_HYPERLINK=1
  assert.ok(!off.includes(']8;;'));
});

test('compact: path segments keep their folder links, no other links', () => {
  const out = compact(usage(10, 10), { tier: resolveTier('auto', { TERM_PROGRAM: 'vscode' }, 'win32'), model: 'M', contextPct: 42, paths: [{ kind: 'project', name: 'p', dir: tmpdir() }] });
  assert.ok(out.endsWith(`${ESC}]8;;${pathToFileURL(tmpdir()).href}\x07🏠 p${ESC}]8;;\x07`));
});

test('compact: control characters in names cannot inject escapes', () => {
  const out = compact(usage(10, 10), { model: 'Bad\x1b[31m\x07', paths: [{ kind: 'project', name: 'a\x1bb', dir: null }] });
  assert.ok(strip(out).startsWith('🤖 Bad[31m │'));
  assert.ok(!out.includes('\x07'));
});

test('classic layout (default) is unchanged by the new options', () => {
  const classic = formatStatusLine(usage(72, 39), 95, ['five_hour'], { now: NOW, locale: 'en-US', hour12: false, timeZone: 'UTC' });
  assert.equal(classic, '🟢 Limit session: 72% → 12:00');
  assert.equal(classic, formatStatusLine(usage(72, 39), 95, ['five_hour'], {
    now: NOW, locale: 'en-US', hour12: false, timeZone: 'UTC', layout: 'classic', model: 'M', contextPct: 50, showPaths: true, paths: [{ kind: 'project', name: 'p' }],
  }));
});

// ---- stdin payload mapping ----

test('fieldsFromPayload: maps documented fields', () => {
  assert.deepEqual(fieldsFromPayload({
    model: { display_name: 'Opus 5.5' }, session_id: 's1', cwd: '/c',
    workspace: { project_dir: '/p', current_dir: '/w', git_worktree: 'wt' },
    worktree: { name: 'rf', path: '/wt' }, context_window: { used_percentage: 42 },
  }), { model: 'Opus 5.5', contextPct: 42, sessionId: 's1', projectDir: '/p', currentDir: '/w', worktreeName: 'rf', worktreePath: '/wt' });
});

test('fieldsFromPayload: missing/null/invalid -> null fields, never throws', () => {
  const empty = { model: null, contextPct: null, sessionId: null, projectDir: null, currentDir: null, worktreeName: null, worktreePath: null };
  for (const p of [null, undefined, 'x', 5, [], {}]) assert.deepEqual(fieldsFromPayload(p), empty);
  const bad = fieldsFromPayload({ model: { display_name: 7 }, context_window: { used_percentage: null }, session_id: '  ', workspace: 'x' });
  assert.deepEqual(bad, empty);
  for (const v of [-1, 101, NaN, '42']) assert.equal(fieldsFromPayload({ context_window: { used_percentage: v } }).contextPct, null);
  assert.equal(fieldsFromPayload({ context_window: { used_percentage: 0 } }).contextPct, 0);
  assert.equal(fieldsFromPayload({ cwd: '/c' }).currentDir, '/c');
  assert.equal(fieldsFromPayload({ workspace: { git_worktree: 'g' } }).worktreeName, 'g');
});

// ---- paths / scratch ----

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'clg-test-'));
  return { root, done: () => rmSync(root, { recursive: true, force: true }) };
}

test('resolveScratchDir: configured dir (relative to project), hidden when empty', () => {
  const { root, done } = sandbox();
  try {
    mkdirSync(join(root, 'proj', 'scr'), { recursive: true });
    const args = { scratchDir: 'scr', projectDir: join(root, 'proj') };
    assert.equal(resolveScratchDir(args), null); // empty dir hidden
    writeFileSync(join(root, 'proj', 'scr', 'a.txt'), 'x');
    assert.equal(resolveScratchDir(args), join(root, 'proj', 'scr'));
    assert.equal(resolveScratchDir({ scratchDir: 'nope', projectDir: root }), null);
  } finally { done(); }
});

test('resolveScratchDir: built-in <tmp>/claude/*/<session>/scratchpad via injected tmp', () => {
  const { root, done } = sandbox();
  try {
    const sp = join(root, 'claude', 'slug-a', 'sess1', 'scratchpad');
    mkdirSync(sp, { recursive: true });
    mkdirSync(join(root, 'claude', 'slug-b'), { recursive: true });
    assert.equal(resolveScratchDir({ sessionId: 'sess1', tmp: root, cachePath: join(root, 's.json') }), null); // empty
    writeFileSync(join(sp, 'f'), 'x');
    assert.equal(resolveScratchDir({ sessionId: 'sess1', tmp: root, cachePath: join(root, 's.json') }), sp);
    assert.equal(resolveScratchDir({ sessionId: 'other', tmp: root, cachePath: join(root, 's.json') }), null);
    assert.equal(resolveScratchDir({ sessionId: '../x', tmp: root, cachePath: join(root, 's.json') }), null); // no traversal
    assert.equal(resolveScratchDir({ sessionId: 'sess1', tmp: join(root, 'missing'), cachePath: join(root, 'other.json') }), null); // fs error -> silent
  } finally { done(); }
});

test('buildPaths: project, worktree only when present, scratch only when usable', () => {
  const { root, done } = sandbox();
  try {
    const fields = { ...fieldsFromPayload({ workspace: { project_dir: '/a/proj', current_dir: '/a/proj/sub' }, session_id: 's' }) };
    assert.deepEqual(buildPaths(fields, { tmp: root, cachePath: join(root, 's.json') }), [{ kind: 'project', name: 'proj', dir: '/a/proj' }]);
    const wt = { ...fields, worktreeName: 'rf', worktreePath: null };
    assert.deepEqual(buildPaths(wt, { tmp: root, cachePath: join(root, 's.json') }).map((p) => [p.kind, p.name, p.dir]),
      [['project', 'proj', '/a/proj'], ['worktree', 'rf', '/a/proj/sub']]);
    const sp = join(root, 'claude', 'x', 's', 'scratchpad');
    mkdirSync(sp, { recursive: true });
    writeFileSync(join(sp, 'f'), '1');
    assert.deepEqual(buildPaths(fields, { tmp: root, cachePath: join(root, 's.json') }).at(-1), { kind: 'scratch', name: 'scratchpad', dir: sp });
    assert.deepEqual(buildPaths(fieldsFromPayload(null), { tmp: root, cachePath: join(root, 's.json') }), []);
  } finally { done(); }
});

// ---- review-fix coverage ----

test('resolveTier: TMUX + TERM=linux is basic (basic markers precede ascii)', () => {
  assert.equal(tierOf({ TMUX: '/t', TERM: 'linux' }, 'linux'), 'basic');
});

test('resolveTier: VTE_VERSION=5000 is not full; tmux + style=emoji is full but pill needs a safe terminal', () => {
  const vte = resolveTier('auto', { VTE_VERSION: '5000' }, 'linux');
  assert.equal(vte.name, 'basic');
  assert.equal(vte.bar, 'block');
  const emoji = resolveTier('emoji', { TMUX: '/t' }, 'linux');
  assert.equal(emoji.name, 'full');
  assert.equal(emoji.bar, 'block'); // TMUX alone does not make pill safe
  assert.equal(resolveTier('auto', { TMUX: '/t', WT_SESSION: 'a' }, 'win32').bar, 'block'); // basic tier
  assert.equal(resolveTier('ascii', { WT_SESSION: 'a' }, 'win32').bar, 'ascii');
});

test('bar_style: every style renders 10 cells; pill degrades to block, explicit styles are honored', () => {
  const bar = (tierArgs, pct, barStyle) => {
    const tier = resolveTier(...tierArgs, barStyle);
    return strip(compact(usage(10, 10), { tier, contextPct: pct, showModel: false })).split(/ [│|] /)[0].replace(/^🧠 /, '').replace(/ \d+%$/, '');
  };
  const wt = ['auto', { WT_SESSION: 'a' }, 'win32'];
  const expected = {
    pill: '▰▰▰▰▱▱▱▱▱▱', block: '████░░░░░░', shade: '▓▓▓▓░░░░░░', square: '■■■■□□□□□□', dot: '●●●●○○○○○○',
    rect: '▮▮▮▮▯▯▯▯▯▯', line: '━━━━──────', braille: '⣿⣿⣿⣿⣀⣀⣀⣀⣀⣀', smooth: '████▎░░░░░',
  };
  for (const [style, glyphs] of Object.entries(expected)) {
    assert.equal(bar(wt, 42, style), glyphs, style);
    assert.equal([...glyphs].length, 10, style);
  }
  const vscode = ['auto', { TERM_PROGRAM: 'vscode' }, 'win32'];
  assert.equal(bar(vscode, 42, 'pill'), expected.block); // default pill unsafe here
  assert.equal(bar(vscode, 42, 'dot'), expected.dot); // explicit style honored in full tier
  assert.equal(bar(['basic', {}, 'linux'], 42, 'dot'), expected.block);
  assert.equal(bar(['ascii', {}, 'win32'], 42, 'dot'), '[####------]');
  assert.equal(bar(wt, 0, 'smooth'), '░░░░░░░░░░');
  assert.equal(bar(wt, 100, 'smooth'), '██████████');
});

test('compact: context rounds once for bar, label and color (49.6 -> 50% amber, 5 cells)', () => {
  const out = compact(usage(10, 10), { contextPct: 49.6 });
  assert.ok(out.includes(`${ESC}[38;5;214m▰▰▰▰▰▱▱▱▱▱ 50%${ESC}[0m`));
});

function baseOpts() {
  return { now: NOW, locale: 'en-US', hour12: false, timeZone: 'UTC', layout: 'compact', tier: resolveTier('auto', { WT_SESSION: 'x', NO_COLOR: '1', FORCE_HYPERLINK: '0' }, 'win32'), glyphs: GLYPHS.emoji, warnBand: 80 };
}

test('compact: nearest ties pick the first watched key; single key; missing-data window ignored', () => {
  const tie = { five_hour: { utilization: 50 }, seven_day: { utilization: 50 } };
  const line = (u, watch) => formatStatusLine(u, 95, watch, { ...baseOpts(), windowDisplay: 'nearest' });
  assert.equal(line(tie, ['five_hour', 'seven_day']), '⏳ 5h 50%');
  assert.equal(line(tie, ['seven_day', 'five_hour']), '📅 7d 50%');
  assert.equal(line(tie, ['seven_day']), '📅 7d 50%');
  assert.equal(line({ five_hour: { utilization: 10 }, seven_day: { utilization: null } }, ['five_hour', 'seven_day']), '⏳ 5h 10%');
  assert.equal(line({ seven_day: { utilization: 90 } }, ['five_hour', 'seven_day']), '📅 7d 90%');
});

test('compact: bidi/zero-width/line-separator characters are stripped (U+202E)', () => {
  const out = compact(usage(10, 10), { model: 'A\u202EB\u200BC\u2028D', paths: [{ kind: 'project', name: 'x\u202Ey', dir: null }] });
  assert.ok(strip(out).startsWith('🤖 ABCD │'));
  assert.ok(out.endsWith('│ 🏠 xy'));
});

test('compact: relative dirs are not linked', () => {
  const tier = resolveTier('auto', { TERM_PROGRAM: 'vscode' }, 'win32');
  assert.ok(!compact(usage(10, 10), { tier, paths: [{ kind: 'project', name: 'p', dir: 'rel/dir' }] }).includes(']8;;'));
});

test('compact: Windows path with a space becomes a percent-encoded file URL', { skip: process.platform !== 'win32' }, () => {
  const tier = resolveTier('auto', { TERM_PROGRAM: 'vscode' }, 'win32');
  const out = compact(usage(10, 10), { tier, paths: [{ kind: 'project', name: 'proj', dir: 'C:\\Users\\a b\\proj' }] });
  assert.ok(out.includes(`${ESC}]8;;file:///C:/Users/a%20b/proj\x07🏠 proj`));
});

test('classic layout: short labels + both resets + projection equals the v0.12 line', () => {
  const u = usage(72, 39);
  u.seven_day.resets_at = NOW.getTime() + 72 * H;
  const opts = { now: NOW, locale: 'en-US', hour12: false, timeZone: 'UTC', labelStyle: 'short', resetDisplay: 'both', projectionDisplay: 'on', projection: { minutes: 100, threshold: 90 } };
  const v012 = '🟢 5h 72% → 12:00 (in 2h) · 🟢 7d 39% → Wednesday 6/3/2026 10:00 (in 72h) · 📈 ~1h40m to 90%'; // captured from the v0.12 formatter
  const watch = ['five_hour', 'seven_day'];
  assert.equal(formatStatusLine(u, 95, watch, opts), v012);
  assert.equal(formatStatusLine(u, 95, watch, { ...opts, layout: 'classic', model: 'M', contextPct: 9, showPaths: true, paths: [{ kind: 'project', name: 'p' }], tier: full() }), v012);
});

test('resolveScratchDir: leading ~ expands to home; empty and missing hidden', () => {
  const { root, done } = sandbox();
  try {
    mkdirSync(join(root, 'notes'));
    assert.equal(resolveScratchDir({ scratchDir: '~/notes', home: root }), null); // empty
    writeFileSync(join(root, 'notes', 'a'), '1');
    assert.equal(resolveScratchDir({ scratchDir: '~/notes', home: root }), join(root, 'notes'));
    assert.equal(resolveScratchDir({ scratchDir: '~other', home: root, projectDir: root }), null); // not a home reference
  } finally { done(); }
});

test('resolveScratchDir: built-in lookup is cached per session and re-scanned when the dir vanishes', () => {
  const { root, done } = sandbox();
  try {
    const spA = join(root, 'claude', 'aaa', 'sess9', 'scratchpad');
    mkdirSync(spA, { recursive: true });
    writeFileSync(join(spA, 'f'), '1');
    const cachePath = join(root, 'cache.json');
    const args = { sessionId: 'sess9', tmp: root, cachePath };
    assert.equal(resolveScratchDir(args), spA);
    assert.deepEqual(JSON.parse(readFileSync(cachePath, 'utf8')), { sess9: spA });
    // a cache hit must not need the scan: point tmp at a dir with no `claude` folder
    assert.equal(resolveScratchDir({ ...args, tmp: join(root, 'elsewhere') }), spA);
    // dir moves to another slug: the stale cache entry is replaced by a fresh scan
    rmSync(join(root, 'claude', 'aaa'), { recursive: true, force: true });
    const spB = join(root, 'claude', 'bbb', 'sess9', 'scratchpad');
    mkdirSync(spB, { recursive: true });
    writeFileSync(join(spB, 'f'), '1');
    assert.equal(resolveScratchDir(args), spB);
    assert.deepEqual(JSON.parse(readFileSync(cachePath, 'utf8')), { sess9: spB });
    writeFileSync(cachePath, '{ nope'); // corrupt cache is ignored
    assert.equal(resolveScratchDir(args), spB);
  } finally { done(); }
});

// ---- background option ----

const E = (sgr) => `${ESC}[${sgr}m`;
const R = `${ESC}[0m`;
const bgOf = (background, u = usage(10, 10), extra = {}) => compact(u, { background, model: 'M', contextPct: 30, ...extra });
const cells = (s) => [...strip(s)].length + 4; // the four emoji icons are 2 cells wide

test('background: unset and off render no background SGR', () => {
  for (const out of [bgOf(undefined, usage(96, 96)), bgOf('off', usage(96, 96))]) assert.ok(!/48;5|;4[0-7]m|\x1b\[100m/.test(out), out); // eslint-disable-line no-control-regex
});

test('background warn: amber limit gets a black-on-amber tile, plain inside, arrow kept', () => {
  const out = bgOf('warn', usage(84, 25));
  assert.ok(out.includes(`${E('38;5;16;48;5;214')} ⏳ 5h 84%↑ 12:00 ${R}`), out);
  assert.ok(!out.includes('38;5;245m5h')); // no dim label inside the tile
  assert.ok(out.includes(`📅 ${E('38;5;245')}7d${R} ${E('38;5;114')}25%${R}`)); // green limit untouched
  assert.equal(strip(out), '🤖 M │ 🧠 ▰▰▰▱▱▱▱▱▱▱ 30% │  ⏳ 5h 84%↑ 12:00  │ 📅 7d 25% Wed 10:00');
});

test('background warn: red limit gets a white-on-red tile', () => {
  const out = bgOf('warn', usage(96, 25));
  assert.ok(out.includes(`${E('38;5;255;48;5;160')} ⏳ 5h 96%↑ 12:00 ${R}`), out);
});

test('background warn: no tile when every window is green', () => {
  assert.ok(!bgOf('warn', usage(10, 10)).includes('48;5'));
});

test('background warn: context tiles only when red (>=80), amber stays plain', () => {
  const amber = bgOf('warn', usage(10, 10), { contextPct: 79 });
  assert.ok(!amber.includes('48;5'));
  assert.ok(amber.includes(`${E('38;5;214')}▰▰▰▰▰▰▰▰▱▱ 79%${R}`));
  const red = bgOf('warn', usage(10, 10), { contextPct: 80 });
  assert.ok(red.includes(`${E('38;5;255;48;5;160')} 🧠 ▰▰▰▰▰▰▰▰▱▱ 80% ${R}`), red);
});

test('background tiles: own background per segment, no separators, inner resets re-apply the tile', () => {
  const out = bgOf('tiles', usage(84, 25), { paths: [{ kind: 'project', name: 'proj', dir: '/p' }, { kind: 'scratch', name: 'sc', dir: '/s' }] });
  const t = (n) => `38;5;255;48;5;${n}`;
  assert.ok(out.startsWith(`${E(t(54))} 🤖 M ${R}${E(t(23))} 🧠 `));
  assert.ok(out.includes(`${E(t(23))} 🧠 ${E('38;5;156')}▰▰▰▱▱▱▱▱▱▱ 30%${R}${E(t(23))} ${R}`)); // tile SGR re-applied after inner reset
  assert.ok(out.includes(`${E(t(58))} ⏳ ${E('38;5;255')}5h${R}${E(t(58))} ${E('38;5;228')}84%↑${R}${E(t(58))} 12:00 ${R}`));
  assert.ok(out.includes(`${E(t(94))} 📅 `));
  assert.ok(out.endsWith(`${E(t(24))} 🏠 proj ${R}${E(t(236))} 📁 sc ${R}`));
  assert.ok(!strip(out).includes('│'));
});

test('background tiles: projection and worktree use 238', () => {
  const out = bgOf('tiles', usage(10, 10), { projectionDisplay: 'on', projection: { minutes: 100, threshold: 90 }, paths: [{ kind: 'worktree', name: 'wt', dir: '/w' }] });
  assert.ok(out.includes(`${E('38;5;255;48;5;238')} 📈 ~1h40m to 90% ${R}`));
  assert.ok(out.endsWith(`${E('38;5;255;48;5;238')} 🔀 wt ${R}`));
});

test('background tiles: OSC 8 link stays inside the tile', () => {
  const tier = full({ FORCE_HYPERLINK: '1' });
  const out = bgOf('tiles', usage(10, 10), { tier, paths: [{ kind: 'project', name: 'proj', dir: process.platform === 'win32' ? 'C:\\p' : '/p' }] });
  assert.match(out, /\x1b\[38;5;255;48;5;24m \x1b\]8;;file:[^\x07]*\x07🏠 proj\x1b\]8;;\x07 \x1b\[0m$/); // eslint-disable-line no-control-regex
});

test('background bar: whole line on 236, separators kept, padded to COLUMNS (emoji = 2 cells)', () => {
  const plain = '🤖 M │ 🧠 ▰▰▰▱▱▱▱▱▱▱ 30% │ ⏳ 5h 10% 12:00 │ 📅 7d 10% Wed 10:00';
  assert.equal(strip(bgOf('bar', usage(10, 10), { columns: '' })), plain); // no usable width: no padding
  const out = bgOf('bar', usage(10, 10), { columns: 80 });
  assert.ok(out.startsWith(E('48;5;236')) && out.endsWith(R));
  assert.equal(cells(out), 80);
  assert.ok(out.includes(`${R}${E('48;5;236')} │ `)); // inner reset re-applies the bar
  assert.equal(strip(bgOf('bar', usage(10, 10), { columns: 10 })), plain); // narrower than the line: never truncated
});

test('background bar: reads process.env.COLUMNS', () => {
  const prev = process.env.COLUMNS;
  process.env.COLUMNS = '70';
  try {
    assert.equal(cells(bgOf('bar')), 70);
  } finally {
    if (prev === undefined) delete process.env.COLUMNS; else process.env.COLUMNS = prev;
  }
});

test('background: basic tier uses 16-color codes only', () => {
  const tier = resolveTier('basic', {}, 'linux');
  const g = { tier, glyphs: GLYPHS.ascii, model: 'M', contextPct: 85 };
  const warn = compact(usage(84, 96), { ...g, background: 'warn' });
  assert.ok(warn.includes(`${E('30;43')} 5h 84%↑ 12:00 ${R}`), warn);
  assert.ok(warn.includes(`${E('97;41')} 7d 96%↑ Wed 10:00 ${R}`));
  assert.ok(warn.includes(`${E('97;41')} █████████░ 85% ${R}`));
  const tiles = compact(usage(10, 10), { ...g, contextPct: 30, background: 'tiles' });
  assert.ok(tiles.startsWith(`${E('97;100')} M ${R}${E('97;100')} `));
  const bar = compact(usage(10, 10), { ...g, contextPct: 30, background: 'bar', columns: 60 });
  const tilesHot = compact(usage(84, 96), { ...g, contextPct: 30, background: 'tiles' });
  assert.ok(tilesHot.includes(`${E('97')}5h${R}`) && tilesHot.includes(`${E('93')}84%↑${R}`) && tilesHot.includes(`${E('91')}96%↑${R}`) && tilesHot.includes(`${E('92')}`)); // bright pcts, tile-fg label
  assert.ok(bar.startsWith(E('97;100')));
  assert.equal([...strip(bar)].length, 60);
  for (const out of [warn, tiles, bar]) assert.ok(!out.includes('38;5') && !out.includes('48;5'));
});

test('background: ascii tier bar pads to COLUMNS', () => {
  const tier = resolveTier('ascii', {}, 'win32');
  const out = compact(usage(10, 10), { tier, glyphs: GLYPHS.ascii, model: 'M', background: 'bar', columns: 50 });
  assert.equal([...strip(out)].length, 50);
});

test('background: NO_COLOR drops every SGR and tile padding in every mode', () => {
  const tier = resolveTier('auto', { WT_SESSION: 'a', NO_COLOR: '1', FORCE_HYPERLINK: '0' }, 'win32');
  const base = strip(compact(usage(96, 96), { tier, background: 'off', model: 'M', contextPct: 90 }));
  for (const background of ['bar', 'tiles', 'warn']) {
    const out = compact(usage(96, 96), { tier, background, model: 'M', contextPct: 90, columns: 200 });
    assert.equal(out, base, background);
  }
});

test('background: classic layout is unaffected', () => {
  const base = { now: NOW, locale: 'en-US', hour12: false, timeZone: 'UTC', glyphs: GLYPHS.emoji, warnBand: 80 };
  const u = usage(96, 25);
  assert.equal(
    formatStatusLine(u, 95, ['five_hour', 'seven_day'], { ...base, background: 'tiles', columns: 80 }),
    formatStatusLine(u, 95, ['five_hour', 'seven_day'], base),
  );
});

test('background tiles: bright colors only in tiles; bar/warn/off keep the normal palette', () => {
  for (const background of ['off', 'bar', 'warn']) {
    const out = bgOf(background, usage(10, 10));
    assert.ok(out.includes(E('38;5;245')) && out.includes(E('38;5;114')) && !out.includes('38;5;156') && !out.includes('38;5;255m5h'), background);
  }
  const hot = bgOf('tiles', usage(96, 10), { contextPct: 85 });
  assert.ok(hot.includes(`${E('38;5;217')}96%↑${R}`) && hot.includes(`${E('38;5;217')}▰▰▰▰▰▰▰▰▰▱ 85%${R}`)); // red inside tiles
});
