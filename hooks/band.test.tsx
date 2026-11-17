import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = (props = {}) => ({
  plugin: 'usage-limit-guard',
  component: 'AbovePrompt',
  requestId: 'usage-limit-guard',
  surface: 'terminal',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 3 }, view: {}, ...props },
}) as const

// The engine normalizes /cfg to C:\cfg on Windows: compare the tail.
const flag = (path: string) => path.replace(/^C:/, '').split(String.fromCharCode(92)).join('/')

// Nothing sits beneath the plugin: each hook here stands for the engine. The fs hooks keep the flag
// file in memory, so a press shows in the next draw as it does in the engine.
const env = (lang: string) => (_: unknown, e: { name: string }) => ({ value: e.name === 'LANG' ? lang : e.name === 'CLAUDE_CONFIG_DIR' ? '/cfg' : undefined })
const memoryFs = (on: On, initial?: string) => {
  const writes: { path: string; text: string }[] = []
  let stored = initial
  on('fs.read', () => { if (stored === undefined) throw new Error('ENOENT'); return { value: stored } })
  on('fs.write', (_, e) => { writes.push(e); stored = e.text; return { value: undefined } })
  return writes
}

test('legend off: the button offers it, no block; pressing writes on and the block appears at once', async ($, on) => {
  on('env.get', env('cs_CZ.UTF-8'))
  const writes = memoryFs(on)

  const ui = await $.ui.mount(BAND())
  expect((await ui.find({ key: 'legend' }))?.text).toContain('popisky')
  expect(await ui.findAll({ type: 'Text' })).toEqual([])
  await ui.press({ key: 'legend' })
  expect(writes.map(w => w.text)).toEqual(['on'])
  expect(flag(writes[0]?.path ?? '')).toBe('/cfg/.limit-guard-legend')
  expect((await ui.find({ key: 'legend' }))?.text).toContain('skrýt')
  expect(await ui.find({ type: 'Text', text: /🧠 paměť konverzace/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /odkládací složka/ })).toBeDefined()
  await ui.unmount()
})

test('legend on: English block under the button; pressing writes off and the block goes at once', async ($, on) => {
  on('env.get', env('en_US.UTF-8'))
  const writes = memoryFs(on, 'on\n')

  const ui = await $.ui.mount(BAND())
  expect((await ui.find({ key: 'legend' }))?.text).toContain('hide')
  expect(await ui.find({ type: 'Text', text: /🧠 conversation memory/ })).toBeDefined()
  await ui.press({ key: 'legend' })
  expect(writes.map(w => w.text)).toEqual(['off'])
  expect(flag(writes[0]?.path ?? '')).toBe('/cfg/.limit-guard-legend')
  expect(await ui.findAll({ type: 'Text' })).toEqual([])
  await ui.unmount()
})

test('a survey on screen leaves the band alone', async ($, on) => {
  on('env.get', () => ({ value: undefined }))
  const ui = await $.ui.mount(BAND({ hasSurvey: true }))
  expect(await ui.find({ key: 'legend' })).toBeUndefined()
  await ui.unmount()
})

test('legend on: one line per part, colored samples use theme colors, the rest is dim', async ($, on) => {
  on('env.get', env('cs_CZ.UTF-8'))
  memoryFs(on, 'on')

  const ui = await $.ui.mount(BAND())
  expect(await ui.find({ type: 'Text', text: /^🧠 paměť konverzace – do 50 % · do 80 % · víc; když dojde, Claude zapomíná detaily$/ })).toBeDefined() // one line
  expect(await ui.find({ type: 'Text', text: /^do 50 %$/ })).toMatchObject({ props: { color: 'success' } })
  expect(await ui.find({ type: 'Text', text: /^do 80 %$/ })).toMatchObject({ props: { color: 'warning' } })
  expect(await ui.find({ type: 'Text', text: /^práh překročen$/ })).toMatchObject({ props: { color: 'error' } })
  const model = await ui.findAll({ type: 'Text', text: /^🤖 model – kdo právě odpovídá$/ })
  expect(model.at(-1)).toMatchObject({ props: { dimColor: true } }) // the inner run
  await ui.unmount()
})
