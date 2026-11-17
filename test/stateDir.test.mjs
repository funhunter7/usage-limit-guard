import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize } from 'node:path';
import { stateDir, statePath, writeStateFile } from '../lib/stateDir.mjs';

const HOME = join('/h', 'u');

test('stateDir: CLAUDE_PLUGIN_DATA wins (normalized, so forward and back slashes agree)', () => {
  assert.equal(stateDir({ CLAUDE_PLUGIN_DATA: '/d/plugins/data/x' }, HOME), normalize('/d/plugins/data/x'));
});

test('stateDir: without CLAUDE_PLUGIN_DATA it is computed the way Claude Code names the data folder', () => {
  assert.equal(stateDir({}, HOME), join(HOME, '.claude', 'plugins', 'data', 'usage-limit-guard-usage-limit-guard'));
  assert.equal(stateDir({ CLAUDE_CONFIG_DIR: '/cfg' }, HOME), join('/cfg', 'plugins', 'data', 'usage-limit-guard-usage-limit-guard'));
});

test('hook (CLAUDE_PLUGIN_DATA) and status line (computed) resolve the same file', () => {
  const computed = statePath('cache.json', {}, HOME);
  const hookEnv = { CLAUDE_PLUGIN_DATA: join(HOME, '.claude', 'plugins', 'data', 'usage-limit-guard-usage-limit-guard').replaceAll('\\', '/') };
  assert.equal(statePath('cache.json', hookEnv, HOME), computed);
});

test('writeStateFile creates the data folder on first write', () => {
  const d = mkdtempSync(join(tmpdir(), 'clg-state-'));
  try {
    const p = join(d, 'a', 'b', 'x.json');
    writeStateFile(p, '{"k":1}');
    assert.equal(readFileSync(p, 'utf8'), '{"k":1}');
  } finally { rmSync(d, { recursive: true, force: true }); }
});
