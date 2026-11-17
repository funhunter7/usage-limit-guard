import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const MARKER_PATH = join(tmpdir(), 'claude-limit-guard-stop.json');

// Keep at most this many recent block keys (same bound as notifyGuard), so the marker can't
// grow unbounded across reset windows and concurrent sessions don't overwrite each other.
const MAX_KEYS = 20;

// One-shot gate for the Stop hook. Returns true if we should block now (and records the
// key), or false if we already blocked for it — preventing an infinite Stop-block loop when a
// custom guard action never writes a handoff. The key encodes cwd|session|reset window, so a
// new window or another session blocks once again, and sessions in different projects (or
// the same one) no longer evict each other's entry.
export function shouldBlockStop(windowKey, deps = {}) {
  const { readFile = readFileSync, writeFile = writeFileSync, path = MARKER_PATH } = deps;
  let keys = [];
  try {
    const obj = JSON.parse(readFile(path, 'utf8'));
    if (Array.isArray(obj.keys)) keys = obj.keys;
    else if (typeof obj.window === 'string') keys = [obj.window]; // marker written by <= 0.13.0
  } catch {
    keys = [];
  }
  if (keys.includes(windowKey)) return false;
  keys.push(windowKey);
  try {
    writeFile(path, JSON.stringify({ keys: keys.slice(-MAX_KEYS) }), 'utf8');
  } catch {
    // best-effort marker; if we can't persist it we simply block again next time
  }
  return true;
}
