// Legend mode flag file: `<CLAUDE_CONFIG_DIR or ~/.claude>/.limit-guard-legend`, content `on`
// = the band mod (hooks/band.tsx) shows the legend block; it writes the same file.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function legendFlagPath(env = process.env) {
  return join(env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), '.limit-guard-legend');
}

// Cheap check run on every status line render; any error (missing file, ...) means off.
export function isLegendOn(env = process.env) {
  try {
    return readFileSync(legendFlagPath(env), 'utf8').trim() === 'on';
  } catch {
    return false;
  }
}

// `on` writes the flag, `off` deletes it. Throws on a real fs error (callers report it).
export function setLegend(on, env = process.env) {
  const path = legendFlagPath(env);
  if (on) writeFileSync(path, 'on', 'utf8');
  else rmSync(path, { force: true });
}
