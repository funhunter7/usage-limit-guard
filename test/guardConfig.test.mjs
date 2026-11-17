import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setProjectGuard, clearProjectGuard, setGlobalGuard, clearGlobalGuard, PLUGIN_KEY,
  setProjectOption, clearProjectOption, setGlobalOption, clearGlobalOption,
  setProjectWarn, clearProjectWarn, setGlobalWarn, clearGlobalWarn } from '../lib/guardConfig.mjs';

// In-memory fake fs: a Map of path -> contents.
function fakeFs(initial = {}) {
  const files = new Map(Object.entries(initial));
  return {
    files,
    readFile: (p) => {
      if (!files.has(p)) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; }
      return files.get(p);
    },
    writeFile: (p, data) => { files.set(p, data); },
    mkdir: () => {},
  };
}

test('setProjectGuard: creates file with guardAction', () => {
  const fs = fakeFs();
  const path = setProjectGuard('/proj', 'Save and stop.', fs);
  assert.match(path.replace(/\\/g, '/'), /\/proj\/\.claude\/limit-guard\.json$/);
  assert.deepEqual(JSON.parse(fs.files.get(path)), { guardAction: 'Save and stop.' });
});

test('setProjectGuard: preserves other keys', () => {
  const fs = fakeFs();
  const path = setProjectGuard('/proj', 'x', fs);
  fs.files.set(path, JSON.stringify({ threshold: 90, guardAction: 'x' }));
  setProjectGuard('/proj', 'new', fs);
  assert.deepEqual(JSON.parse(fs.files.get(path)), { threshold: 90, guardAction: 'new' });
});

test('clearProjectGuard: removes only guardAction', () => {
  const fs = fakeFs();
  const path = setProjectGuard('/proj', 'x', fs);
  fs.files.set(path, JSON.stringify({ threshold: 90, guardAction: 'x' }));
  clearProjectGuard('/proj', fs);
  assert.deepEqual(JSON.parse(fs.files.get(path)), { threshold: 90 });
});

test('setProjectGuard: invalid JSON refuses to overwrite', () => {
  const fs = fakeFs();
  const path = setProjectGuard('/proj', 'x', fs);
  fs.files.set(path, '{ not json');
  assert.throws(() => setProjectGuard('/proj', 'y', fs), /Invalid JSON/);
});

test('setProjectOption: writes an arbitrary camelCase key, preserving others', () => {
  const fs = fakeFs();
  const path = setProjectOption('/proj', 'timeFormat', '24', fs);
  assert.match(path.replace(/\\/g, '/'), /\/proj\/\.claude\/limit-guard\.json$/);
  fs.files.set(path, JSON.stringify({ threshold: 90, timeFormat: '24' }));
  setProjectOption('/proj', 'style', 'ascii', fs);
  assert.deepEqual(JSON.parse(fs.files.get(path)), { threshold: 90, timeFormat: '24', style: 'ascii' });
});

test('setProjectOption: stores array values (watch) verbatim', () => {
  const fs = fakeFs();
  const path = setProjectOption('/proj', 'watch', ['seven_day'], fs);
  assert.deepEqual(JSON.parse(fs.files.get(path)), { watch: ['seven_day'] });
});

test('clearProjectOption: removes only the named key', () => {
  const fs = fakeFs();
  const path = setProjectOption('/proj', 'style', 'emoji', fs);
  fs.files.set(path, JSON.stringify({ threshold: 90, style: 'emoji' }));
  clearProjectOption('/proj', 'style', fs);
  assert.deepEqual(JSON.parse(fs.files.get(path)), { threshold: 90 });
});

const ENV = { CLAUDE_CONFIG_DIR: '/home/u/.claude' };

test('setGlobalOption: writes a snake_case key under .options, preserving siblings', () => {
  const fs = fakeFs();
  const path = setGlobalOption('time_format', '24', { ...fs, env: ENV });
  assert.match(path.replace(/\\/g, '/'), /\/home\/u\/\.claude\/settings\.json$/);
  fs.files.set(path, JSON.stringify({
    pluginConfigs: { [PLUGIN_KEY]: { options: { guard_action: 'x', time_format: '24' } } },
  }));
  setGlobalOption('style', 'ascii', { ...fs, env: ENV });
  const opts = JSON.parse(fs.files.get(path)).pluginConfigs[PLUGIN_KEY].options;
  assert.deepEqual(opts, { guard_action: 'x', time_format: '24', style: 'ascii' });
});

test('clearGlobalOption: removes the key, drops an emptied .options', () => {
  const fs = fakeFs();
  const path = setGlobalOption('style', 'emoji', { ...fs, env: ENV });
  fs.files.set(path, JSON.stringify({ pluginConfigs: { [PLUGIN_KEY]: { options: { style: 'emoji' } } } }));
  clearGlobalOption('style', { ...fs, env: ENV });
  assert.equal(JSON.parse(fs.files.get(path)).pluginConfigs[PLUGIN_KEY].options, undefined);
});


test('setGlobalGuard: writes guard_action under .options', () => {
  const fs = fakeFs();
  const path = setGlobalGuard('Save and stop.', { ...fs, env: ENV });
  assert.match(path.replace(/\\/g, '/'), /\/home\/u\/\.claude\/settings\.json$/);
  const obj = JSON.parse(fs.files.get(path));
  assert.equal(obj.pluginConfigs[PLUGIN_KEY].options.guard_action, 'Save and stop.');
});

test('setGlobalGuard: preserves existing settings keys', () => {
  const fs = fakeFs();
  const path = setGlobalGuard('x', { ...fs, env: ENV });
  fs.files.set(path, JSON.stringify({
    statusLine: { type: 'command', command: 'node x' },
    pluginConfigs: { 'other@m': { foo: 1 }, [PLUGIN_KEY]: { options: { threshold: 90, guard_action: 'x' } } },
  }));
  setGlobalGuard('new', { ...fs, env: ENV });
  const obj = JSON.parse(fs.files.get(path));
  assert.deepEqual(obj.statusLine, { type: 'command', command: 'node x' });
  assert.deepEqual(obj.pluginConfigs['other@m'], { foo: 1 });
  assert.equal(obj.pluginConfigs[PLUGIN_KEY].options.guard_action, 'new');
  assert.equal(obj.pluginConfigs[PLUGIN_KEY].options.threshold, 90);
});

test('setGlobalGuard: migrates a legacy flat guard_action into .options', () => {
  const fs = fakeFs();
  const path = setGlobalGuard('x', { ...fs, env: ENV });
  fs.files.set(path, JSON.stringify({ pluginConfigs: { [PLUGIN_KEY]: { guard_action: 'old' } } }));
  setGlobalGuard('new', { ...fs, env: ENV });
  const obj = JSON.parse(fs.files.get(path));
  assert.equal(obj.pluginConfigs[PLUGIN_KEY].options.guard_action, 'new');
  assert.equal(obj.pluginConfigs[PLUGIN_KEY].guard_action, undefined); // flat copy removed
});

test('clearGlobalGuard: removes .options.guard_action, keeps siblings', () => {
  const fs = fakeFs();
  const path = setGlobalGuard('x', { ...fs, env: ENV });
  fs.files.set(path, JSON.stringify({
    pluginConfigs: { [PLUGIN_KEY]: { options: { guard_action: 'x', threshold: 90 } } },
  }));
  clearGlobalGuard({ ...fs, env: ENV });
  const obj = JSON.parse(fs.files.get(path));
  assert.equal(obj.pluginConfigs[PLUGIN_KEY].options.guard_action, undefined);
  assert.equal(obj.pluginConfigs[PLUGIN_KEY].options.threshold, 90);
});

test('clearGlobalGuard: also removes a legacy flat guard_action', () => {
  const fs = fakeFs();
  const path = setGlobalGuard('x', { ...fs, env: ENV });
  fs.files.set(path, JSON.stringify({ pluginConfigs: { [PLUGIN_KEY]: { guard_action: 'x', threshold: 90 } } }));
  clearGlobalGuard({ ...fs, env: ENV });
  const obj = JSON.parse(fs.files.get(path));
  assert.equal(obj.pluginConfigs[PLUGIN_KEY].guard_action, undefined);
  assert.equal(obj.pluginConfigs[PLUGIN_KEY].threshold, 90);
  assert.equal(obj.pluginConfigs[PLUGIN_KEY].options, undefined);
});

test('clearGlobalGuard: removes an emptied .options object', () => {
  const fs = fakeFs();
  const path = setGlobalGuard('x', { ...fs, env: ENV });
  fs.files.set(path, JSON.stringify({ pluginConfigs: { [PLUGIN_KEY]: { options: { guard_action: 'x' } } } }));
  clearGlobalGuard({ ...fs, env: ENV });
  const obj = JSON.parse(fs.files.get(path));
  assert.equal(obj.pluginConfigs[PLUGIN_KEY].options, undefined);
});

test('clearGlobalGuard: no file -> no throw', () => {
  const fs = fakeFs();
  assert.doesNotThrow(() => clearGlobalGuard({ ...fs, env: ENV }));
});

test('setGlobalGuard: writes under an existing usage-limit-guard@* key', () => {
  const fs = fakeFs();
  const path = setGlobalGuard('x', { ...fs, env: ENV });
  fs.files.set(path, JSON.stringify({ pluginConfigs: { 'usage-limit-guard@my-market': { foo: 1 } } }));
  setGlobalGuard('new', { ...fs, env: ENV });
  const obj = JSON.parse(fs.files.get(path));
  assert.equal(obj.pluginConfigs['usage-limit-guard@my-market'].options.guard_action, 'new');
  assert.equal(obj.pluginConfigs['usage-limit-guard@my-market'].foo, 1);
  assert.equal(obj.pluginConfigs[PLUGIN_KEY], undefined); // did not create the default key
});

test('setGlobalGuard: CLAUDE_LIMIT_GUARD_PLUGIN_KEY override picks the key', () => {
  const fs = fakeFs();
  const path = setGlobalGuard('x', { ...fs, env: { ...ENV, CLAUDE_LIMIT_GUARD_PLUGIN_KEY: 'foo@bar' } });
  const obj = JSON.parse(fs.files.get(path));
  assert.equal(obj.pluginConfigs['foo@bar'].options.guard_action, 'x');
});

test('clearGlobalGuard: clears under an existing usage-limit-guard@* key', () => {
  const fs = fakeFs();
  const path = setGlobalGuard('x', { ...fs, env: ENV });
  fs.files.set(path, JSON.stringify({ pluginConfigs: { 'usage-limit-guard@mk': { options: { guard_action: 'x', threshold: 90 } } } }));
  clearGlobalGuard({ ...fs, env: ENV });
  const obj = JSON.parse(fs.files.get(path));
  assert.equal(obj.pluginConfigs['usage-limit-guard@mk'].options.guard_action, undefined);
  assert.equal(obj.pluginConfigs['usage-limit-guard@mk'].options.threshold, 90);
});

// --- warn_action setters ---

test('setProjectWarn: creates file with warnAction', () => {
  const fs = fakeFs();
  const path = setProjectWarn('/proj', 'Wrap up soon.', fs);
  assert.match(path.replace(/\\/g, '/'), /\/proj\/\.claude\/limit-guard\.json$/);
  assert.deepEqual(JSON.parse(fs.files.get(path)), { warnAction: 'Wrap up soon.' });
});

test('setProjectWarn: preserves other keys', () => {
  const fs = fakeFs();
  const path = setProjectWarn('/proj', 'x', fs);
  fs.files.set(path, JSON.stringify({ threshold: 90, warnAction: 'x' }));
  setProjectWarn('/proj', 'new warn', fs);
  assert.deepEqual(JSON.parse(fs.files.get(path)), { threshold: 90, warnAction: 'new warn' });
});

test('clearProjectWarn: removes only warnAction', () => {
  const fs = fakeFs();
  const path = setProjectWarn('/proj', 'x', fs);
  fs.files.set(path, JSON.stringify({ threshold: 90, warnAction: 'x' }));
  clearProjectWarn('/proj', fs);
  assert.deepEqual(JSON.parse(fs.files.get(path)), { threshold: 90 });
});

test('setGlobalWarn: writes warn_action under .options', () => {
  const fs = fakeFs();
  const path = setGlobalWarn('Save a draft.', { ...fs, env: ENV });
  assert.match(path.replace(/\\/g, '/'), /\/home\/u\/\.claude\/settings\.json$/);
  const obj = JSON.parse(fs.files.get(path));
  assert.equal(obj.pluginConfigs[PLUGIN_KEY].options.warn_action, 'Save a draft.');
});

test('setGlobalWarn: preserves existing siblings (guard_action stays)', () => {
  const fs = fakeFs();
  const path = setGlobalWarn('x', { ...fs, env: ENV });
  fs.files.set(path, JSON.stringify({
    pluginConfigs: { [PLUGIN_KEY]: { options: { guard_action: 'g', threshold: 90 } } },
  }));
  setGlobalWarn('new warn', { ...fs, env: ENV });
  const opts = JSON.parse(fs.files.get(path)).pluginConfigs[PLUGIN_KEY].options;
  assert.equal(opts.warn_action, 'new warn');
  assert.equal(opts.guard_action, 'g');
  assert.equal(opts.threshold, 90);
});

test('clearGlobalWarn: removes warn_action, keeps siblings', () => {
  const fs = fakeFs();
  const path = setGlobalWarn('x', { ...fs, env: ENV });
  fs.files.set(path, JSON.stringify({
    pluginConfigs: { [PLUGIN_KEY]: { options: { warn_action: 'x', guard_action: 'g' } } },
  }));
  clearGlobalWarn({ ...fs, env: ENV });
  const opts = JSON.parse(fs.files.get(path)).pluginConfigs[PLUGIN_KEY].options;
  assert.equal(opts.warn_action, undefined);
  assert.equal(opts.guard_action, 'g');
});

test('clearGlobalWarn: drops an emptied .options', () => {
  const fs = fakeFs();
  const path = setGlobalWarn('x', { ...fs, env: ENV });
  fs.files.set(path, JSON.stringify({ pluginConfigs: { [PLUGIN_KEY]: { options: { warn_action: 'x' } } } }));
  clearGlobalWarn({ ...fs, env: ENV });
  assert.equal(JSON.parse(fs.files.get(path)).pluginConfigs[PLUGIN_KEY].options, undefined);
});

test('clearGlobalWarn: no file -> no throw', () => {
  const fs = fakeFs();
  assert.doesNotThrow(() => clearGlobalWarn({ ...fs, env: ENV }));
});

// --- global settings.json hardening: BOM tolerated, backup taken, atomic write (real fs, scratch dir) ---
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('setGlobalOption: BOM-prefixed settings.json is read, backed up, rewritten atomically', () => {
  const d = mkdtempSync(join(tmpdir(), 'clg-gc-'));
  try {
    const path = join(d, 'settings.json');
    const before = String.fromCharCode(0xFEFF) + JSON.stringify({ model: 'x' });
    writeFileSync(path, before, 'utf8');
    setGlobalOption('threshold', 90, { env: { CLAUDE_CONFIG_DIR: d } });
    const after = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(after.model, 'x'); // BOM did not make the file look invalid / wipe it
    assert.equal(after.pluginConfigs[PLUGIN_KEY].options.threshold, 90);
    assert.equal(readFileSync(path + '.bak-limitguard', 'utf8'), before); // previous bytes preserved
    assert.deepEqual(readdirSync(d).filter((f) => f.endsWith('.tmp')), []); // temp file renamed away
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('setGlobalOption: rename failure falls back to a direct write', () => {
  const fs = fakeFs({ '/g/settings.json': '{}' });
  fs.rename = () => { throw new Error('EPERM'); };
  setGlobalOption('threshold', 80, { ...fs, env: { CLAUDE_CONFIG_DIR: '/g' } });
  assert.equal(JSON.parse(fs.files.get(join('/g', 'settings.json'))).pluginConfigs[PLUGIN_KEY].options.threshold, 80);
});

test('setProjectOption: project file gets no backup file', () => {
  const fs = fakeFs();
  const path = setProjectOption('/proj', 'threshold', 80, fs);
  assert.equal(fs.files.has(path + '.bak-limitguard'), false);
});
