import type { EngineInterface, Register } from 'claude-code'

// Band mod (Claude Code 2.1.287+): one button above the prompt that toggles the legend, a static
// explanation block drawn under it (the status line stays one row). The flag file is the one
// lib/legendFlag.mjs reads (bin/status.mjs) and `/limit-guard-legend on|off` writes. A mod cannot
// import Node modules, so the path and the locale are worked out again here.

// Windows sets USERPROFILE, not HOME.
const home = async ($: EngineInterface) => (await $.env.get('HOME')) || (await $.env.get('USERPROFILE'))
const flagPath = async ($: EngineInterface) =>
  `${(await $.env.get('CLAUDE_CONFIG_DIR')) || `${await home($)}/.claude`}/.limit-guard-legend`

// Czech or English; same source as the plugin's messages (the OS locale), LANG first for POSIX shells.
async function isCzech($: EngineInterface): Promise<boolean> {
  // $.env.get takes literal names (so the variables a module reads can be listed).
  const v = (await $.env.get('LC_ALL')) || (await $.env.get('LC_MESSAGES')) || (await $.env.get('LANG'))
  if (v) return v.toLowerCase().startsWith('cs')
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('cs')
  } catch {
    return false
  }
}

// Anything but `on` (a missing file, `off`) means off. $.fs has no delete, so the button writes `off`.
async function legendOn($: EngineInterface): Promise<boolean> {
  try {
    return (await $.fs.read(await flagPath($))).trim() === 'on'
  } catch {
    return false
  }
}

// What each status line segment means. Static on purpose: the band redraws on a press, the status line does not.
const LEGEND = {
  cs: [
    'Opus 5.5 = model · ▰▱ 42% = paměť konverzace (zelená <50 %, žlutá <80 %, pak červená)',
    '5h = limit relace · 7d = týdenní limit · ↑ = spotřeba předbíhá čas · čas = kdy se limit obnoví',
    'název = projekt (klik otevře složku) · 🌿 = worktree · 📁 = odkládací složka',
  ],
  en: [
    'Opus 5.5 = model · ▰▱ 42% = context window (green <50%, yellow <80%, then red)',
    '5h = session limit · 7d = weekly limit · ↑ = usage runs ahead of time · time = when the limit resets',
    'name = project (click opens the folder) · 🌿 = worktree · 📁 = scratch folder',
  ],
}

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    // Other mods share this slot: draw theirs below ours instead of replacing it.
    // next(e) rejects only when nothing answers beneath (the test harness): the button still draws.
    const below = await next(e).catch(() => undefined)

    const isOn = await legendOn($)
    const cs = await isCzech($)
    const label = isOn ? (cs ? 'ⓘ skrýt popisky' : 'ⓘ hide legend') : cs ? 'ⓘ popisky' : 'ⓘ legend'
    const toggle = async () => {
      try {
        await $.fs.write(await flagPath($), isOn ? 'off' : 'on')
        $.ui.invalidate('ui.render')
      } catch {
        $.ui.toast(cs ? 'limit-guard: nepodařilo se přepnout popisky' : 'limit-guard: could not toggle the legend')
      }
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const mine = (
      <Box flexDirection="column">
        <Box>
          <Button key="legend" label={label} hotkey="l" onPress={toggle} />
        </Box>
        {isOn && LEGEND[cs ? 'cs' : 'en'].map((line, i) => <Text key={`legend-${i}`} dimColor>{line}</Text>)}
      </Box>
    )
    return below ? <Box flexDirection="column">{mine}{below}</Box> : mine
  })
}
