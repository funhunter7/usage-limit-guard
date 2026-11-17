import { existsSync, opendirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { statePath, writeStateFile } from './stateDir.mjs';

const CACHE_MAX = 20; // sessions remembered in the scratch-dir cache

// A usable scratch dir exists and holds at least one entry (one dirent read, not a full
// readdir); any fs error => not usable.
function nonEmptyDir(dir) {
  try {
    const d = opendirSync(dir);
    try {
      return d.readSync() !== null;
    } finally {
      d.closeSync();
    }
  } catch {
    return false;
  }
}

// Per-session cache of the resolved built-in scratchpad dir, stored next to the plugin's
// other cache files so the `<tmp>/claude` scan runs once per session, not once per render.
function readScratchCache(path) {
  try {
    const obj = JSON.parse(readFileSync(path, 'utf8'));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

function writeScratchCache(path, map, sessionId, dir) {
  try {
    delete map[sessionId];
    map[sessionId] = dir;
    for (const k of Object.keys(map).slice(0, -CACHE_MAX)) delete map[k];
    writeStateFile(path, JSON.stringify(map));
  } catch {
    // best-effort: a failed write only costs a re-scan next render
  }
}

// Built-in scratchpad: `<tmp>/claude/<hash-slug>/<session>/scratchpad`. The slug is not
// derivable from the project path, so scan once and cache by session id.
function findBuiltinScratch(sessionId, tmp, cachePath) {
  const cache = readScratchCache(cachePath);
  const cached = cache[sessionId];
  if (typeof cached === 'string' && existsSync(cached)) return cached;
  try {
    const root = join(tmp, 'claude');
    // shortcut: first match wins if several project slugs hold this session id
    const found = readdirSync(root)
      .map((e) => join(root, e, sessionId, 'scratchpad'))
      .find((c) => existsSync(c)) ?? null;
    if (found) writeScratchCache(cachePath, cache, sessionId, found);
    return found;
  } catch {
    return null;
  }
}

/**
 * Find the scratch folder to show: the configured `scratchDir` (leading `~` => home,
 * relative => against the project dir) or Claude Code's built-in scratchpad (cached per
 * session). Returns null when nothing usable (missing or empty); never throws.
 * `tmp`, `home` and `cachePath` are injectable for tests.
 * @returns {string|null}
 */
export function resolveScratchDir({
  scratchDir = '', projectDir = null, sessionId = null, tmp = tmpdir(), home = homedir(),
  cachePath = statePath('scratch.json'),
} = {}) {
  let dir = null;
  if (scratchDir) {
    const expanded = /^~(?=$|[\\/])/.test(scratchDir) ? join(home, scratchDir.slice(1)) : scratchDir;
    dir = resolve(projectDir || process.cwd(), expanded);
  } else if (sessionId && /^[\w-]+$/.test(sessionId)) { // reject separators: the id becomes a path part
    dir = findBuiltinScratch(sessionId, tmp, cachePath);
  }
  return dir && nonEmptyDir(dir) ? dir : null;
}

/**
 * Path segments for the compact status line: project, worktree (only inside a linked
 * worktree session) and scratch. Each is { kind, name, dir } where `dir` is the link target.
 * @param {object} fields Output of fieldsFromPayload.
 * @param {{scratchDir?: string, tmp?: string, home?: string, cachePath?: string}} [opts]
 */
export function buildPaths(fields, { scratchDir = '', tmp, home, cachePath } = {}) {
  const out = [];
  const projectDir = fields.projectDir || fields.currentDir;
  if (projectDir) out.push({ kind: 'project', name: basename(projectDir) || projectDir, dir: projectDir });
  if (fields.worktreeName) {
    out.push({ kind: 'worktree', name: fields.worktreeName, dir: fields.worktreePath || fields.currentDir });
  }
  const scratch = resolveScratchDir({ scratchDir, projectDir, sessionId: fields.sessionId, tmp, home, cachePath });
  if (scratch) out.push({ kind: 'scratch', name: basename(scratch) || scratch, dir: scratch });
  return out;
}
