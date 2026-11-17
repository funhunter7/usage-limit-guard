import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLUGIN_KEY, resolveReadKey, globalSettingsPath, resolveGlobalKey, readGlobalOptions } from '../lib/pluginSettings.mjs';

const ENV = { CLAUDE_CONFIG_DIR: '/home/u/.claude' };
const readFrom = (raw) => (_path, _enc) => {
  if (raw === undefined) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; }
  return raw;
};

test('globalSettingsPath: honors CLAUDE_CONFIG_DIR', () => {
  assert.match(globalSettingsPath(ENV).replace(/\\/g, '/'), /\/home\/u\/\.claude\/settings\.json$/);
});

test('globalSettingsPath: falls back to ~/.claude', () => {
  assert.match(globalSettingsPath({}).replace(/\\/g, '/'), /\/\.claude\/settings\.json$/);
});

test('resolveGlobalKey: env override wins', () => {
  assert.equal(resolveGlobalKey({}, { CLAUDE_LIMIT_GUARD_PLUGIN_KEY: 'foo@bar' }), 'foo@bar');
});

test('resolveGlobalKey: existing usage-limit-guard@* key', () => {
  const settings = { pluginConfigs: { 'usage-limit-guard@mk': {} } };
  assert.equal(resolveGlobalKey(settings, {}), 'usage-limit-guard@mk');
});

test('resolveGlobalKey: default when nothing matches', () => {
  assert.equal(resolveGlobalKey({}, {}), PLUGIN_KEY);
});

test('resolveGlobalKey: never writes to a legacy claude-limit-guard@* key', () => {
  const settings = { pluginConfigs: { 'claude-limit-guard@mk': {} } };
  assert.equal(resolveGlobalKey(settings, {}), PLUGIN_KEY);
});

test('resolveGlobalKey: env override wins over an existing matching key', () => {
  const settings = { pluginConfigs: { 'usage-limit-guard@mk': {} } };
  assert.equal(resolveGlobalKey(settings, { CLAUDE_LIMIT_GUARD_PLUGIN_KEY: 'foo@bar' }), 'foo@bar');
});

test('readGlobalOptions: missing file -> {}', () => {
  assert.deepEqual(readGlobalOptions(ENV, readFrom(undefined)), {});
});

test('readGlobalOptions: malformed JSON -> {} and debug', () => {
  const logged = [];
  const out = readGlobalOptions(ENV, readFrom('{ not json'), (...a) => logged.push(a.join(' ')));
  assert.deepEqual(out, {});
  assert.ok(logged.some((l) => /settings\.json/.test(l)), `expected a debug line, got ${JSON.stringify(logged)}`);
});

test('readGlobalOptions: reads .options for the resolved key', () => {
  const raw = JSON.stringify({ pluginConfigs: { [PLUGIN_KEY]: { options: { threshold: 90, locale: 'cs-CZ' } } } });
  assert.deepEqual(readGlobalOptions(ENV, readFrom(raw)), { threshold: 90, locale: 'cs-CZ' });
});

test('readGlobalOptions: .options wins over legacy flat keys', () => {
  const raw = JSON.stringify({ pluginConfigs: { [PLUGIN_KEY]: { locale: 'en-US', options: { locale: 'cs-CZ' } } } });
  assert.deepEqual(readGlobalOptions(ENV, readFrom(raw)), { locale: 'cs-CZ' });
});

test('readGlobalOptions: legacy flat option (no .options) is returned', () => {
  const raw = JSON.stringify({ pluginConfigs: { [PLUGIN_KEY]: { locale: 'cs-CZ' } } });
  assert.deepEqual(readGlobalOptions(ENV, readFrom(raw)), { locale: 'cs-CZ' });
});

test('resolveReadKey: falls back to a legacy claude-limit-guard@* key when no new key exists', () => {
  const settings = { pluginConfigs: { 'claude-limit-guard@mk': {} } };
  assert.equal(resolveReadKey(settings, {}), 'claude-limit-guard@mk');
});

test('resolveReadKey: new key wins over a legacy key', () => {
  const settings = { pluginConfigs: { 'claude-limit-guard@mk': {}, [PLUGIN_KEY]: {} } };
  assert.equal(resolveReadKey(settings, {}), PLUGIN_KEY);
});

test('readGlobalOptions: legacy claude-limit-guard@* options are read when no new key exists', () => {
  const raw = JSON.stringify({ pluginConfigs: { 'claude-limit-guard@claude-limit-guard': { options: { threshold: 85 } } } });
  assert.deepEqual(readGlobalOptions(ENV, readFrom(raw)), { threshold: 85 });
});

test('readGlobalOptions: new key wins over legacy key', () => {
  const raw = JSON.stringify({ pluginConfigs: {
    'claude-limit-guard@claude-limit-guard': { options: { threshold: 85 } },
    [PLUGIN_KEY]: { options: { threshold: 95 } },
  } });
  assert.deepEqual(readGlobalOptions(ENV, readFrom(raw)), { threshold: 95 });
});

test('readGlobalOptions: no pluginConfigs -> {}', () => {
  assert.deepEqual(readGlobalOptions(ENV, readFrom(JSON.stringify({ theme: 'dark' }))), {});
});

test('readGlobalOptions: reads options under the env-overridden key', () => {
  const raw = JSON.stringify({ pluginConfigs: { 'other@key': { options: { locale: 'cs-CZ' } } } });
  const out = readGlobalOptions({ ...ENV, CLAUDE_LIMIT_GUARD_PLUGIN_KEY: 'other@key' }, readFrom(raw));
  assert.deepEqual(out, { locale: 'cs-CZ' });
});

test('readGlobalOptions: a UTF-8 BOM before the JSON does not drop all options', () => {
  const raw = String.fromCharCode(0xFEFF) + JSON.stringify({ pluginConfigs: { [PLUGIN_KEY]: { options: { threshold: 70 } } } });
  assert.deepEqual(readGlobalOptions(ENV, readFrom(raw)), { threshold: 70 });
});
