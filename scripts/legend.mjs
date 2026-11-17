#!/usr/bin/env node
// Powers /limit-guard-legend: explains every status line item, with samples drawn in the
// user's current terminal tier (glyphs/bar style). `on`/`off` switch legend mode (the explanation
// block the band mod draws above the prompt) instead.
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../lib/config.mjs';
import { legendLines, resolveLocale, resolveStyle, resolveTier } from '../lib/format.mjs';
import { setLegend } from '../lib/legendFlag.mjs';
import { getMessages } from '../lib/messages.mjs';

// Pure: render the legend for a config + environment as a multi-line string.
export function renderLegend(cfg, env = process.env, platform = process.platform) {
  const locale = resolveLocale(cfg.locale);
  const tier = resolveTier(cfg.style, env, platform, cfg.barStyle);
  return legendLines(tier, resolveStyle(cfg.style, env, platform), locale).join('\n');
}

// `on`/`off` toggle the flag file (under env.CLAUDE_CONFIG_DIR when set) and return the
// localized confirmation; no argument returns the legend text; anything else throws.
export function runLegend(arg, cfg, env = process.env, platform = process.platform) {
  const a = String(arg ?? '').trim().toLowerCase();
  if (a === '') return renderLegend(cfg, env, platform);
  if (a !== 'on' && a !== 'off') throw new Error(`unknown argument "${arg}" (use on or off)`);
  setLegend(a === 'on', env);
  const m = getMessages(resolveLocale(cfg.locale));
  return a === 'on' ? m.legendOn : m.legendOff;
}

function main() {
  process.stdout.write(runLegend(process.argv[2], loadConfig(process.cwd())) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`ERROR: ${e.message}\n`);
    process.exit(1);
  }
}
