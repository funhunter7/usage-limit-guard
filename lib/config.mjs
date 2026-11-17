import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeDebug } from './debug.mjs';
import { readGlobalOptions } from './pluginSettings.mjs';
import { BACKGROUNDS, BAR_STYLES } from './format.mjs';

export const DEFAULT_CONFIG = {
  threshold: 95,
  warnBand: 80,
  thresholdFiveHour: null,
  thresholdSevenDay: null,
  watch: 'auto',
  handoff: '.claude/RESUME.md',
  locale: 'system',
  guardAction: null,
  warnAction: null,
  allowProjectActions: false,
  projectActionsIgnored: [], // keys of .claude/limit-guard.json dropped because allow_project_actions is off
  timeFormat: 'system',
  style: 'auto',
  labelStyle: 'full',
  resetDisplay: 'clock',
  projectionDisplay: 'off',
  notifications: 'off',
  layout: 'compact',
  showModel: true,
  showContext: true,
  paceArrow: true,
  windowDisplay: 'all',
  showPaths: true,
  scratchDir: '',
  barStyle: 'pill',
  background: 'warn',
};

const VALID_TIME_FORMATS = new Set(['system', '12', '24']);
const VALID_STYLES = new Set(['auto', 'emoji', 'ascii', 'basic']);
const VALID_LABEL_STYLES = new Set(['full', 'short']);
const VALID_RESET_DISPLAYS = new Set(['clock', 'relative', 'both']);
const VALID_PROJECTION_DISPLAYS = new Set(['off', 'on']);
const VALID_NOTIFICATIONS = new Set(['off', 'on']);
const VALID_LAYOUTS = new Set(['compact', 'classic']);
const VALID_BAR_STYLES = new Set(BAR_STYLES);
const VALID_BACKGROUNDS = new Set(BACKGROUNDS);
const VALID_WINDOW_DISPLAYS = new Set(['all', 'nearest']);
const BOOL_KEYS = [['show_model', 'showModel'], ['show_context', 'showContext'], ['pace_arrow', 'paceArrow'], ['show_paths', 'showPaths'], ['allow_project_actions', 'allowProjectActions']];

// Longest action/handoff text accepted from any source: it is injected into the model context.
export const MAX_ACTION_CHARS = 500;
const PROJECT_FILE = '.claude/limit-guard.json';

// Free text that steers the model (guard/warn action, handoff path): a string capped at MAX_ACTION_CHARS.
const capText = (v) => (typeof v === 'string' && v.trim() !== '' ? v.slice(0, MAX_ACTION_CHARS) : null);

// Coerce a boolean option from a native boolean or a 'true'/'false'/'on'/'off' string
// (env vars and /config arrive as strings); anything else is unset.
function asBool(v) {
  if (typeof v === 'boolean') return v;
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (s === 'true' || s === 'on') return true;
  if (s === 'false' || s === 'off') return false;
  return undefined;
}

// Read a plugin userConfig value exported by Claude Code as CLAUDE_PLUGIN_OPTION_<KEY>.
// Tolerates upper/lower/original casing of the key. Blank values are treated as unset.
function readOption(env, key) {
  for (const variant of [key, key.toUpperCase(), key.toLowerCase()]) {
    const v = env[`CLAUDE_PLUGIN_OPTION_${variant}`];
    if (v != null && v !== '') return v;
  }
  return undefined;
}

// Map a flat record of snake_case option names (values may be string OR native JSON
// types) to camelCase config overrides, applying the same validation/coercion for every
// source (env vars and settings.json alike). Blank/NaN values are treated as unset.
function optionsToConfig(opts) {
  const out = {};
  // Coerce to a finite number, treating null/array/blank (incl. whitespace) as unset,
  // so a hand-edited settings.json like `"threshold": ""` or `[]` doesn't become 0.
  const asNumber = (v) => {
    if (v == null || Array.isArray(v)) return undefined;
    const s = typeof v === 'string' ? v.trim() : v;
    if (s === '') return undefined;
    const n = Number(s);
    return Number.isNaN(n) ? undefined : n;
  };
  const threshold = asNumber(opts.threshold);
  if (threshold !== undefined) out.threshold = threshold;
  const warnBand = asNumber(opts.warn_band);
  if (warnBand !== undefined) out.warnBand = warnBand;
  const thresholdFiveHour = asNumber(opts.threshold_five_hour);
  if (thresholdFiveHour !== undefined) out.thresholdFiveHour = thresholdFiveHour;
  const thresholdSevenDay = asNumber(opts.threshold_seven_day);
  if (thresholdSevenDay !== undefined) out.thresholdSevenDay = thresholdSevenDay;
  if (opts.watch != null) {
    const rawStr = Array.isArray(opts.watch) ? opts.watch.join(',') : String(opts.watch);
    if (rawStr.trim().toLowerCase() === 'auto') {
      out.watch = 'auto';
    } else {
      const list = (Array.isArray(opts.watch) ? opts.watch : rawStr.split(','))
        .map((s) => String(s).trim())
        .filter(Boolean);
      if (list.length) out.watch = list;
    }
  }
  if (opts.locale != null && opts.locale !== '') out.locale = String(opts.locale);
  if (opts.guard_action != null && opts.guard_action !== '') out.guardAction = capText(String(opts.guard_action));
  if (opts.warn_action != null && opts.warn_action !== '') out.warnAction = capText(String(opts.warn_action));
  if (opts.time_format != null && opts.time_format !== '') out.timeFormat = String(opts.time_format);
  if (opts.style != null && opts.style !== '') out.style = String(opts.style);
  if (opts.label_style != null && opts.label_style !== '') out.labelStyle = String(opts.label_style);
  if (opts.reset_display != null && opts.reset_display !== '') out.resetDisplay = String(opts.reset_display);
  if (opts.projection_display != null && opts.projection_display !== '') out.projectionDisplay = String(opts.projection_display);
  if (opts.notifications != null && opts.notifications !== '') out.notifications = String(opts.notifications);
  if (opts.layout != null && opts.layout !== '') out.layout = String(opts.layout);
  if (opts.bar_style != null && opts.bar_style !== '') out.barStyle = String(opts.bar_style);
  if (opts.background != null && opts.background !== '') out.background = String(opts.background);
  if (opts.window_display != null && opts.window_display !== '') out.windowDisplay = String(opts.window_display);
  if (typeof opts.scratch_dir === 'string' && opts.scratch_dir.trim() !== '') out.scratchDir = opts.scratch_dir.trim();
  for (const [snake, camel] of BOOL_KEYS) {
    const b = asBool(opts[snake]);
    if (b !== undefined) out[camel] = b;
  }
  return out;
}

// Options the user set in Claude Code's /config, passed to this subprocess as
// CLAUDE_PLUGIN_OPTION_<KEY> env vars (hooks and commands only).
function envOverrides(env) {
  const opts = {};
  for (const key of ['threshold', 'warn_band', 'threshold_five_hour', 'threshold_seven_day', 'watch', 'locale', 'guard_action', 'warn_action', 'time_format', 'style', 'label_style', 'reset_display', 'projection_display', 'notifications', 'layout', 'bar_style', 'background', 'window_display', 'scratch_dir', ...BOOL_KEYS.map(([k]) => k)]) {
    const v = readOption(env, key);
    if (v !== undefined) opts[key] = v;
  }
  return optionsToConfig(opts);
}

export function loadConfig(cwd, readFile = readFileSync, env = process.env, debug = makeDebug(env)) {
  // The injected readFile is used for both the per-project file and (via
  // readGlobalOptions) the global settings.json.
  let fileCfg = {};
  let raw;
  try {
    raw = readFile(join(cwd, '.claude', 'limit-guard.json'), 'utf8');
  } catch {
    raw = undefined; // a missing per-project file is the normal case — stay silent
  }
  if (raw !== undefined) {
    try {
      fileCfg = JSON.parse(raw);
      if (fileCfg === null || typeof fileCfg !== 'object' || Array.isArray(fileCfg)) fileCfg = {};
    } catch {
      debug('ignoring malformed .claude/limit-guard.json');
      fileCfg = {};
    }
  }
  // Precedence (most specific wins): per-project file > Claude Code env option >
  // global settings.json options > default. Env is populated for hooks/commands; the
  // status line (a plain user setting) relies on the global settings.json layer.
  const globalCfg = optionsToConfig(readGlobalOptions(env, readFile, debug));
  // Project-file text that steers the model (guardAction/warnAction/handoff) is untrusted: a cloned
  // repo could ship it. Ignore it unless the USER-level option allow_project_actions is on (the project
  // file can never switch it on for itself); when allowed, label it so the model sees where it came from.
  const userCfg = { ...DEFAULT_CONFIG, ...globalCfg, ...envOverrides(env) };
  const allowProject = userCfg.allowProjectActions === true;
  const projectActionsIgnored = [];
  delete fileCfg.allowProjectActions;
  for (const key of ['guardAction', 'warnAction', 'handoff']) {
    if (!(key in fileCfg)) continue;
    const text = capText(fileCfg[key]);
    if (!allowProject) { delete fileCfg[key]; if (text) projectActionsIgnored.push(key); debug('ignoring ' + key + ' from ' + PROJECT_FILE + ' (allow_project_actions is off)'); continue; }
    if (!text) { delete fileCfg[key]; continue; }
    fileCfg[key] = key === 'handoff' ? text : '(from project file ' + PROJECT_FILE + ') ' + text;
  }
  const merged = { ...userCfg, ...fileCfg };
  if (projectActionsIgnored.length) merged.projectActionsIgnored = projectActionsIgnored;
  // Per-window thresholds: must be a number in [0, 100]; anything else falls back to null.
  for (const key of ['thresholdFiveHour', 'thresholdSevenDay']) {
    const v = merged[key];
    if (v !== null && (typeof v !== 'number' || v < 0 || v > 100)) merged[key] = null;
  }
  // Global threshold/warnBand: a hand-edited project file bypasses the option validation,
  // and an out-of-range value would silently disable the guard (e.g. 200) or keep it
  // permanently on (e.g. -5) — anything not a number in [0, 100] falls back to the default.
  for (const key of ['threshold', 'warnBand']) {
    const v = merged[key];
    if (typeof v !== 'number' || Number.isNaN(v) || v < 0 || v > 100) merged[key] = DEFAULT_CONFIG[key];
  }
  merged.timeFormat = VALID_TIME_FORMATS.has(String(merged.timeFormat))
    ? String(merged.timeFormat)
    : 'system';
  merged.style = VALID_STYLES.has(String(merged.style)) ? String(merged.style) : 'auto';
  merged.labelStyle = VALID_LABEL_STYLES.has(String(merged.labelStyle)) ? String(merged.labelStyle) : 'full';
  merged.resetDisplay = VALID_RESET_DISPLAYS.has(String(merged.resetDisplay)) ? String(merged.resetDisplay) : 'clock';
  merged.projectionDisplay = VALID_PROJECTION_DISPLAYS.has(String(merged.projectionDisplay)) ? String(merged.projectionDisplay) : 'off';
  merged.notifications = VALID_NOTIFICATIONS.has(String(merged.notifications)) ? String(merged.notifications) : 'off';
  merged.layout = VALID_LAYOUTS.has(String(merged.layout)) ? String(merged.layout) : 'compact';
  merged.barStyle = VALID_BAR_STYLES.has(String(merged.barStyle)) ? String(merged.barStyle) : 'pill';
  merged.background = VALID_BACKGROUNDS.has(String(merged.background)) ? String(merged.background) : 'warn';
  merged.windowDisplay = VALID_WINDOW_DISPLAYS.has(String(merged.windowDisplay)) ? String(merged.windowDisplay) : 'all';
  merged.scratchDir = typeof merged.scratchDir === 'string' ? merged.scratchDir.trim() : '';
  for (const [, camel] of BOOL_KEYS) merged[camel] = asBool(merged[camel]) ?? DEFAULT_CONFIG[camel];
  // watch: the sentinel 'auto' (model-aware) or a non-empty list of known window keys.
  // A hand-edited project file can carry a csv string or unknown keys; coerce/validate
  // here so an invalid value falls back to the default rather than mis-watching.
  const VALID_WINDOWS = new Set(['five_hour', 'seven_day', 'seven_day_opus', 'seven_day_sonnet']);
  if (typeof merged.watch === 'string' && merged.watch.trim().toLowerCase() === 'auto') {
    merged.watch = 'auto';
  } else {
    const rawList = Array.isArray(merged.watch)
      ? merged.watch
      : typeof merged.watch === 'string' ? merged.watch.split(',') : [];
    const list = rawList.map((s) => String(s).trim()).filter((k) => VALID_WINDOWS.has(k));
    merged.watch = list.length ? list : DEFAULT_CONFIG.watch;
  }
  return merged;
}
