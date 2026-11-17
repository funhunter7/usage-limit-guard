import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, normalize } from 'node:path';

// Plugin identifier (`<plugin>@<marketplace>`) Claude Code derives its data folder from.
const PLUGIN_ID = 'usage-limit-guard@usage-limit-guard';

// Folder for the plugin's short-lived state (usage cache, burn-rate history, notify/stop/snooze
// markers, scratch cache). Hooks get CLAUDE_PLUGIN_DATA from Claude Code; the status line and the
// slash-command scripts do not, so they compute the same folder the way Claude Code does
// (https://code.claude.com/docs/en/plugins-reference#environment-variables):
// `<config dir>/plugins/data/<id>` with every character other than letters, digits, `_` and `-`
// in <id> replaced by `-`. Every caller must go through this helper so all of them agree.
// shortcut: assumes the marketplace is registered under the plugin's own name; when a hook's
// CLAUDE_PLUGIN_DATA names a different folder (renamed marketplace, --plugin-dir), the status
// line keeps using the computed one and the two no longer share a cache. Upgrade: none needed
// unless that setup matters.
export function stateDir(env = process.env, home = homedir()) {
  if (env.CLAUDE_PLUGIN_DATA) return normalize(env.CLAUDE_PLUGIN_DATA);
  const base = env.CLAUDE_CONFIG_DIR || join(home, '.claude');
  return join(base, 'plugins', 'data', PLUGIN_ID.replace(/[^A-Za-z0-9_-]/g, '-'));
}

export const statePath = (name, env = process.env, home = homedir()) => join(stateDir(env, home), name);

// Default state writer: creates the data folder on first use (Claude Code only creates it when
// a hook references it, and the status line may run first).
export function writeStateFile(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data, 'utf8');
}
