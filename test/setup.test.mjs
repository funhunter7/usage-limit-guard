import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeForceHyperlink, computeSettings, runSetup } from '../bin/setup.mjs';
import { getMessages } from '../lib/messages.mjs';

const CMD = 'node "/root/bin/usage.mjs" --statusline';

test('computeSettings: adds statusLine with refreshInterval when absent', () => {
  const { settings, changed } = computeSettings({}, CMD);
  assert.equal(changed, true);
  assert.deepEqual(settings.statusLine, { type: 'command', command: CMD, refreshInterval: 60 });
});

test('computeSettings: no-op when command and refreshInterval already match', () => {
  const existing = { statusLine: { type: 'command', command: CMD, refreshInterval: 60 }, other: 1 };
  const { changed, settings } = computeSettings(existing, CMD);
  assert.equal(changed, false);
  assert.equal(settings.other, 1);
});

test('computeSettings: upgrades an existing wiring that lacks refreshInterval', () => {
  const existing = { statusLine: { type: 'command', command: CMD }, keep: 3 };
  const { changed, settings } = computeSettings(existing, CMD);
  assert.equal(changed, true);
  assert.equal(settings.statusLine.refreshInterval, 60);
  assert.equal(settings.keep, 3);
});

test('computeSettings: overwrites a different command, preserves other keys', () => {
  const { settings, changed } = computeSettings({ statusLine: { type: 'command', command: 'old' }, keep: 2 }, CMD);
  assert.equal(changed, true);
  assert.equal(settings.statusLine.command, CMD);
  assert.equal(settings.keep, 2);
});

// --- --force-hyperlink / runSetup (settings path injected: never the real ~/.claude) ---

const dir = () => mkdtempSync(join(tmpdir(), 'clg-setup-'));
const en = getMessages('en-US');

test('computeForceHyperlink: sets env.FORCE_HYPERLINK=1, keeps other keys, no-op when set', () => {
  const r = computeForceHyperlink({ keep: 1, env: { A: 'b' } });
  assert.equal(r.changed, true);
  assert.deepEqual(r.settings, { keep: 1, env: { A: 'b', FORCE_HYPERLINK: '1' } });
  assert.equal(computeForceHyperlink({ env: { FORCE_HYPERLINK: '1' } }).changed, false);
  const off = computeForceHyperlink({ env: { FORCE_HYPERLINK: '0' } });
  assert.deepEqual([off.changed, off.optedOut, off.settings.env.FORCE_HYPERLINK], [false, true, '0']); // explicit opt-out kept
  assert.throws(() => computeForceHyperlink({ env: 'x' }), /not an object/);
  assert.throws(() => computeForceHyperlink({ env: [1] }), /not an object/);
});

test('runSetup --force-hyperlink: backs up, writes env, then is idempotent', () => {
  const d = dir();
  try {
    const settingsPath = join(d, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({ model: 'x' }), 'utf8');
    const first = runSetup({ pluginRoot: '/root', settingsPath, forceHyperlink: true, m: en });
    assert.equal(first.length, 2);
    assert.equal(first[1], en.setupHyperlinkSet);
    assert.deepEqual(JSON.parse(readFileSync(settingsPath, 'utf8')), { model: 'x', env: { FORCE_HYPERLINK: '1' } });
    assert.deepEqual(JSON.parse(readFileSync(settingsPath + '.bak-limitguard', 'utf8')), { model: 'x' });
    assert.deepEqual(runSetup({ pluginRoot: '/root', settingsPath, forceHyperlink: true, m: en }), [en.setupHyperlinkAlready]);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('runSetup --force-hyperlink: creates settings.json when missing; does not touch statusLine', () => {
  const d = dir();
  try {
    const settingsPath = join(d, 'settings.json');
    assert.deepEqual(runSetup({ pluginRoot: '/root', settingsPath, forceHyperlink: true, m: en }), [en.setupHyperlinkSet]);
    assert.deepEqual(JSON.parse(readFileSync(settingsPath, 'utf8')), { env: { FORCE_HYPERLINK: '1' } });
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('runSetup (default): wires the status line and keeps env', () => {
  const d = dir();
  try {
    const settingsPath = join(d, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({ env: { FORCE_HYPERLINK: '1' } }), 'utf8');
    runSetup({ pluginRoot: '/root', settingsPath, m: en });
    const s = JSON.parse(readFileSync(settingsPath, 'utf8'));
    assert.equal(s.env.FORCE_HYPERLINK, '1');
    assert.match(s.statusLine.command, /usage\.mjs" --statusline$/);
    assert.deepEqual(runSetup({ pluginRoot: '/root', settingsPath, m: en }), [en.setupAlreadyWired]);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('runSetup --force-hyperlink: FORCE_HYPERLINK=0 is reported and left alone (no write, no backup)', () => {
  const d = dir();
  try {
    const settingsPath = join(d, 'settings.json');
    const raw = JSON.stringify({ env: { FORCE_HYPERLINK: '0' } });
    writeFileSync(settingsPath, raw, 'utf8');
    assert.deepEqual(runSetup({ pluginRoot: '/root', settingsPath, forceHyperlink: true, m: en }), [en.setupHyperlinkOptOut]);
    assert.equal(readFileSync(settingsPath, 'utf8'), raw);
    assert.equal(existsSync(settingsPath + '.bak-limitguard'), false);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('runSetup: unparsable settings.json aborts and writes nothing (wiring and --force-hyperlink)', () => {
  const d = dir();
  try {
    const settingsPath = join(d, 'settings.json');
    writeFileSync(settingsPath, '{ "model": "x", // oops', 'utf8');
    for (const forceHyperlink of [false, true]) {
      assert.throws(() => runSetup({ pluginRoot: '/root', settingsPath, forceHyperlink, m: en }), /not valid JSON/);
    }
    assert.equal(readFileSync(settingsPath, 'utf8'), '{ "model": "x", // oops');
    assert.equal(existsSync(settingsPath + '.bak-limitguard'), false);
    writeFileSync(settingsPath, '[1]', 'utf8');
    assert.throws(() => runSetup({ pluginRoot: '/root', settingsPath, m: en }), /not a JSON object/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('runSetup: a leading BOM is tolerated; a non-object env aborts --force-hyperlink untouched', () => {
  const d = dir();
  try {
    const settingsPath = join(d, 'settings.json');
    writeFileSync(settingsPath, String.fromCharCode(0xfeff) + JSON.stringify({ keep: 1 }), 'utf8');
    runSetup({ pluginRoot: '/root', settingsPath, m: en });
    const s = JSON.parse(readFileSync(settingsPath, 'utf8'));
    assert.equal(s.keep, 1);
    assert.ok(s.statusLine);
    const bad = JSON.stringify({ env: 'oops' });
    writeFileSync(settingsPath, bad, 'utf8');
    assert.throws(() => runSetup({ pluginRoot: '/root', settingsPath, forceHyperlink: true, m: en }), /not an object/);
    assert.equal(readFileSync(settingsPath, 'utf8'), bad);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
