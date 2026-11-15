import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getMessages } from './messages.mjs';

export const WARN_BAND = 80;

export const GLYPHS = {
  emoji: { green: '🟢', amber: '🟡', red: '🔴', unknown: '⚪', arrow: '→', sep: ' · ', auth: '🔑', trend: '📈' },
  ascii: { green: '[OK]', amber: '[WARN]', red: '[CRIT]', unknown: '[?]', arrow: '->', sep: ' | ', auth: '[!]', trend: '[>]' },
};

// Choose a glyph set. 'emoji'/'ascii' are explicit. 'auto' (and anything else) renders
// emoji on non-Windows or in known modern Windows hosts (Windows Terminal, VS Code,
// ConEmu); otherwise it assumes legacy conhost/cmd and uses ASCII.
export function resolveStyle(style, env = process.env, platform = process.platform) {
  if (style === 'emoji') return GLYPHS.emoji;
  if (style === 'ascii') return GLYPHS.ascii;
  if (platform !== 'win32') return GLYPHS.emoji;
  if (env.WT_SESSION || env.WT_PROFILE_ID || env.TERM_PROGRAM || env.ConEmuANSI) return GLYPHS.emoji;
  return GLYPHS.ascii;
}

// Terminal capability tier for the compact status line (separate from resolveStyle, which
// the classic layout and hooks keep using). Explicit 'emoji'/'basic'/'ascii' pick the tier;
// 'auto' (and anything else) detects from the environment, first match wins:
//   full  - modern emulator (WT, iTerm2, WezTerm, VS Code, Kitty, ...) and not under tmux/screen
//   ascii - legacy Windows console, ConEmu, TERM=dumb/linux
//   basic - tmux/screen, JetBrains, Konsole, Terminal.app, any other non-Windows terminal
// Returns { name, color, pal, bar, links }: NO_COLOR drops colors, `bar` is 'pill' | 'block'
// | 'ascii', and OSC 8 `links` need tier full plus FORCE_HYPERLINK (Claude Code drops links
// in Windows Terminal unless FORCE_HYPERLINK=1).
const FULL_TERM_PROGRAMS = new Set(['iTerm.app', 'WezTerm', 'vscode', 'ghostty', 'mintty', 'WarpTerminal', 'zed']);

function detectTier(env, platform) {
  const mux = env.TMUX || env.STY;
  const vte = Number(env.VTE_VERSION);
  const full = env.WT_SESSION || FULL_TERM_PROGRAMS.has(env.TERM_PROGRAM) || env.KITTY_WINDOW_ID
    || env.TERM === 'alacritty' || (vte >= 5000 && vte !== 5000);
  if (full && !mux) return 'full';
  if (mux || env.TERMINAL_EMULATOR === 'JetBrains-JediTerm' || env.KONSOLE_VERSION || env.TERM_PROGRAM === 'Apple_Terminal') return 'basic';
  if (env.TERM === 'dumb' || env.TERM === 'linux' || (env.ConEmuANSI && !env.WT_SESSION)) return 'ascii';
  return platform === 'win32' ? 'ascii' : 'basic';
}

// Context-bar glyphs per bar_style: [filled, empty]. 'smooth' is built separately (eighth blocks).
export const BAR_STYLES = ['pill', 'block', 'shade', 'square', 'dot', 'rect', 'line', 'braille', 'smooth'];
const BARS = {
  pill: ['▰', '▱'], block: ['█', '░'], shade: ['▓', '░'], square: ['■', '□'], dot: ['●', '○'],
  rect: ['▮', '▯'], line: ['━', '─'], braille: ['⣿', '⣀'],
};
const EIGHTHS = ['▏', '▎', '▍', '▌', '▋', '▊', '▉'];

export function resolveTier(style, env = process.env, platform = process.platform, barStyle = 'pill') {
  const name = style === 'emoji' ? 'full' : (style === 'basic' || style === 'ascii') ? style : detectTier(env, platform);
  const pill = env.WT_SESSION || env.TERM_PROGRAM === 'iTerm.app' || env.TERM_PROGRAM === 'WezTerm' || env.KITTY_WINDOW_ID || env.VTE_VERSION;
  const fh = env.FORCE_HYPERLINK;
  return {
    name,
    color: !env.NO_COLOR,
    pal: name === 'full' ? 'c256' : 'c16',
    // full tier honors bar_style; the default 'pill' degrades to 'block' where the glyph is unsafe
    bar: name === 'ascii' ? 'ascii' : name === 'basic' ? 'block'
      : barStyle !== 'pill' && BAR_STYLES.includes(barStyle) ? barStyle : pill ? 'pill' : 'block',
    links: name === 'full' && fh !== '0' && (fh === '1' || !env.WT_SESSION),
  };
}

// Reads the runtime/system hour cycle (h11/h12/h23/h24). Injectable for tests.
function detectSystemHourCycle() {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
}

// Reads the runtime/OS default locale (e.g. 'cs-CZ' on a Czech system, 'en-US' otherwise).
// Cross-platform: Intl honors LANG/LC_* on Linux/macOS and the OS region on Windows.
// Injectable for tests.
function detectSystemLocale() {
  return new Intl.DateTimeFormat().resolvedOptions().locale;
}

// Resolve a locale setting to a concrete BCP-47 tag. 'system'/'auto'/empty follow the OS
// (so weekday names and messages need no language setting); anything else passes through —
// unless the tag is structurally invalid (hand-edited config), in which case every Intl
// formatter downstream would throw a RangeError, so fall back to the OS locale instead.
export function resolveLocale(locale, detect = detectSystemLocale) {
  if (locale && locale !== 'system' && locale !== 'auto') {
    try {
      Intl.getCanonicalLocales(locale);
      return locale;
    } catch {
      return detect();
    }
  }
  return detect();
}

// Resolve a time-format setting ('system' | '12' | '24') to a 12-hour boolean.
export function resolveHour12(timeFormat, detectHourCycle = detectSystemHourCycle) {
  if (timeFormat === '12') return true;
  if (timeFormat === '24') return false;
  const hc = detectHourCycle();
  return hc === 'h11' || hc === 'h12';
}

export function bandEmoji(util, threshold, glyphs = GLYPHS.emoji, warnBand = WARN_BAND) {
  if (util == null) return glyphs.unknown;
  if (util >= threshold) return glyphs.red;
  if (util >= warnBand) return glyphs.amber;
  return glyphs.green;
}

// Format the date portion of a cross-day reset as a numeric date with the locale's field
// ORDER but slash separators and no inner spaces, always including the year — e.g. en-US
// `6/3/2026` (month first), cs-CZ/de-DE `3/6/2026` (day first), ja-JP `2026/6/3`.
function formatDate(d, locale, timeZone) {
  return new Intl.DateTimeFormat(locale || undefined, { year: 'numeric', month: 'numeric', day: 'numeric', ...(timeZone ? { timeZone } : {}) })
    .formatToParts(d)
    .filter((p) => p.type === 'day' || p.type === 'month' || p.type === 'year')
    .map((p) => p.value)
    .join('/');
}

// Return a `YYYY-M-D` key for a date as it falls in the given zone (for same-day comparison).
function ymdInZone(d, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Format the clock portion of a reset time as a locale-aware HH:MM (or h:MM AM/PM when hour12).
// When timeZone is set, render the wall-clock in that zone via Intl (deterministic across hosts);
// otherwise fall back to the host-zone getHours()/getMinutes() path.
function formatClock(d, locale, hour12, timeZone) {
  if (timeZone) {
    const opts = hour12
      ? { hour: 'numeric', minute: '2-digit', hour12: true, timeZone }
      : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone };
    return new Intl.DateTimeFormat(locale || undefined, opts).format(d);
  }
  if (hour12) {
    return new Intl.DateTimeFormat(locale || undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  }
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Format a relative countdown from now to d: "in 2h13m" (en) / "za 2h13m" (cs).
// h>0, m>0 -> "Hh Mm" (e.g. "2h13m"); h>0, m===0 -> "Hh" (e.g. "8h"); h===0 -> "Mm" (e.g. "13m" or "0m").
// Clamps to 0m when d is in the past.
function formatRelative(d, now, locale) {
  const mins = Math.max(0, Math.round((d - now) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const word = getMessages(locale).relIn;
  const hPart = h ? `${h}h` : '';
  const mPart = (m || !h) ? `${m}m` : '';
  return `${word} ${hPart}${mPart}`;
}

export function formatReset(resetsAt, opts = {}) {
  const { now = new Date(), locale = undefined, hour12 = false, glyphs = GLYPHS.emoji, resetDisplay = 'clock', timeZone = undefined } = opts;
  if (!resetsAt) return '';
  const d = new Date(resetsAt);
  if (Number.isNaN(d.getTime())) return '';

  if (resetDisplay === 'relative') {
    return `${glyphs.arrow} ${formatRelative(d, now, locale)}`;
  }

  const time = formatClock(d, locale, hour12, timeZone);
  const weekdayOpts = { weekday: 'long', ...(timeZone ? { timeZone } : {}) };
  const sameDay = timeZone
    ? ymdInZone(d, timeZone) === ymdInZone(now, timeZone)
    : d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

  if (resetDisplay === 'both') {
    const clockStr = sameDay ? time : `${d.toLocaleDateString(locale || undefined, weekdayOpts)} ${formatDate(d, locale, timeZone)} ${time}`;
    return `${glyphs.arrow} ${clockStr} (${formatRelative(d, now, locale)})`;
  }

  // resetDisplay === 'clock' (default)
  if (sameDay) return `${glyphs.arrow} ${time}`;
  const weekday = d.toLocaleDateString(locale || undefined, weekdayOpts);
  const date = formatDate(d, locale, timeZone);
  return `${glyphs.arrow} ${weekday} ${date} ${time}`;
}

export function formatLimit(label, limit, threshold, opts = {}) {
  const { now = new Date(), locale = undefined, hour12 = false, glyphs = GLYPHS.emoji, warnBand = WARN_BAND, resetDisplay = 'clock', timeZone = undefined } = opts;
  if (!limit || limit.utilization == null) return `${glyphs.unknown} ${label} ?`;
  const pct = Math.round(limit.utilization);
  const emoji = bandEmoji(limit.utilization, threshold, glyphs, warnBand);
  const reset = formatReset(limit.resets_at, { now, locale, hour12, glyphs, resetDisplay, timeZone });
  return `${emoji} ${label} ${pct}%${reset ? ' ' + reset : ''}`;
}

// Compact duration like "1h40m" / "8m" / "2h" (no leading word). Clamps to 0m.
function formatDuration(mins) {
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hPart = h ? `${h}h` : '';
  const mPart = (m || !h) ? `${m}m` : '';
  return `${hPart}${mPart}`;
}

// Burn-rate projection segment: "📈 ~1h40m to 90%" (en) / "📈 ~1h40m do 90%" (cs).
// `minutes` null (no usable projection) renders nothing.
export function formatProjection(minutes, threshold, opts = {}) {
  const { locale = undefined, glyphs = GLYPHS.emoji } = opts;
  if (minutes == null) return '';
  const word = getMessages(locale).toThreshold;
  return `${glyphs.trend} ~${formatDuration(minutes)} ${word} ${Math.round(threshold)}%`;
}

// ---- compact layout -------------------------------------------------------------------

const SGR = {
  c256: { green: '38;5;114', amber: '38;5;214', red: '38;5;203', dim: '38;5;245' },
  c16: { green: '32', amber: '33', red: '31', dim: '90' },
};
const PACE_MARGIN = 10;
const HOUR_MS = 3600000;
const WINDOW_LEN_MS = { five_hour: 5 * HOUR_MS, seven_day: 168 * HOUR_MS, seven_day_opus: 168 * HOUR_MS, seven_day_sonnet: 168 * HOUR_MS };

function paint(tier, role, text) {
  return tier.color ? `\x1b[${SGR[tier.pal][role]}m${text}\x1b[0m` : text;
}

// Strip control, format (bidi/zero-width) and line-separator characters: model/dir names come
// from stdin and must not inject escapes or spoof the text.
const clean = (s) => String(s).replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, '');

// OSC 8 hyperlink (BEL terminator only); plain text when links are off.
const osc8 = (tier, href, text) => (tier.links ? `\x1b]8;;${href}\x07${text}\x1b]8;;\x07` : text);

// Link to a local path.
function link(tier, dir, text) {
  if (!tier.links || !dir || !isAbsolute(dir)) return text;
  try {
    return osc8(tier, pathToFileURL(dir).href, text);
  } catch {
    return text;
  }
}

// Base URL of the legend docs page printed by /limit-guard-legend (plain text, not a link).
// Czech locales get the Czech page, everything else English.
const HELP_BASE = 'https://github.com/funhunter7/claude-limit-guard/blob/main/docs/legend.';
const helpLang = (locale) => (String(locale || '').toLowerCase().startsWith('cs') ? 'cs' : 'en');

// True when utilization runs ahead of elapsed window time by at least PACE_MARGIN points.
// No resets_at (or an unknown window) => false.
export function paceAhead(key, win, now = new Date()) {
  const len = WINDOW_LEN_MS[key];
  const reset = win?.resets_at == null ? NaN : new Date(win.resets_at).getTime();
  if (!len || Number.isNaN(reset) || typeof win.utilization !== 'number') return false;
  const elapsedPct = Math.min(1, Math.max(0, 1 - (reset - now.getTime()) / len)) * 100;
  return win.utilization - elapsedPct >= PACE_MARGIN;
}

// Always 10 cells. Round once so bar, label and color agree.
function contextSegment(pct, tier) {
  const p = Math.round(pct);
  const cells = Math.min(10, Math.max(0, Math.round(p / 10)));
  let bar;
  if (tier.bar === 'ascii') {
    bar = `[${'#'.repeat(cells)}${'-'.repeat(10 - cells)}]`;
  } else if (tier.bar === 'smooth') {
    const eighths = Math.round(p * 0.8);
    const whole = Math.floor(eighths / 8);
    const part = eighths % 8 ? EIGHTHS[(eighths % 8) - 1] : '';
    bar = '█'.repeat(whole) + part + '░'.repeat(10 - whole - part.length);
  } else {
    const [on, off] = BARS[tier.bar] || BARS.block;
    bar = on.repeat(cells) + off.repeat(10 - cells);
  }
  const role = p < 50 ? 'green' : p < 80 ? 'amber' : 'red';
  return paint(tier, role, `${bar} ${p}%`);
}

// Reset without the arrow glyph: HH:MM same day, "<short weekday> HH:MM" otherwise.
function formatCompactReset(resetsAt, { now, locale, hour12, resetDisplay, timeZone }) {
  if (!resetsAt) return '';
  const d = new Date(resetsAt);
  if (Number.isNaN(d.getTime())) return '';
  const rel = formatRelative(d, now, locale);
  if (resetDisplay === 'relative') return rel;
  const time = formatClock(d, locale, hour12, timeZone);
  const sameDay = timeZone
    ? ymdInZone(d, timeZone) === ymdInZone(now, timeZone)
    : d.toDateString() === now.toDateString();
  const clock = sameDay ? time : `${d.toLocaleDateString(locale || undefined, { weekday: 'short', ...(timeZone ? { timeZone } : {}) })} ${time}`;
  return resetDisplay === 'both' ? `${clock} (${rel})` : clock;
}

function formatCompact(usage, threshold, watch, o) {
  const { tier, glyphs, now, locale, hour12, warnBand, resetDisplay, thresholdOverrides, timeZone } = o;
  const labels = getMessages(locale).labelsShort;
  let keys = watch.filter((k) => labels[k] && typeof usage[k]?.utilization === 'number');
  if (o.windowDisplay === 'nearest' && keys.length > 1) {
    const ratio = (k) => usage[k].utilization / ((thresholdOverrides[k] ?? threshold) || 1e-9);
    keys = [keys.reduce((best, k) => (ratio(k) > ratio(best) ? k : best))];
  }
  if (!keys.length) return `${glyphs.unknown} limit ?`;

  const cols = [];
  if (o.showModel && o.model) cols.push(clean(o.model));
  if (o.showContext && o.contextPct != null) cols.push(contextSegment(o.contextPct, tier));
  for (const key of keys) {
    const win = usage[key];
    const eff = thresholdOverrides[key] ?? threshold;
    // Band coloring uses the raw utilization (not the rounded label), same as classic.
    const role = win.utilization >= eff ? 'red' : win.utilization >= warnBand ? 'amber' : 'green';
    const arrow = o.paceArrow && paceAhead(key, win, now) ? (tier.name === 'ascii' ? '^' : '↑') : '';
    const reset = formatCompactReset(win.resets_at, { now, locale, hour12, resetDisplay, timeZone });
    cols.push(`${paint(tier, 'dim', labels[key])} ${paint(tier, role, `${Math.round(win.utilization)}%${arrow}`)}${reset ? ' ' + reset : ''}`);
  }
  if (o.projectionDisplay === 'on' && o.projection && o.projection.minutes != null) {
    cols.push(formatProjection(o.projection.minutes, o.projection.threshold, { locale, glyphs }));
  }
  if (o.showPaths) {
    for (const p of o.paths || []) {
      const prefix = tier.name === 'full' ? { project: '🏠 ', worktree: '🔀 ', scratch: '📁 ' }[p.kind] || '' : '';
      cols.push(link(tier, p.dir, clean(prefix + p.name)));
    }
  }
  const sep = tier.name === 'ascii' ? ' | ' : ' │ ';
  return cols.join(sep);
}

// /limit-guard-legend: one "<sample> — <meaning>" line per status-line item, with samples
// drawn by the same renderers (and the caller's tier/glyphs) as the live line. Never colored:
// the output is read in chat, not in a terminal.
export function legendLines(tier, glyphs, locale) {
  const m = getMessages(locale);
  const t = { ...tier, color: false };
  const labels = m.labelsShort;
  const prefix = (kind) => (t.name === 'full' ? { project: '🏠 ', worktree: '🔀 ', scratch: '📁 ' }[kind] : '');
  const rows = [
    ['Opus 5.5', m.legend.model],
    [contextSegment(42, t), m.legend.context],
    [`${labels.five_hour} 42%`, m.legend.session],
    [`${labels.seven_day} 25%`, m.legend.weekly],
    [`84%${t.name === 'ascii' ? '^' : '↑'}`, m.legend.pace],
    [formatProjection(100, 90, { locale, glyphs }), m.legend.projection],
    ['my-project', m.legend.project],
    [`${prefix('worktree')}my-branch`, m.legend.worktree],
    [`${prefix('scratch')}scratchpad`, m.legend.scratch],
  ];
  return [m.legend.header, ...rows.map(([sample, meaning]) => `${sample} — ${meaning}`), `${m.legend.docs} ${HELP_BASE}${helpLang(locale)}.md`];
}

export function formatStatusLine(usage, threshold, watch, opts = {}) {
  const { now = new Date(), locale = undefined, hour12 = false, glyphs = GLYPHS.emoji, warnBand = WARN_BAND, labelStyle = 'full', resetDisplay = 'clock', thresholdOverrides = {}, projectionDisplay = 'off', projection = null, timeZone = undefined, layout = 'classic' } = opts;
  const m = getMessages(locale);
  if (usage && usage.authError) return `${glyphs.auth} ${m.signIn}`;
  if (!usage) return `${glyphs.unknown} limit ?`;
  if (layout === 'compact') {
    const tier = opts.tier || resolveTier('auto');
    return formatCompact(usage, threshold, watch, { ...opts, tier, glyphs, now, locale, hour12, warnBand, resetDisplay, thresholdOverrides, projectionDisplay, projection, timeZone });
  }
  const labels = labelStyle === 'short' ? m.labelsShort : m.labels;
  const parts = [];
  for (const key of watch) {
    if (labels[key]) {
      // Use per-window threshold when set; fall back to the global threshold.
      const effThreshold = thresholdOverrides[key] ?? threshold;
      parts.push(formatLimit(labels[key], usage[key], effThreshold, { now, locale, hour12, glyphs, warnBand, resetDisplay, timeZone }));
    }
  }
  if (projectionDisplay === 'on' && projection && projection.minutes != null && parts.length) {
    parts.push(formatProjection(projection.minutes, projection.threshold, { locale, glyphs }));
  }
  return parts.length ? parts.join(glyphs.sep) : `${glyphs.unknown} limit ?`;
}
