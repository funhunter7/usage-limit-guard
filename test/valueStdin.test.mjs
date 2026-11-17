import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = (name) => fileURLToPath(new URL(`../scripts/${name}`, import.meta.url));
const NASTY = 'say "hi" `whoami` $(id) \'q\' $HOME';

// Runs a bin in a scratch project dir with a scratch config dir (never the real ~/.claude).
function run(bin, args, input, cwd) {
  return spawnSync(process.execPath, [BIN(bin), ...args], {
    cwd, input, encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: join(cwd, 'cfg') },
  });
}

test('guard.mjs --value-stdin stores free text verbatim (no shell quoting needed)', () => {
  const d = mkdtempSync(join(tmpdir(), 'clg-vs-'));
  try {
    const r = run('guard.mjs', ['--scope', 'project', '--action', 'set', '--value-stdin'], NASTY + '\n', d);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(readFileSync(join(d, '.claude', 'limit-guard.json'), 'utf8')).guardAction, NASTY);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('guard.mjs --value-stdin with empty input is rejected', () => {
  const d = mkdtempSync(join(tmpdir(), 'clg-vs-'));
  try {
    const r = run('guard.mjs', ['--scope', 'project', '--action', 'set', '--value-stdin'], '\n', d);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--value/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('config.mjs --value-stdin sets a validated option from stdin', () => {
  const d = mkdtempSync(join(tmpdir(), 'clg-vs-'));
  try {
    const r = run('config.mjs', ['--scope', 'project', '--option', 'threshold', '--value-stdin'], '88\n', d);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(readFileSync(join(d, '.claude', 'limit-guard.json'), 'utf8')).threshold, 88);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
