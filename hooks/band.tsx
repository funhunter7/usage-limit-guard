import type { EngineInterface, Register } from 'claude-code'

// Band mod (Claude Code 2.1.287+): one button above the prompt that toggles the legend, a static
// explanation block drawn under it (the status line stays one row). The flag file is the one
// lib/legendFlag.mjs reads (scripts/status.mjs) and `/limit-guard-legend on|off` writes. A mod cannot
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

// What each status line segment means: one line per part, a part is [text, theme color?]; no color = dim.
// Static on purpose: the band redraws on a press, the status line does not.
type Part = readonly [string, ('success' | 'warning' | 'error')?]
const G = 'success', Y = 'warning', R = 'error'
const LEGEND: Record<'cs' | 'en', Part[][]> = {
  cs: [
    [['🤖 model – kdo právě odpovídá']],
    [['🧠 paměť konverzace – '], ['do 50 %', G], [' · '], ['do 80 %', Y], [' · '], ['víc', R], ['; když dojde, Claude zapomíná detaily']],
    [['⏳ limit relace (5h) – spotřeba 5hodinového okna, čas = kdy se obnoví']],
    [['📅 týdenní limit (7d) – spotřeba týdenního okna']],
    [['barva čísla: '], ['v pořádku', G], [' · '], ['pozor (varovné pásmo)', Y], [' · '], ['práh překročen', R]],
    [['↑ – spotřeba předbíhá čas o 10+ bodů']],
    [['📈 – odhad, kdy limit dojde (jen když je zapnutý)']],
    [['🏠 projekt – kliknutím otevřeš složku']],
    [['🔀 worktree – oddělená kopie projektu (git worktree)']],
    [['📁 odkládací složka – pracovní soubory Clauda']],
  ],
  en: [
    [['🤖 model – who is answering right now']],
    [['🧠 conversation memory – '], ['up to 50%', G], [' · '], ['up to 80%', Y], [' · '], ['more', R], ['; when it runs out, Claude forgets details']],
    [['⏳ session limit (5h) – usage of the 5-hour window, time = when it resets']],
    [['📅 weekly limit (7d) – usage of the weekly window']],
    [['number color: '], ['fine', G], [' · '], ['careful (warn band)', Y], [' · '], ['threshold crossed', R]],
    [['↑ – usage runs ahead of time by 10+ points']],
    [['📈 – estimate of when the limit runs out (only when enabled)']],
    [['🏠 project – click to open the folder']],
    [['🔀 worktree – separate copy of the project (git worktree)']],
    [['📁 scratch folder – Claude\'s working files']],
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
        {isOn && LEGEND[cs ? 'cs' : 'en'].map((line, i) => (
          <Text key={`legend-${i}`}>
            {line.map(([text, color], j) => <Text key={String(j)} color={color} dimColor={!color}>{text}</Text>)}
          </Text>
        ))}
      </Box>
    )
    return below ? <Box flexDirection="column">{mine}{below}</Box> : mine
  })
}
