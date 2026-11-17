import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notify } from '../lib/notify.mjs';

test('notify: macOS uses osascript with title + message', () => {
  let seen;
  const run = (cmd, args) => { seen = { cmd, args }; };
  notify('usage-limit-guard', '5h at 90%', { platform: 'darwin', run });
  assert.equal(seen.cmd, 'osascript');
  assert.match(seen.args.join(' '), /display notification .*5h at 90%.* with title .*usage-limit-guard/);
});

test('notify: linux uses notify-send with title and message as separate args', () => {
  let seen;
  const run = (cmd, args) => { seen = { cmd, args }; };
  notify('T', 'M', { platform: 'linux', run });
  assert.equal(seen.cmd, 'notify-send');
  assert.deepEqual(seen.args, ['T', 'M']);
});

test('notify: windows uses powershell with a toast script containing title + message', () => {
  let seen;
  const run = (cmd, args) => { seen = { cmd, args }; };
  notify('usage-limit-guard', '5h at 90%', { platform: 'win32', run });
  assert.equal(seen.cmd, 'powershell');
  const joined = seen.args.join(' ');
  assert.match(joined, /usage-limit-guard/);
  assert.match(joined, /5h at 90%/);
});

test('notify: windows toast uses the registered PowerShell AUMID, not an unregistered name', () => {
  let seen;
  notify('t', 'm', { platform: 'win32', run: (cmd, args) => { seen = args.join(' '); } });
  assert.match(seen, /CreateToastNotifier\('\{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7\}\\WindowsPowerShell\\v1\.0\\powershell\.exe'\)/);
  assert.doesNotMatch(seen, /CreateToastNotifier\('usage-limit-guard'\)/);
});

test('notify: runner failure never throws', () => {
  assert.doesNotThrow(() => notify('t', 'm', { platform: 'linux', run: () => { throw new Error('x'); } }));
});

test('notify: escapes double quotes for osascript', () => {
  let seen;
  const run = (cmd, args) => { seen = { cmd, args }; };
  notify('title', 'say "hi"', { platform: 'darwin', run });
  assert.match(seen.args.join(' '), /say \\"hi\\"/);
});

test('notify: escapes single quotes for powershell', () => {
  let seen;
  const run = (cmd, args) => { seen = { cmd, args }; };
  notify("it's", 'fine', { platform: 'win32', run });
  assert.match(seen.args.join(' '), /it''s/);
});
