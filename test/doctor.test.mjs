import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDoctor, isNewerVersion } from '../scripts/doctor.mjs';

test('renderDoctor: ok checks show check mark, bad checks show cross + hint', () => {
  const out = renderDoctor([
    { key: 'node', ok: true },
    { key: 'token', ok: false, hint: 'sign in' },
  ], { locale: 'en-US' });
  assert.match(out, /✅.*node/i);
  assert.match(out, /❌.*token/i);
  assert.match(out, /sign in/);
});

test('renderDoctor: neutral check (note) renders without a cross', () => {
  const out = renderDoctor([
    { key: 'version', ok: true, note: 'unknown' },
  ], { locale: 'en-US' });
  assert.doesNotMatch(out, /❌/);
  assert.match(out, /unknown/);
});

test('renderDoctor: localizes the header (cs)', () => {
  const out = renderDoctor([{ key: 'node', ok: true }], { locale: 'cs-CZ' });
  assert.equal(typeof out, 'string');
  assert.ok(out.length > 0);
});

test('renderDoctor: info line shows the info marker, not a cross, and no hint', () => {
  const out = renderDoctor([{ key: 'hyperlink', info: true, ok: true }], { locale: 'en-US' });
  assert.match(out, /ℹ️.*FORCE_HYPERLINK=1/);
  assert.doesNotMatch(out, /❌|✅/);
});

test('isNewerVersion: numeric compare; ahead-of-release or garbage is not a failure', () => {
  assert.equal(isNewerVersion('v0.13.1', '0.13.0'), true);
  assert.equal(isNewerVersion('v0.14.0', '0.13.9'), true);
  assert.equal(isNewerVersion('v0.12.0', '0.13.0'), false); // local ahead of the latest release
  assert.equal(isNewerVersion('v0.13.0', '0.13.0'), false);
  assert.equal(isNewerVersion('v0.9.0', '0.10.0'), false); // not a string compare
  assert.equal(isNewerVersion('nightly', '0.13.0'), false);
  assert.equal(isNewerVersion('v0.13.0', null), false);
});
