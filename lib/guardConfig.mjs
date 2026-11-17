import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { PLUGIN_KEY, globalSettingsPath, resolveGlobalKey } from './pluginSettings.mjs';

export { PLUGIN_KEY };

// Value for --value-stdin: read all of stdin, drop one trailing newline. Lets a command pass free text
// through a quoted heredoc, so quotes, backticks and $(...) in it are never interpreted by a shell.
export function readValueFromStdin(readFile = readFileSync) {
  return readFile(0, 'utf8').replace(/\r?\n$/, '');
}

// Read JSON: a missing file yields {}, but invalid JSON throws (never overwrite).
// A UTF-8 BOM is stripped first so a BOM'd settings.json does not look invalid.
function readJson(path, readFile) {
  let raw;
  try {
    raw = readFile(path, 'utf8');
  } catch {
    return {};
  }
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(`Invalid JSON in ${path}; refusing to overwrite.`);
  }
}

// Writes via a temp file + rename so a crash or a concurrent reader never sees a truncated file;
// falls back to a direct write when the rename is refused (e.g. a locked file on Windows).
// `backup` (global settings.json only) first saves the previous bytes next to it, like /limit-guard-setup.
function writeJson(path, obj, { readFile, writeFile, mkdir, rename }, backup = false) {
  mkdir(dirname(path), { recursive: true });
  if (backup) {
    try {
      writeFile(path + '.bak-limitguard', readFile(path, 'utf8'), 'utf8');
    } catch { /* no previous file, or best-effort */ }
  }
  const data = JSON.stringify(obj, null, 2) + '\n';
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    writeFile(tmp, data, 'utf8');
    rename(tmp, path);
  } catch {
    writeFile(path, data, 'utf8');
  }
}

function projectPath(cwd) {
  return join(cwd, '.claude', 'limit-guard.json');
}

// Injectable fs functions (tests pass in-memory fakes), plus env for the global settings path.
function fsDeps(deps) {
  const { readFile = readFileSync, writeFile = writeFileSync, mkdir = mkdirSync, rename = renameSync, env = process.env } = deps;
  return { readFile, writeFile, mkdir, rename, env };
}

export function setProjectGuard(cwd, text, deps = {}) {
  const d = fsDeps(deps);
  const path = projectPath(cwd);
  const obj = readJson(path, d.readFile);
  obj.guardAction = text;
  writeJson(path, obj, d);
  return path;
}

export function clearProjectGuard(cwd, deps = {}) {
  const d = fsDeps(deps);
  const path = projectPath(cwd);
  const obj = readJson(path, d.readFile);
  delete obj.guardAction;
  writeJson(path, obj, d);
  return path;
}

// Generic per-project setter: writes obj[key] = value into .claude/limit-guard.json,
// preserving every other key. `key` is the camelCase project key; `value` may be any
// JSON-serializable value (number, string, array). Used by the /limit-guard-config command.
export function setProjectOption(cwd, key, value, deps = {}) {
  const d = fsDeps(deps);
  const path = projectPath(cwd);
  const obj = readJson(path, d.readFile);
  obj[key] = value;
  writeJson(path, obj, d);
  return path;
}

export function clearProjectOption(cwd, key, deps = {}) {
  const d = fsDeps(deps);
  const path = projectPath(cwd);
  const obj = readJson(path, d.readFile);
  delete obj[key];
  writeJson(path, obj, d);
  return path;
}

// Generic global setter: writes pluginConfigs[<key>].options[<optionKey>] = value in the
// global settings.json (where Claude Code's /config stores options), preserving siblings.
export function setGlobalOption(optionKey, value, deps = {}) {
  const d = fsDeps(deps);
  const path = globalSettingsPath(d.env);
  const obj = readJson(path, d.readFile);
  obj.pluginConfigs = obj.pluginConfigs || {};
  const key = resolveGlobalKey(obj, d.env);
  const entry = obj.pluginConfigs[key] = obj.pluginConfigs[key] || {};
  entry.options = entry.options || {};
  entry.options[optionKey] = value;
  writeJson(path, obj, d, true);
  return path;
}

export function clearGlobalOption(optionKey, deps = {}) {
  const d = fsDeps(deps);
  const path = globalSettingsPath(d.env);
  const obj = readJson(path, d.readFile);
  const key = resolveGlobalKey(obj, d.env);
  const entry = obj.pluginConfigs && obj.pluginConfigs[key];
  if (entry && entry.options) {
    delete entry.options[optionKey];
    if (Object.keys(entry.options).length === 0) delete entry.options;
  }
  writeJson(path, obj, d, true);
  return path;
}

// Warn-action setters — thin delegations to the generic option setters.
// Project key is camelCase (warnAction); global key is snake_case (warn_action).
// No legacy-flat-key migration needed: a flat warn_action never existed.
export const setProjectWarn = (cwd, text, deps) => setProjectOption(cwd, 'warnAction', text, deps);
export const clearProjectWarn = (cwd, deps) => clearProjectOption(cwd, 'warnAction', deps);
export const setGlobalWarn = (text, deps) => setGlobalOption('warn_action', text, deps);
export const clearGlobalWarn = (deps) => clearGlobalOption('warn_action', deps);

export function setGlobalGuard(text, deps = {}) {
  const d = fsDeps(deps);
  const path = globalSettingsPath(d.env);
  const obj = readJson(path, d.readFile);
  obj.pluginConfigs = obj.pluginConfigs || {};
  const key = resolveGlobalKey(obj, d.env);
  const entry = obj.pluginConfigs[key] = obj.pluginConfigs[key] || {};
  entry.options = entry.options || {};
  entry.options.guard_action = text;
  delete entry.guard_action; // drop any legacy flat copy
  writeJson(path, obj, d, true);
  return path;
}

export function clearGlobalGuard(deps = {}) {
  const d = fsDeps(deps);
  const path = globalSettingsPath(d.env);
  const obj = readJson(path, d.readFile);
  const key = resolveGlobalKey(obj, d.env);
  const entry = obj.pluginConfigs && obj.pluginConfigs[key];
  if (entry) {
    if (entry.options) {
      delete entry.options.guard_action;
      if (Object.keys(entry.options).length === 0) delete entry.options;
    }
    delete entry.guard_action; // legacy flat copy
  }
  writeJson(path, obj, d, true);
  return path;
}
