#!/usr/bin/env node
// Powers /limit-guard-setup: wires the status line into the global settings.json,
// backing up the previous file first. Idempotent: a no-op when already wired.
// --force-hyperlink instead sets env.FORCE_HYPERLINK=1 (clickable links in Windows Terminal;
// an explicit "0" is left alone). --check-hyperlink prints `ask` or `skip`: whether to offer it.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../lib/config.mjs';
import { resolveLocale } from '../lib/format.mjs';
import { getMessages } from '../lib/messages.mjs';
import { probeLinksHidden } from '../lib/health.mjs';
import { globalSettingsPath } from '../lib/pluginSettings.mjs';

// Re-run the status line on a fixed timer (seconds) on top of Claude Code's event-driven
// updates. This keeps the value current while the session is idle — notably so it refreshes
// itself shortly after a limit reset, which event-only updates would miss. The matching
// staleness check in bin/usage.mjs makes these idle re-runs cheap (no network until a reset
// actually passes). See docs/superpowers/specs/2026-06-13-stale-after-reset-design.md.
export const REFRESH_INTERVAL_SECONDS = 60;

// Pure: returns the settings object with statusLine pointing at our command (with the
// refresh interval), plus a `changed` flag. Other keys are preserved; a matching existing
// command AND interval is a no-op — a wiring that lacks/differs in refreshInterval is upgraded.
export function computeSettings(existing, command, refreshInterval = REFRESH_INTERVAL_SECONDS) {
  const cur = existing?.statusLine;
  if (cur && cur.type === 'command' && cur.command === command && cur.refreshInterval === refreshInterval) {
    return { settings: existing, changed: false };
  }
  return { settings: { ...existing, statusLine: { type: 'command', command, refreshInterval } }, changed: true };
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Pure: returns settings with env.FORCE_HYPERLINK="1" (other env keys preserved) plus a `changed` flag.
// Claude Code hides terminal links in Windows Terminal unless this is set; it applies to every
// link Claude Code prints, which is why it is an explicit opt-in (`--force-hyperlink`).
// An explicit "0" is the user's deliberate opt-out: left alone (`optedOut`). A non-object `env`
// is never overwritten: throws, so the caller writes nothing.
export function computeForceHyperlink(existing) {
  const env = existing?.env;
  if (env !== undefined && !isPlainObject(env)) throw new Error('settings.json "env" is not an object; fix it by hand first');
  if (env?.FORCE_HYPERLINK === '1') return { settings: existing, changed: false };
  if (env?.FORCE_HYPERLINK === '0') return { settings: existing, changed: false, optedOut: true };
  return { settings: { ...existing, env: { ...env, FORCE_HYPERLINK: '1' } }, changed: true };
}

// Applies either the status line wiring or (forceHyperlink) the FORCE_HYPERLINK env to the
// settings file, backing up the previous file first. Returns the messages to print.
export function runSetup({ pluginRoot, settingsPath, forceHyperlink = false, m }) {
  let raw = null;
  try { raw = readFileSync(settingsPath, 'utf8'); } catch { /* no global settings yet */ }
  // A settings.json we cannot parse must never be overwritten (it would lose the user's
  // other settings): abort before writing anything.
  let existing = {};
  if (raw != null) {
    try { existing = JSON.parse(raw.replace(/^\uFEFF/, '')); } catch (e) { throw new Error(`${settingsPath} is not valid JSON (${e.message}); nothing was changed`, { cause: e }); }
    if (!isPlainObject(existing)) throw new Error(`${settingsPath} is not a JSON object; nothing was changed`);
  }

  const command = `node "${join(pluginRoot, 'bin', 'usage.mjs')}" --statusline`;
  const { settings, changed, optedOut } = forceHyperlink ? computeForceHyperlink(existing) : computeSettings(existing, command);
  if (optedOut) return [m.setupHyperlinkOptOut];
  const done = forceHyperlink ? m.setupHyperlinkSet : m.setupWired;

  if (!changed) return [forceHyperlink ? m.setupHyperlinkAlready : m.setupAlreadyWired];

  const out = [];
  // Back up the previous settings (raw bytes) before overwriting, when one existed.
  if (raw != null) {
    const bak = settingsPath + '.bak-limitguard';
    try {
      writeFileSync(bak, raw, 'utf8');
      out.push(m.setupBackedUp(bak));
    } catch { /* best-effort backup */ }
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  out.push(done);
  return out;
}

function main() {
  const args = process.argv.slice(2);
  // Same decision as the doctor's links-hidden probe: ask only when links are really hidden.
  if (args.includes('--check-hyperlink')) {
    process.stdout.write(probeLinksHidden(process.env) ? 'ask\n' : 'skip\n');
    return;
  }
  const cfg = loadConfig(process.cwd());
  const m = getMessages(resolveLocale(cfg.locale));
  const lines = runSetup({
    pluginRoot: args.find((a) => !a.startsWith('--')) || process.cwd(),
    settingsPath: globalSettingsPath(process.env),
    forceHyperlink: args.includes('--force-hyperlink'),
    m,
  });
  process.stdout.write(lines.join('\n') + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`ERROR: ${e.message}\n`);
    process.exit(1);
  }
}
