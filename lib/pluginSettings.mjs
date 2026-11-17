import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { makeDebug } from './debug.mjs';

// Default settings key Claude Code uses for this plugin (plugin@marketplace),
// assuming the marketplace is registered under the same name as the plugin.
export const PLUGIN_KEY = 'usage-limit-guard@usage-limit-guard';

// Settings key prefix of the plugin before the 0.14 rename; options are still read from it as a fallback.
const LEGACY_KEY_PREFIX = 'claude-limit-guard@';

// Path to the user's global settings.json (honors CLAUDE_CONFIG_DIR).
export function globalSettingsPath(env) {
  const base = env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  return join(base, 'settings.json');
}

// Pick the pluginConfigs key to WRITE. Prefer an explicit env override, then any existing
// `usage-limit-guard@*` key already in settings, else the default.
export function resolveGlobalKey(settings, env) {
  if (env.CLAUDE_LIMIT_GUARD_PLUGIN_KEY) return env.CLAUDE_LIMIT_GUARD_PLUGIN_KEY;
  const existing = Object.keys(settings.pluginConfigs || {}).find((k) =>
    k.startsWith('usage-limit-guard@'),
  );
  return existing || PLUGIN_KEY;
}

// Pick the pluginConfigs key to READ: as resolveGlobalKey, but when no new-name key exists yet,
// fall back to a legacy `claude-limit-guard@*` key so options survive the 0.14 rename.
export function resolveReadKey(settings, env) {
  const key = resolveGlobalKey(settings, env);
  const configs = settings.pluginConfigs || {};
  if (env.CLAUDE_LIMIT_GUARD_PLUGIN_KEY || key in configs) return key;
  return Object.keys(configs).find((k) => k.startsWith(LEGACY_KEY_PREFIX)) || key;
}

// Read this plugin's options from the global settings.json as a flat record of
// snake_case option names. A missing file or malformed JSON yields {} (never throws),
// so non-hook callers like the status line stay silent on failure. Values under the
// `.options` object (where Claude Code's /config stores them) take precedence over any
// legacy flat keys written by older versions.
export function readGlobalOptions(env = process.env, readFile = readFileSync, debug = makeDebug(env)) {
  let raw;
  try {
    raw = readFile(globalSettingsPath(env), 'utf8');
  } catch {
    return {}; // no global settings file is the normal case
  }
  let settings;
  try {
    settings = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    debug('ignoring malformed settings.json when reading plugin options');
    return {};
  }
  const key = resolveReadKey(settings, env);
  const entry = (settings.pluginConfigs && settings.pluginConfigs[key]) || {};
  const { options, ...flat } = entry;
  return { ...flat, ...(options && typeof options === 'object' ? options : {}) };
}
