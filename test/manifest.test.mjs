import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

const VALID_EVENTS = new Set([
  'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop', 'SubagentStop',
  'Notification', 'PreCompact', 'SessionStart', 'SessionEnd',
]);

test('hooks.json: top-level "hooks" is a record (Claude Code plugin schema)', () => {
  const manifest = readJson('hooks/hooks.json');
  assert.equal(typeof manifest.hooks, 'object');
  assert.ok(manifest.hooks !== null && !Array.isArray(manifest.hooks),
    'hooks must be an object keyed by event name, not an array or null');
});

test('hooks.json: every event is known and maps to an array of matcher groups', () => {
  const { hooks } = readJson('hooks/hooks.json');
  for (const [event, groups] of Object.entries(hooks)) {
    assert.ok(VALID_EVENTS.has(event), `unknown hook event: ${event}`);
    assert.ok(Array.isArray(groups), `${event} must be an array`);
    for (const group of groups) {
      assert.ok(Array.isArray(group.hooks), `${event} group needs a hooks array`);
      for (const h of group.hooks) {
        assert.equal(h.type, 'command');
        assert.match(h.command, /CLAUDE_PLUGIN_ROOT/, 'command should use ${CLAUDE_PLUGIN_ROOT}');
      }
    }
  }
});

test('plugin.json: does not re-reference the auto-loaded hooks/hooks.json', () => {
  // Claude Code auto-loads the conventional hooks/hooks.json; referencing it again
  // in manifest.hooks makes the loader report a "Duplicate hooks file" error.
  const plugin = readJson('.claude-plugin/plugin.json');
  const ref = typeof plugin.hooks === 'string' ? [plugin.hooks] : (plugin.hooks ?? []);
  for (const p of ref) {
    assert.notMatch(p, /(^\.\/)?hooks\/hooks\.json$/,
      'remove ./hooks/hooks.json from manifest.hooks — it loads automatically');
  }
});

test('plugin.json and package.json versions agree', () => {
  assert.equal(readJson('.claude-plugin/plugin.json').version, readJson('package.json').version);
});

test('plugin.json: userConfig omits the OS/terminal-driven options (locale, time_format, style)', () => {
  // These auto-detect from the OS/terminal, so the always-on /config dialog must not prompt
  // for them; time_format/style remain overridable on demand via /limit-guard-config.
  const { userConfig } = readJson('.claude-plugin/plugin.json');
  for (const k of ['locale', 'time_format', 'style']) {
    assert.equal(userConfig[k], undefined, `userConfig should not expose ${k}`);
  }
});

test('skills/limit-guard-config/SKILL.md: drives scripts/config.mjs via CLAUDE_PLUGIN_ROOT, user language', () => {
  const md = readFileSync(join(root, 'skills/limit-guard-config/SKILL.md'), 'utf8');
  assert.match(md, /allowed-tools:.*AskUserQuestion/, 'must allow AskUserQuestion');
  assert.match(md, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/config\.mjs/, 'must invoke scripts/config.mjs');
  assert.match(md, /Reply in the user's language/, "must reply in the user's language");
});

test('skills/limit-guard-status/SKILL.md: drives scripts/status.mjs via CLAUDE_PLUGIN_ROOT, user language', () => {
  const md = readFileSync(join(root, 'skills/limit-guard-status/SKILL.md'), 'utf8');
  assert.match(md, /allowed-tools:.*Bash/, 'must allow Bash');
  assert.match(md, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/status\.mjs/, 'must invoke scripts/status.mjs');
  assert.match(md, /Reply in the user's language/, "must reply in the user's language");
});

test('skills/limit-guard-stats/SKILL.md: drives scripts/stats.mjs via CLAUDE_PLUGIN_ROOT, user language', () => {
  const md = readFileSync(join(root, 'skills/limit-guard-stats/SKILL.md'), 'utf8');
  assert.match(md, /allowed-tools:.*Bash/, 'must allow Bash');
  assert.match(md, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/stats\.mjs/, 'must invoke scripts/stats.mjs');
  assert.match(md, /Reply in the user's language/, "must reply in the user's language");
});

test('skills/limit-guard-snooze/SKILL.md: drives scripts/snooze.mjs via CLAUDE_PLUGIN_ROOT, user language', () => {
  const md = readFileSync(join(root, 'skills/limit-guard-snooze/SKILL.md'), 'utf8');
  assert.match(md, /allowed-tools:.*Bash/, 'must allow Bash');
  assert.match(md, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/snooze\.mjs/, 'must invoke scripts/snooze.mjs');
  assert.match(md, /Reply in the user's language/, "must reply in the user's language");
});

test('skills/limit-guard-doctor/SKILL.md: drives scripts/doctor.mjs via CLAUDE_PLUGIN_ROOT, user language', () => {
  const md = readFileSync(join(root, 'skills/limit-guard-doctor/SKILL.md'), 'utf8');
  assert.match(md, /allowed-tools:.*Bash/, 'must allow Bash');
  assert.match(md, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/doctor\.mjs/, 'must invoke scripts/doctor.mjs');
  assert.match(md, /Reply in the user's language/, "must reply in the user's language");
});

test('skills/limit-guard-setup/SKILL.md: drives scripts/setup.mjs via CLAUDE_PLUGIN_ROOT, user language', () => {
  const md = readFileSync(join(root, 'skills/limit-guard-setup/SKILL.md'), 'utf8');
  assert.match(md, /allowed-tools:.*Bash/, 'must allow Bash');
  assert.match(md, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/setup\.mjs/, 'must invoke scripts/setup.mjs');
  assert.match(md, /Reply in the user's language/, "must reply in the user's language");
});

test('skills/limit-guard-legend/SKILL.md: drives scripts/legend.mjs via CLAUDE_PLUGIN_ROOT, user language', () => {
  const md = readFileSync(join(root, 'skills/limit-guard-legend/SKILL.md'), 'utf8');
  assert.match(md, /allowed-tools:.*Bash/, 'must allow Bash');
  assert.match(md, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/legend\.mjs/, 'must invoke scripts/legend.mjs');
  assert.match(md, /Reply in the user's language/, "must reply in the user's language");
});

test('skills/limit-guard-setup/SKILL.md: offers FORCE_HYPERLINK via AskUserQuestion and --force-hyperlink', () => {
  const md = readFileSync(join(root, 'skills/limit-guard-setup/SKILL.md'), 'utf8');
  assert.match(md, /allowed-tools:.*AskUserQuestion/, 'must allow AskUserQuestion');
  assert.match(md, /WT_SESSION/);
  assert.match(md, /scripts\/setup\.mjs" "\$\{CLAUDE_PLUGIN_ROOT\}" --force-hyperlink/);
});

test('hooks/hooks.json: keeps the command hooks and names the band mod; plugin.json has no engines range', () => {
  const hooks = JSON.parse(readFileSync(join(root, 'hooks/hooks.json'), 'utf8'));
  assert.deepEqual(hooks.modules, ['./band.tsx']);
  assert.ok(hooks.hooks.UserPromptSubmit && hooks.hooks.Stop && hooks.hooks.SessionStart);
  assert.ok(readFileSync(join(root, 'hooks/band.tsx'), 'utf8').includes('export const register'));
  assert.equal(JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8')).engines, undefined);
});

const SKILLS = readdirSync(join(root, 'skills'));

test('skills: replace the legacy commands/ folder and keep every command name', () => {
  assert.deepEqual(SKILLS.sort(), ['action', 'config', 'doctor', 'legend', 'setup', 'snooze', 'stats', 'status'].map((n) => 'limit-guard-' + n));
  for (const s of SKILLS) assert.match(readFileSync(join(root, 'skills', s, 'SKILL.md'), 'utf8'), /^---\r?\n[\s\S]*?description: /);
  assert.equal(existsSync(join(root, 'commands', 'limit-guard-status.md')), false);
});

test('skills: none forces a language on the user (public plugin)', () => {
  for (const f of SKILLS) {
    const md = readFileSync(join(root, 'skills', f, 'SKILL.md'), 'utf8');
    assert.doesNotMatch(md, /exclusively in Czech|in plain Czech/, `${f} must not force Czech`);
  }
});

test('skills: free text goes through stdin, never onto the shell command line', () => {
  for (const f of ['limit-guard-action', 'limit-guard-config']) {
    const md = readFileSync(join(root, 'skills', f, 'SKILL.md'), 'utf8');
    assert.match(md, /--value-stdin/, `${f} must use --value-stdin`);
    assert.doesNotMatch(md, /--value "</, `${f} must not put free text in --value "..."`);
  }
});

test('plugin.json: icon exists, enum options use pickers, thresholds are bounded, allow_project_actions is off by default', () => {
  const p = readJson('.claude-plugin/plugin.json');
  assert.ok(existsSync(join(root, p.icon)), 'icon file must exist');
  const u = p.userConfig;
  for (const k of ['layout', 'background', 'bar_style', 'label_style', 'reset_display', 'projection_display', 'window_display', 'notifications']) {
    assert.ok(Array.isArray(u[k].options) && u[k].options.includes(u[k].default), k + ": options must include the default");
  }
  for (const k of ['threshold', 'warn_band', 'threshold_five_hour', 'threshold_seven_day']) assert.deepEqual([u[k].min, u[k].max], [1, 100]);
  assert.deepEqual([u.allow_project_actions.type, u.allow_project_actions.default], ['boolean', false]);
});

test('hooks.json: scripts live in scripts/, not the top-level bin/ (claude.ai would refuse a plugin with bin/)', () => {
  assert.equal(existsSync(join(root, 'bin')), false);
  for (const groups of Object.values(readJson('hooks/hooks.json').hooks)) {
    for (const g of groups) for (const h of g.hooks) assert.match(h.command, /\/scripts\/usage\.mjs/);
  }
});
