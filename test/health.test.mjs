import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeTokenPresent, probeStatusLineWired, probeCacheAge, probeLinksHidden } from '../lib/health.mjs';

test('probeTokenPresent: true when getToken returns non-null, false on null/throw', () => {
  assert.equal(probeTokenPresent(() => 'tok'), true);
  assert.equal(probeTokenPresent(() => null), false);
  assert.equal(probeTokenPresent(() => { throw new Error('x'); }), false);
});

test('probeStatusLineWired: true when command references usage.mjs', () => {
  const wired = () => JSON.stringify({ statusLine: { command: 'node "/p/bin/usage.mjs" --statusline' } });
  assert.equal(probeStatusLineWired({}, wired, () => true), true);
  const other = () => JSON.stringify({ statusLine: { command: 'something-else' } });
  assert.equal(probeStatusLineWired({}, other), false);
  assert.equal(probeStatusLineWired({}, () => { throw new Error('missing'); }), false);
});

test('probeStatusLineWired: false when the wired usage.mjs no longer exists (stale cache dir)', () => {
  const quoted = () => JSON.stringify({ statusLine: { command: 'node "/p/0.12.0/bin/usage.mjs" --statusline' } });
  const seen = [];
  assert.equal(probeStatusLineWired({}, quoted, (p) => { seen.push(p); return false; }), false);
  assert.deepEqual(seen, ['/p/0.12.0/bin/usage.mjs']);
  const bare = () => JSON.stringify({ statusLine: { command: 'node /q/bin/usage.mjs --statusline' } });
  assert.equal(probeStatusLineWired({}, bare, (p) => p === '/q/bin/usage.mjs'), true);
});

test('probeStatusLineWired: tolerates a UTF-8 BOM in settings.json', () => {
  const bom = () => '\uFEFF' + JSON.stringify({ statusLine: { command: 'node "/p/bin/usage.mjs"' } });
  assert.equal(probeStatusLineWired({}, bom, () => true), true);
});

test('probeCacheAge: null when missing/malformed, otherwise now-ts', () => {
  assert.equal(probeCacheAge('x', 1000, () => { throw new Error('missing'); }), null);
  assert.equal(probeCacheAge('x', 1000, () => JSON.stringify({ data: {} })), null); // no ts
  assert.equal(probeCacheAge('x', 5000, () => JSON.stringify({ ts: 1000, data: {} })), 4000);
});

test('probeLinksHidden: only in Windows Terminal without FORCE_HYPERLINK=1 (env or settings.json)', () => {
  const settings = (obj) => () => JSON.stringify(obj);
  assert.equal(probeLinksHidden({}, settings({})), false); // not Windows Terminal
  assert.equal(probeLinksHidden({ WT_SESSION: 'x' }, settings({})), true);
  assert.equal(probeLinksHidden({ WT_SESSION: 'x', FORCE_HYPERLINK: '1' }, settings({})), false);
  assert.equal(probeLinksHidden({ WT_SESSION: 'x' }, settings({ env: { FORCE_HYPERLINK: '1' } })), false);
  assert.equal(probeLinksHidden({ WT_SESSION: 'x' }, () => { throw new Error('ENOENT'); }), true);
  // an explicit FORCE_HYPERLINK=0 (env or settings.json) is a deliberate opt-out, not "hidden"
  assert.equal(probeLinksHidden({ WT_SESSION: 'x', FORCE_HYPERLINK: '0' }, settings({})), false);
  assert.equal(probeLinksHidden({ WT_SESSION: 'x' }, settings({ env: { FORCE_HYPERLINK: '0' } })), false);
});
