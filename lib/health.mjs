// Shared, dependency-injectable health probes used by both /limit-guard-status and
// /limit-guard-doctor. All probes are best-effort and never throw.
import { readFileSync } from 'node:fs';
import { getToken } from './credentials.mjs';
import { CACHE_PATH } from './usage.mjs';
import { globalSettingsPath } from './pluginSettings.mjs';

// True when an OAuth token is available. Injectable for tests.
export function probeTokenPresent(getTok = getToken) {
  try {
    return getTok() !== null;
  } catch {
    return false;
  }
}

// True when the global settings.json statusLine.command references this plugin (usage.mjs).
export function probeStatusLineWired(env = process.env, readFile = readFileSync) {
  try {
    const settings = JSON.parse(readFile(globalSettingsPath(env), 'utf8'));
    const cmd = settings?.statusLine?.command;
    return typeof cmd === 'string' && cmd.includes('usage.mjs');
  } catch {
    return false;
  }
}

// Cache age in ms (now - cache.ts), or null when the cache is absent or malformed.
export function probeCacheAge(cachePath = CACHE_PATH, now = Date.now(), readFile = readFileSync) {
  try {
    const obj = JSON.parse(readFile(cachePath, 'utf8'));
    if (typeof obj.ts !== 'number') return null;
    return Math.max(0, now - obj.ts);
  } catch {
    return null;
  }
}

// True when Windows Terminal would hide the status line links: WT_SESSION is set and
// FORCE_HYPERLINK is set neither in the environment nor in settings.json `env`. An explicit
// FORCE_HYPERLINK=0 (env or settings.json) is a deliberate opt-out, so it is not "hidden".
export function probeLinksHidden(env = process.env, readFile = readFileSync) {
  if (!env.WT_SESSION || env.FORCE_HYPERLINK === '1' || env.FORCE_HYPERLINK === '0') return false;
  try {
    const v = JSON.parse(readFile(globalSettingsPath(env), 'utf8').replace(/^\uFEFF/, ''))?.env?.FORCE_HYPERLINK;
    return v !== '1' && v !== '0';
  } catch {
    return true; // no readable settings => not enabled there either
  }
}
