// Dutch (nl) — best-effort translation, reviewed 2026-06; placeholders identical to en.mjs.
export default {
  signIn: 'aanmelden',
  relIn: 'over',
  toThreshold: 'tot',
  labels: { five_hour: 'Sessielimiet:', seven_day: 'Weeklimiet:', seven_day_opus: 'Week Opus:', seven_day_sonnet: 'Week Sonnet:' },
  labelsShort: { five_hour: '5h', seven_day: '7d', seven_day_opus: '7dO', seven_day_sonnet: '7dS' },
  statusHeader: 'usage-limit-guard status',
  statusConfig: 'Configuratie',
  statusHealth: 'Gezondheid',
  statusTokenOk: 'token: ok',
  statusTokenMissing: 'token: ontbreekt',
  statusCacheFresh: (secs) => `cache: ${secs}s geleden`,
  statusCacheNone: 'cache: geen cache',
  statusLineWired: 'statusbalk: aangesloten',
  statusLineNotWired: 'statusbalk: niet aangesloten',
  statusHistoryReadings: (n) => `geschiedenis: ${n} metingen`,
  statusHistoryNone: 'geschiedenis: geen gegevens',
  statusGuardActionDefault: 'standaard',
  contextLabel: (line, threshold) =>
    `Abonnementslimiet (usage-limit-guard): ${line}. Drempel ${threshold}%.`,
  breach: (breached, action) => `DREMPEL OVERSCHREDEN (${breached}). ${action}`,
  contextAction: (handoff) =>
    `Voer de guard-routine uit: rond de huidige atomaire stap af, sla een overdracht op in ${handoff} ` +
    `(wat klaar is, wat resteert, de huidige git-branch, de tot nu toe gewijzigde bestanden, de concrete ` +
    `volgende stap om te hervatten, resettijd), zeg de gebruiker dat hij de pc kan uitschakelen en neem ` +
    `geen nieuwe taken meer aan. Als .claude/limit-guard.md bestaat, volg die.`,
  stopAction: (handoff) =>
    `Stop nog niet — voer de guard-routine uit: rond de huidige atomaire stap af, sla daarna een overdracht ` +
    `op in ${handoff} die de huidige git-branch, de tot nu toe gewijzigde bestanden en de concrete volgende ` +
    `stap om te hervatten vastlegt. Zeg de gebruiker dat hij de pc kan uitschakelen. Volg ` +
    `.claude/limit-guard.md als die bestaat.`,
  stopReason: (threshold, breached, action) =>
    `usage-limit-guard: limiet boven drempel ${threshold}% (${breached}). ${action}`,
  resume: (handoff) =>
    `Overdrachtsbestand ${handoff} gevonden van eerder werk dat door een gebruikslimiet werd onderbroken. ` +
    `Bied aan te hervatten en lees het als begincontext.`,
  warnAction: 'Rond je huidige stap netjes af — een gebruikslimiet nadert.',
  warn: (warned, action) => `LIMIET NADERT (${warned}). ${action}`,
  notifyTitle: 'usage-limit-guard',
  notifyWarn: (window) => `Limiet ${window} nadert.`,
  notifyBreach: (window) => `Drempel overschreden bij ${window} — tijd om af te ronden.`,
  notifyReset: (window) => `Je ${window}-limiet is gereset — je kunt weer aan de slag.`,
  snoozeSet: (u) => `Bewaker gepauzeerd tot ${u}.`,
  snoozeCleared: 'Pauze opgeheven.',
  snoozeNone: 'Geen actieve pauze.',
  doctorHeader: 'usage-limit-guard zelftest',
  doctor_node: 'Node ≥ 18',
  doctor_token: 'OAuth-token',
  doctor_statusline: 'statusbalk aangesloten',
  doctor_cache: 'gebruikscache vers',
  doctor_version: 'pluginversie',
  doctorHint_node: 'Werk Node bij naar v18 of nieuwer.',
  doctorHint_token: 'Meld je aan bij Claude Code.',
  doctorHint_statusline: 'Voer /limit-guard-setup uit om de statusbalk aan te sluiten.',
  doctorHint_cache: 'Open een Claude Code-sessie zodat de statusbalk de cache ververst.',
  doctorHint_version: 'Werk de plugin bij: /plugin update.',
  doctorVersionUnknown: 'nieuwste onbekend',
  setupWired: 'Statusbalk aangesloten in settings.json.',
  setupAlreadyWired: 'Statusbalk al aangesloten — niets te doen.',
  setupBackedUp: (p) => `Vorige instellingen geback-upt naar ${p}.`,
  statsHeader: 'usage-limit-guard gebruiksstatistieken',
  statsNoData: 'nog geen gebruiksgegevens',
  statsReadings: (n) => `metingen: ${n}`,
  statsPeakFiveHour: (v) => `piek 5h: ${v}`,
  statsPeakSevenDay: (v) => `piek 7d: ${v}`,
  statsResets: (n) => `resets: ${n}`,
  // /limit-guard-legend (status line item legend), FORCE_HYPERLINK setup + doctor strings.
  legend: {
    header: 'legenda van de usage-limit-guard-statusregel',
    model: 'actief model',
    context: 'gebruikt contextvenster (groen onder 50 %, oranje onder 80 %, daarboven rood)',
    session: 'sessielimiet (5 u): gebruik en resettijd; oranje bij de limiet, rood bij de drempel',
    weekly: 'weeklimiet (7 d): gebruik en resettijd',
    pace: 'pijl: het gebruik loopt 10 of meer punten voor op de verstreken venstertijd',
    projection: 'geschatte tijd tot de drempel',
    project: 'projectmap',
    worktree: 'git worktree',
    scratch: 'tijdelijke map',
    docs: 'Details:',
  },
  legendOn: 'Legendamodus aan: de uitleg verschijnt in de band boven de prompt.',
  legendOff: 'Legendamodus uit.',
  setupHyperlinkSet: 'FORCE_HYPERLINK=1 ingesteld in settings.json (klikbare links ingeschakeld).',
  setupHyperlinkAlready: 'FORCE_HYPERLINK=1 is al ingesteld — niets te doen.',
  setupHyperlinkOptOut: 'FORCE_HYPERLINK=0 is bewust ingesteld — blijft ongewijzigd.',
  doctor_hyperlink: 'Windows Terminal: links zijn verborgen — voer /limit-guard-setup uit om FORCE_HYPERLINK=1 in te schakelen',
};
