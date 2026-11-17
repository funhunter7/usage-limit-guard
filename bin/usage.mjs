import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig as defaultLoadConfig } from '../lib/config.mjs';
import { getUsage as defaultGetUsage, CACHE_PATH } from '../lib/usage.mjs';
import { writeCache as defaultWriteCache } from '../lib/cache.mjs';
import { appendReading as defaultAppendReading, readHistory as defaultReadHistory, projectMinutesToThreshold, HISTORY_PATH, HISTORY_MIN_INTERVAL_MS } from '../lib/history.mjs';
import { appendUsage as defaultAppendUsage, USAGE_LOG_PATH } from '../lib/usageLog.mjs';
import { coversWatched, fieldsFromPayload, usageFromRateLimits, watchedExpired } from '../lib/stdinUsage.mjs';
import { buildPaths as defaultBuildPaths } from '../lib/statusPaths.mjs';
import { makeDebug } from '../lib/debug.mjs';
import { resolveWatch, watchBase } from '../lib/watch.mjs';
import { formatStatusLine, resolveHour12, resolveStyle, resolveTier, resolveLocale } from '../lib/format.mjs';
import { breachedLimits, warnedLimits } from '../lib/threshold.mjs';
import { getMessages } from '../lib/messages.mjs';
import { shouldBlockStop as defaultShouldBlockStop } from '../lib/stopGuard.mjs';
import { notify as defaultNotify } from '../lib/notify.mjs';
import { shouldNotify as defaultShouldNotify } from '../lib/notifyGuard.mjs';
import { snoozeUntil as defaultSnoozeUntil } from '../lib/snoozeGuard.mjs';

export async function runCli(mode, cwd, deps = {}) {
  const {
    loadConfig = defaultLoadConfig,
    getUsage = defaultGetUsage,
    handoffExists,
    shouldBlockStop = defaultShouldBlockStop,
    now = () => new Date(),
    // Already mapped to the internal usage shape via usageFromRateLimits — NOT the raw
    // rate_limits block. Passing raw rate_limits here would silently miss the fast-path.
    stdinUsage = null,
    // Hook-only: session id (keeps concurrent sessions' stop markers apart) and whether Claude
    // Code is already continuing because of a stop hook (then we must not block again).
    sessionId = '',
    stopHookActive = false,
    writeCache = defaultWriteCache,
    cachePath = CACHE_PATH,
    appendReading = defaultAppendReading,
    readHistory = defaultReadHistory,
    historyPath = HISTORY_PATH,
    notify = defaultNotify,
    shouldNotify = defaultShouldNotify,
    appendUsage = defaultAppendUsage,
    usageLogPath = USAGE_LOG_PATH,
    snoozeUntil = defaultSnoozeUntil,
    // Statusline-only extras: fieldsFromPayload output (model, context %, workspace, ...),
    // plus the env and tmp dir used for terminal-tier detection and scratch lookup.
    payload = null,
    env = process.env,
    tmp = undefined,
    buildPaths = defaultBuildPaths,
    debug = makeDebug(env),
  } = deps;

  const cfg = loadConfig(cwd);
  // 'system'/'auto' (the default) follows the OS locale for both weekday/date rendering
  // and message language — so the user needn't set a language. Works on Windows and Linux.
  const locale = resolveLocale(cfg.locale);
  const m = getMessages(locale);
  // Only --resume-check and --stop care whether a handoff already exists; compute lazily
  // so the per-keystroke --statusline/--context paths skip the filesystem stat.
  const hoExists = () => (handoffExists ? handoffExists() : existsSync(join(cwd, cfg.handoff)));

  if (mode === '--resume-check') {
    if (!hoExists()) return '{}';
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: m.resume(cfg.handoff),
      },
    });
  }

  const nowDate = now();
  const nowMs = nowDate.getTime();

  // Hot path: the --statusline invocation receives native rate_limits on stdin. When the
  // mapped data covers every watched window AND has not passed its reset, use it directly
  // (no network) and write it through to the shared cache so the hooks (--stop/--context)
  // read warm data too. Once a watched window's reset time passes, the stdin/cache value is
  // stale (Claude Code only refreshes rate_limits after an API response), so we fall back to
  // getUsage() — the OAuth poll — to fetch the fresh post-reset value. Any other gap
  // (absent/garbage window, API-key user, pre-first-response) also falls back to getUsage().
  let usage;
  // Pre-usage decisions (hot-path coverage + cache staleness) use the fixed base set:
  // under 'auto' the per-model windows are opportunistic add-ons, not a precondition.
  const base = watchBase(cfg.watch);
  if (mode === '--statusline'
      && coversWatched(stdinUsage, base)
      && !watchedExpired(stdinUsage, base, nowMs)) {
    usage = stdinUsage;
    writeCache(cachePath, stdinUsage); // fire-and-forget; the real writeCache never throws
  } else {
    usage = await getUsage(cachePath, { nowMs, watch: base });
  }
  // With live usage known, resolve the effective windows ('auto' adds any per-model weekly
  // window in use). Every consumer below uses `watch`, not cfg.watch.
  const watch = resolveWatch(usage, cfg.watch);
  // The compact layout is statusline-only; --context/--stop keep the classic line unchanged.
  const compact = mode === '--statusline' && cfg.layout === 'compact';
  // The tier drives only the compact segments; fallback/projection glyphs follow resolveStyle as before.
  const tier = compact ? resolveTier(cfg.style, env, process.platform, cfg.barStyle) : null;
  const glyphs = resolveStyle(cfg.style);
  const hour12 = resolveHour12(cfg.timeFormat);
  // When snoozed (/limit-guard-snooze), suppress the guard/context directives until the
  // snooze expires. The status line and notifications are unaffected.
  const snoozed = snoozeUntil(nowMs) != null;

  // Build per-window threshold overrides from config (only set when non-null).
  const overrides = {};
  if (cfg.thresholdFiveHour != null) overrides.five_hour = cfg.thresholdFiveHour;
  if (cfg.thresholdSevenDay != null) overrides.seven_day = cfg.thresholdSevenDay;

  // Burn-rate history: record one reading per status-line render (fire-and-forget, like the
  // cache write) so the projection has a trend to fit. Only the status line writes history.
  // When notifications are on, snapshot the prior readings BEFORE appending this render's
  // reading, so reset detection compares the current value against history rather than the
  // value we just wrote.
  let prevByKey = null;
  if (mode === '--statusline' && usage && !usage.authError) {
    if (cfg.notifications === 'on') {
      prevByKey = {};
      for (const r of readHistory(historyPath)) {
        for (const key of watch) if (typeof r[key] === 'number') prevByKey[key] = r[key];
      }
    }
    const reading = { ts: nowMs };
    for (const key of watch) {
      const u = usage[key]?.utilization;
      if (typeof u === 'number') reading[key] = u;
    }
    appendReading(historyPath, reading, 30, { minIntervalMs: HISTORY_MIN_INTERVAL_MS }); // never throws; throttled to 1/min
    appendUsage(usageLogPath, reading, nowMs); // long-lived ~7-day stats log; throttled to 1/min
  }

  // Optional projection (opt-in): minutes until the soonest watched window hits its
  // effective threshold, from a least-squares fit of recent readings.
  let projection = null;
  if (cfg.projectionDisplay === 'on') {
    const history = readHistory(historyPath);
    for (const key of watch) {
      const th = overrides[key] ?? cfg.threshold;
      const mins = projectMinutesToThreshold(history, key, th, nowMs);
      if (mins != null && (projection == null || mins < projection.minutes)) projection = { minutes: mins, threshold: th };
    }
  }

  const lineOpts = { now: nowDate, locale, hour12, glyphs, warnBand: cfg.warnBand, labelStyle: cfg.labelStyle, resetDisplay: cfg.resetDisplay, thresholdOverrides: overrides, projectionDisplay: cfg.projectionDisplay, projection };
  let line;
  if (compact) {
    try {
      const f = { ...fieldsFromPayload(null), ...payload };
      f.currentDir = f.currentDir || cwd;
      line = formatStatusLine(usage, cfg.threshold, watch, {
        ...lineOpts, layout: 'compact', tier, model: f.model, contextPct: f.contextPct,
        showModel: cfg.showModel, showContext: cfg.showContext, paceArrow: cfg.paceArrow,
        windowDisplay: cfg.windowDisplay, background: cfg.background, showPaths: cfg.showPaths,
        paths: cfg.showPaths ? buildPaths(f, { scratchDir: cfg.scratchDir, tmp }) : [],
      });
    } catch (e) {
      debug('compact status line failed, falling back to classic:', String(e?.message ?? e));
      line = formatStatusLine(usage, cfg.threshold, watch, lineOpts); // never throw from the status line
    }
  } else {
    line = formatStatusLine(usage, cfg.threshold, watch, lineOpts);
  }

  if (mode === '--statusline') {
    // Fire a desktop notification once per crossing (keyed cwd|window|resets_at|band) when
    // enabled. The status line is the freshest, most frequent caller; gating by shouldNotify
    // keeps it to one toast per crossing rather than one per render. All best-effort.
    if (cfg.notifications === 'on' && usage && !usage.authError) {
      // Reset toast: a watched window dropping sharply versus its prior reading means the
      // window rolled over (e.g. 88% -> 5%). One-shot per (cwd|window|new resets_at).
      for (const key of watch) {
        const cur = usage[key]?.utilization;
        const prev = prevByKey?.[key];
        if (typeof cur === 'number' && typeof prev === 'number' && cur < prev - 15) {
          if (shouldNotify(`${cwd}|${key}|${usage[key]?.resets_at || ''}|reset`)) notify(m.notifyTitle, m.notifyReset(key));
        }
      }
      const breachedNow = breachedLimits(usage, cfg.threshold, watch, overrides);
      const warnedNow = warnedLimits(usage, cfg.warnBand, cfg.threshold, watch, overrides);
      for (const key of breachedNow) {
        if (shouldNotify(`${cwd}|${key}|${usage[key]?.resets_at || ''}|breach`)) notify(m.notifyTitle, m.notifyBreach(key));
      }
      for (const key of warnedNow) {
        if (shouldNotify(`${cwd}|${key}|${usage[key]?.resets_at || ''}|warn`)) notify(m.notifyTitle, m.notifyWarn(key));
      }
    }
    return line;
  }

  const breached = breachedLimits(usage, cfg.threshold, watch, overrides);

  if (mode === '--context') {
    let ctx = m.contextLabel(line, cfg.threshold);
    if (!snoozed) {
      if (breached.length) {
        const action = cfg.guardAction || m.contextAction(cfg.handoff);
        ctx += ' ' + m.breach(breached.join(', '), action);
      } else {
        // Pass the same per-window overrides so the warn band's upper bound matches each
        // window's effective threshold (a looser per-window threshold still warns up to it).
        const warned = warnedLimits(usage, cfg.warnBand, cfg.threshold, watch, overrides);
        if (warned.length) {
          const action = cfg.warnAction || m.warnAction;
          ctx += ' ' + m.warn(warned.join(', '), action);
        }
      }
    }
    return JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx } });
  }

  if (mode === '--stop') {
    if (snoozed || stopHookActive) return '{}';
    // Loop prevention is the per-window shouldBlockStop marker alone — NOT the mere
    // existence of a handoff file. A long-lived/committed handoff (e.g. a dev RESUME.md)
    // must not permanently disable the guard; once the reset window rolls over we block
    // again and the guard action re-saves the handoff with the latest state.
    if (breached.length) {
      // Scope the one-shot marker to this project and session so blocking in one does not
      // suppress the guard in another that breaches in the same reset window.
      const windowKey = `${cwd}|${sessionId}|${usage[breached[0]]?.resets_at || ''}`;
      if (!shouldBlockStop(windowKey)) return '{}';
      const action = cfg.guardAction || m.stopAction(cfg.handoff);
      return JSON.stringify({
        decision: 'block',
        reason: m.stopReason(cfg.threshold, breached.join(', '), action),
      });
    }
    return '{}';
  }

  return '{}';
}

// Parse a Claude Code stdin payload once, extracting the project directory, the native
// rate_limits block and the hook fields. The project root wins over the current directory
// (Claude may have cd'd into a subdir, where .claude/limit-guard.json and the handoff are not):
// status line workspace.project_dir, then the hook env CLAUDE_PROJECT_DIR (`env`, passed by the
// entrypoint only), then workspace.current_dir / cwd. Safe defaults on missing/malformed input.
export function parseStdin(raw, fallback, env = {}) {
  try {
    const j = JSON.parse(raw);
    return {
      cwd: j?.workspace?.project_dir || env.CLAUDE_PROJECT_DIR || j?.workspace?.current_dir || j?.cwd || fallback,
      rateLimits: j?.rate_limits,
      sessionId: typeof j?.session_id === 'string' ? j.session_id : '',
      stopHookActive: j?.stop_hook_active === true,
    };
  } catch {
    return { cwd: env.CLAUDE_PROJECT_DIR || fallback, rateLimits: undefined, sessionId: '', stopHookActive: false };
  }
}

// Back-compat thin wrapper: the cwd-only extraction used by callers that don't need limits.
export function parseCwd(raw, fallback) {
  return parseStdin(raw, fallback).cwd;
}

// Parse the display fields (model, context %, dirs) from the raw stdin payload; never throws.
export function parseFields(raw) {
  try {
    return fieldsFromPayload(JSON.parse(raw));
  } catch {
    return fieldsFromPayload(null);
  }
}

// ---- real entrypoint (the fd-0 read itself is not exercised by unit tests) ----
function readStdin() {
  if (process.stdin.isTTY) return { cwd: process.cwd(), rateLimits: undefined, payload: null };
  try {
    const raw = readFileSync(0, 'utf8'); // fd 0 = stdin
    return { ...parseStdin(raw, process.cwd(), process.env), payload: parseFields(raw) };
  } catch {
    return { cwd: process.cwd(), rateLimits: undefined, payload: null };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] || '--statusline';
  const { cwd, rateLimits, payload, sessionId, stopHookActive } = readStdin();
  const stdinUsage = usageFromRateLimits(rateLimits);
  runCli(mode, cwd, { stdinUsage, payload, sessionId, stopHookActive })
    .then((out) => process.stdout.write(out))
    .catch(() => process.stdout.write(mode === '--statusline' ? 'limit ?' : '{}'));
}
