import { existsSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { globalSettingsPath } from './pluginSettings.mjs';
import { writeJson } from './guardConfig.mjs';

// CLAUDE_PLUGIN_ROOT is the versioned cache dir (plugins/cache/<marketplace>/<plugin>/<version>).
// Claude Code deletes an old version dir 14 days after an update
// (https://code.claude.com/docs/en/plugins/loading.md), which would silently drop the status line.
// The marketplace clone (plugins/marketplaces/<marketplace>) survives updates, so wire that when it
// holds this plugin; otherwise keep the given root. Trade-off: it tracks the auto-updated marketplace
// HEAD, which can be ahead of the installed hook version.
export function stablePluginRoot(pluginRoot, exists = existsSync) {
  const m = /^(.*[\\/]plugins)[\\/]cache[\\/]([^\\/]+)[\\/][^\\/]+[\\/][^\\/]+[\\/]?$/.exec(pluginRoot);
  if (!m) return pluginRoot;
  const clone = normalize(`${m[1]}/marketplaces/${m[2]}`);
  return exists(join(clone, 'scripts', 'usage.mjs')) ? clone : pluginRoot;
}

// The usage script path inside a statusLine command (quoted or bare), or null.
export function statusLineScript(command) {
  if (typeof command !== 'string') return null;
  return /"([^"]*usage\.mjs)"/.exec(command)?.[1] ?? /(\S*usage\.mjs)/.exec(command)?.[1] ?? null;
}

// The current layout puts the script in scripts/; the pre-0.15 layout used bin/.
export const isCurrentScriptPath = (p) => /[\\/]scripts[\\/]usage\.mjs$/.test(p);

// SessionStart auto-repair: when settings.json statusLine.command clearly runs THIS plugin's usage
// script (a path under a *limit-guard* folder ending in bin|scripts/usage.mjs) but that file is gone
// (versioned cache dir deleted) or still the legacy bin/ layout, point it at the current stable path.
// Never touches a statusLine that is not ours; a settings.json that cannot be parsed is left alone.
// Returns the new command, or null when nothing changed. Never throws.
export function repairStatusLine({ pluginRoot, settingsPath = globalSettingsPath(process.env), exists = existsSync, readFile = readFileSync, write = writeJson }) {
  try {
    const settings = JSON.parse(readFile(settingsPath, 'utf8').replace(/^\uFEFF/, ''));
    const cur = settings?.statusLine;
    const old = cur?.type === 'command' ? statusLineScript(cur.command) : null;
    if (!old || !/limit-guard/i.test(old) || !/[\\/](bin|scripts)[\\/]usage\.mjs$/.test(old)) return null;
    if (exists(old) && isCurrentScriptPath(old)) return null;
    const target = join(stablePluginRoot(pluginRoot, exists), 'scripts', 'usage.mjs');
    if (!exists(target) || target === normalize(old)) return null;
    settings.statusLine = { ...cur, command: cur.command.replace(old, () => target) };
    write(settingsPath, settings, undefined, true);
    return settings.statusLine.command;
  } catch {
    return null;
  }
}
