// German (de) — best-effort translation, reviewed 2026-06; placeholders identical to en.mjs.
export default {
  signIn: 'anmelden',
  relIn: 'in',
  toThreshold: 'bis',
  labels: { five_hour: 'Sitzungslimit:', seven_day: 'Wochenlimit:', seven_day_opus: 'Woche Opus:', seven_day_sonnet: 'Woche Sonnet:' },
  labelsShort: { five_hour: '5h', seven_day: '7T', seven_day_opus: '7TO', seven_day_sonnet: '7TS' },
  statusHeader: 'usage-limit-guard Status',
  statusConfig: 'Konfiguration',
  statusHealth: 'Zustand',
  statusTokenOk: 'Token: ok',
  statusTokenMissing: 'Token: fehlt',
  statusCacheFresh: (secs) => `Cache: vor ${secs}s`,
  statusCacheNone: 'Cache: kein Cache',
  statusLineWired: 'Statusleiste: eingerichtet',
  statusLineNotWired: 'Statusleiste: nicht eingerichtet',
  statusHistoryReadings: (n) => `Verlauf: ${n} Messungen`,
  statusHistoryNone: 'Verlauf: keine Daten',
  statusGuardActionDefault: 'Standard',
  contextLabel: (line, threshold) =>
    `Abonnementlimit (usage-limit-guard): ${line}. Schwelle ${threshold}%.`,
  breach: (breached, action) => `SCHWELLE ÜBERSCHRITTEN (${breached}). ${action}`,
  contextAction: (handoff) =>
    `Führe die Guard-Routine aus: beende den aktuellen atomaren Schritt, speichere eine Übergabe ` +
    `nach ${handoff} (was erledigt ist, was bleibt, der aktuelle git-Branch, die bisher geänderten ` +
    `Dateien, der konkrete nächste Schritt zum Fortsetzen, Reset-Zeit), sage dem Nutzer, dass er den ` +
    `PC herunterfahren kann, und nimm keine neuen Aufgaben an. Wenn .claude/limit-guard.md existiert, folge ihr.`,
  stopAction: (handoff) =>
    `Noch nicht aufhören — führe die Guard-Routine aus: beende den aktuellen atomaren Schritt, speichere ` +
    `dann eine Übergabe nach ${handoff}, die den aktuellen git-Branch, die bisher geänderten Dateien und ` +
    `den konkreten nächsten Schritt zum Fortsetzen festhält. Sage dem Nutzer, dass er den PC herunterfahren ` +
    `kann. Folge .claude/limit-guard.md, falls vorhanden.`,
  stopReason: (threshold, breached, action) =>
    `usage-limit-guard: Limit über Schwelle ${threshold}% (${breached}). ${action}`,
  resume: (handoff) =>
    `Übergabedatei ${handoff} aus früherer, durch ein Nutzungslimit unterbrochener Arbeit gefunden. ` +
    `Biete an fortzusetzen und lies sie als Ausgangskontext.`,
  warnAction: 'Beende deinen aktuellen Schritt sauber — ein Nutzungslimit naht.',
  warn: (warned, action) => `LIMIT NÄHERT SICH (${warned}). ${action}`,
  notifyTitle: 'usage-limit-guard',
  notifyWarn: (window) => `Limit ${window} naht.`,
  notifyBreach: (window) => `Schwelle bei ${window} überschritten — Zeit zum Abschließen.`,
  notifyReset: (window) => `Limit ${window} wurde zurückgesetzt — du kannst wieder loslegen.`,
  snoozeSet: (u) => `Wächter pausiert bis ${u}.`,
  snoozeCleared: 'Pause aufgehoben.',
  snoozeNone: 'Keine aktive Pause.',
  doctorHeader: 'usage-limit-guard Selbsttest',
  doctor_node: 'Node ≥ 18',
  doctor_token: 'OAuth-Token',
  doctor_statusline: 'Statusleiste eingerichtet',
  doctor_cache: 'Nutzungs-Cache aktuell',
  doctor_version: 'Plugin-Version',
  doctorHint_node: 'Aktualisiere Node auf v18 oder neuer.',
  doctorHint_token: 'Melde dich in Claude Code an.',
  doctorHint_statusline: 'Führe /limit-guard-setup aus, um die Statusleiste einzurichten.',
  doctorHint_cache: 'Öffne eine Claude-Code-Sitzung, damit die Statusleiste den Cache aktualisiert.',
  doctorHint_version: 'Aktualisiere das Plugin: /plugin update.',
  doctorVersionUnknown: 'neueste unbekannt',
  setupWired: 'Statusleiste in settings.json eingerichtet.',
  setupAlreadyWired: 'Statusleiste bereits eingerichtet — nichts zu tun.',
  setupBackedUp: (p) => `Vorherige Einstellungen gesichert nach ${p}.`,
  statsHeader: 'usage-limit-guard Nutzungsstatistik',
  statsNoData: 'noch keine Nutzungsdaten erfasst',
  statsReadings: (n) => `Messungen: ${n}`,
  statsPeakFiveHour: (v) => `Spitze 5h: ${v}`,
  statsPeakSevenDay: (v) => `Spitze 7T: ${v}`,
  statsResets: (n) => `Resets: ${n}`,
  // /limit-guard-legend (status line item legend), FORCE_HYPERLINK setup + doctor strings.
  legend: {
    header: 'Legende der usage-limit-guard-Statuszeile',
    model: 'aktives Modell',
    context: 'belegtes Kontextfenster (grün unter 50 %, gelb unter 80 %, darüber rot)',
    session: 'Sitzungslimit (5 h): Verbrauch und Reset-Zeit; gelb nahe am Limit, rot ab der Schwelle',
    weekly: 'Wochenlimit (7 d): Verbrauch und Reset-Zeit',
    pace: 'Pfeil: Verbrauch liegt 10 oder mehr Punkte vor der verstrichenen Fensterzeit',
    projection: 'geschätzte Zeit bis zur Schwelle',
    project: 'Projektordner',
    worktree: 'Git-Worktree',
    scratch: 'Scratch-Ordner',
    docs: 'Details:',
  },
  legendOn: 'Legendenmodus an: die Erklärung erscheint im Band über dem Prompt.',
  legendOff: 'Legendenmodus aus.',
  setupHyperlinkSet: 'FORCE_HYPERLINK=1 in settings.json gesetzt (klickbare Links aktiviert).',
  setupHyperlinkAlready: 'FORCE_HYPERLINK=1 ist bereits gesetzt — nichts zu tun.',
  setupHyperlinkOptOut: 'FORCE_HYPERLINK=0 ist absichtlich gesetzt — bleibt unverändert.',
  doctor_hyperlink: 'Windows Terminal: Links sind ausgeblendet — /limit-guard-setup ausführen, um FORCE_HYPERLINK=1 zu aktivieren',
};
