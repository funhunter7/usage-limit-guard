import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repairStatusLine } from '../lib/statusLine.mjs';

const sandbox = () => {
  const d = mkdtempSync(join(tmpdir(), 'clg-repair-'));
  const settingsPath = join(d, 'settings.json');
  const root = join(d, 'plugins', 'marketplaces', 'usage-limit-guard');
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(join(root, 'scripts', 'usage.mjs'), '//');
  return { d, settingsPath, root, done: () => rmSync(d, { recursive: true, force: true }) };
};
const wire = (p, command, extra = {}) => writeFileSync(p, JSON.stringify({ theme: 'dark', statusLine: { type: 'command', command, refreshInterval: 60, ...extra } }));
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

test('repairStatusLine: dangling cache-dir wiring is re-pointed, other keys kept, backup written', () => {
  const s = sandbox();
  try {
    const dead = join(s.d, 'plugins', 'cache', 'claude-limit-guard', 'claude-limit-guard', '0.13.0', 'bin', 'usage.mjs');
    wire(s.settingsPath, `node "${dead}" --statusline`);
    const out = repairStatusLine({ pluginRoot: s.root, settingsPath: s.settingsPath });
    const want = `node "${join(s.root, 'scripts', 'usage.mjs')}" --statusline`;
    assert.equal(out, want);
    const after = read(s.settingsPath);
    assert.equal(after.statusLine.command, want);
    assert.equal(after.statusLine.refreshInterval, 60);
    assert.equal(after.theme, 'dark');
    assert.ok(existsSync(s.settingsPath + '.bak-limitguard'));
  } finally { s.done(); }
});

test('repairStatusLine: legacy bin/ wiring that still exists is moved to scripts/', () => {
  const s = sandbox();
  try {
    const legacy = join(s.d, 'old', 'usage-limit-guard', 'bin', 'usage.mjs');
    mkdirSync(join(legacy, '..'), { recursive: true });
    writeFileSync(legacy, '//');
    wire(s.settingsPath, `node "${legacy}" --statusline`);
    assert.ok(repairStatusLine({ pluginRoot: s.root, settingsPath: s.settingsPath }));
  } finally { s.done(); }
});

test('repairStatusLine: a healthy current wiring is left alone (no write)', () => {
  const s = sandbox();
  try {
    wire(s.settingsPath, `node "${join(s.root, 'scripts', 'usage.mjs')}" --statusline`);
    assert.equal(repairStatusLine({ pluginRoot: s.root, settingsPath: s.settingsPath }), null);
    assert.ok(!existsSync(s.settingsPath + '.bak-limitguard'));
  } finally { s.done(); }
});

test('repairStatusLine: never touches a status line that is not ours', () => {
  const s = sandbox();
  try {
    for (const command of ['node "/somewhere/else/bin/usage.mjs"', 'my-statusline --fancy', 'node "/x/other-plugin/scripts/usage.mjs"']) {
      wire(s.settingsPath, command);
      const before = readFileSync(s.settingsPath, 'utf8');
      assert.equal(repairStatusLine({ pluginRoot: s.root, settingsPath: s.settingsPath }), null, command);
      assert.equal(readFileSync(s.settingsPath, 'utf8'), before);
    }
    writeFileSync(s.settingsPath, '{ not json');
    assert.equal(repairStatusLine({ pluginRoot: s.root, settingsPath: s.settingsPath }), null);
    assert.equal(repairStatusLine({ pluginRoot: s.root, settingsPath: join(s.d, 'missing.json') }), null);
  } finally { s.done(); }
});

test('repairStatusLine: does nothing when the current script path does not exist either', () => {
  const s = sandbox();
  try {
    wire(s.settingsPath, 'node "/gone/usage-limit-guard/bin/usage.mjs" --statusline');
    assert.equal(repairStatusLine({ pluginRoot: join(s.d, 'nope'), settingsPath: s.settingsPath }), null);
  } finally { s.done(); }
});
