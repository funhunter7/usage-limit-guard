import { readFileSync } from 'node:fs';
import { writeStateFile } from './stateDir.mjs';

export function readCache(path, ttlMs, now = Date.now(), readFile = readFileSync) {
  try {
    const obj = JSON.parse(readFile(path, 'utf8'));
    if (typeof obj.ts !== 'number') return null;
    if (now - obj.ts > ttlMs) return null;
    return obj.data;
  } catch {
    return null;
  }
}

// Synchronous by contract: callers in scripts/usage.mjs invoke this fire-and-forget
// (no await). Keep it sync — do not switch to fs.promises without updating those callers.
export function writeCache(path, data, now = Date.now(), writeFile = writeStateFile) {
  try {
    writeFile(path, JSON.stringify({ ts: now, data }));
    return true;
  } catch {
    return false;
  }
}
