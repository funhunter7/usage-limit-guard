import { readFileSync } from 'node:fs';
import { statePath, writeStateFile } from './stateDir.mjs';

export const SNOOZE_PATH = statePath('snooze.json');

// Persist a snooze expiry (ms epoch). While active, the guard/context directives are
// suppressed. Best-effort: a failed write simply means no snooze takes effect.
export function setSnooze(untilMs, deps = {}) {
  const { writeFile = writeStateFile, path = SNOOZE_PATH } = deps;
  try { writeFile(path, JSON.stringify({ until: untilMs })); } catch { /* best-effort */ }
  return path;
}

// Clear any active snooze (writes an already-expired marker).
export function clearSnooze(deps = {}) {
  const { writeFile = writeStateFile, path = SNOOZE_PATH } = deps;
  try { writeFile(path, JSON.stringify({ until: 0 })); } catch { /* best-effort */ }
  return path;
}

// Returns the active expiry (ms) if a snooze is in effect at `now`, else null. Never throws.
export function snoozeUntil(now, deps = {}) {
  const { readFile = readFileSync, path = SNOOZE_PATH } = deps;
  try {
    const until = JSON.parse(readFile(path, 'utf8')).until;
    return (typeof until === 'number' && now < until) ? until : null;
  } catch {
    return null;
  }
}
