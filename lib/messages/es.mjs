// Spanish (es) — best-effort translation, reviewed 2026-06; placeholders identical to en.mjs.
export default {
  signIn: 'inicia sesión',
  relIn: 'en',
  toThreshold: 'hasta',
  labels: { five_hour: 'Límite de sesión:', seven_day: 'Límite semanal:', seven_day_opus: 'Semana Opus:', seven_day_sonnet: 'Semana Sonnet:' },
  labelsShort: { five_hour: '5h', seven_day: '7d', seven_day_opus: '7dO', seven_day_sonnet: '7dS' },
  statusHeader: 'estado de usage-limit-guard',
  statusConfig: 'Configuración',
  statusHealth: 'Salud',
  statusTokenOk: 'token: ok',
  statusTokenMissing: 'token: falta',
  statusCacheFresh: (secs) => `caché: hace ${secs}s`,
  statusCacheNone: 'caché: sin caché',
  statusLineWired: 'línea de estado: conectada',
  statusLineNotWired: 'línea de estado: no conectada',
  statusHistoryReadings: (n) => `historial: ${n} lecturas`,
  statusHistoryNone: 'historial: sin datos',
  statusGuardActionDefault: 'predeterminado',
  contextLabel: (line, threshold) =>
    `Límite de suscripción (usage-limit-guard): ${line}. Umbral ${threshold}%.`,
  breach: (breached, action) => `UMBRAL SUPERADO (${breached}). ${action}`,
  contextAction: (handoff) =>
    `Ejecuta la rutina de guard: termina el paso atómico actual, guarda un traspaso en ${handoff} ` +
    `(qué está hecho, qué queda, la rama git actual, los archivos cambiados hasta ahora, el siguiente ` +
    `paso concreto para retomar, hora de reinicio), dile al usuario que puede apagar el PC y deja de ` +
    `aceptar tareas nuevas. Si existe .claude/limit-guard.md, síguelo.`,
  stopAction: (handoff) =>
    `No pares todavía — ejecuta la rutina de guard: termina el paso atómico actual, luego guarda un ` +
    `traspaso en ${handoff} que registre la rama git actual, los archivos cambiados hasta ahora y el ` +
    `siguiente paso concreto para retomar. Dile al usuario que puede apagar el PC. Sigue ` +
    `.claude/limit-guard.md si existe.`,
  stopReason: (threshold, breached, action) =>
    `usage-limit-guard: límite sobre el umbral ${threshold}% (${breached}). ${action}`,
  resume: (handoff) =>
    `Se encontró el archivo de traspaso ${handoff} de un trabajo anterior interrumpido por un límite ` +
    `de uso. Ofrece retomar y léelo como contexto inicial.`,
  warnAction: 'Termina tu paso actual limpiamente — se acerca un límite de uso.',
  warn: (warned, action) => `LÍMITE CERCANO (${warned}). ${action}`,
  notifyTitle: 'usage-limit-guard',
  notifyWarn: (window) => `Se acerca el límite ${window}.`,
  notifyBreach: (window) => `Umbral superado en ${window} — hora de terminar.`,
  notifyReset: (window) => `Tu límite ${window} se ha reiniciado — puedes continuar.`,
  snoozeSet: (u) => `Guardia en pausa hasta ${u}.`,
  snoozeCleared: 'Pausa cancelada.',
  snoozeNone: 'No hay pausa activa.',
  doctorHeader: 'autodiagnóstico de usage-limit-guard',
  doctor_node: 'Node ≥ 18',
  doctor_token: 'token OAuth',
  doctor_statusline: 'línea de estado conectada',
  doctor_cache: 'caché de uso reciente',
  doctor_version: 'versión del plugin',
  doctorHint_node: 'Actualiza Node a la v18 o posterior.',
  doctorHint_token: 'Inicia sesión en Claude Code.',
  doctorHint_statusline: 'Ejecuta /limit-guard-setup para conectar la línea de estado.',
  doctorHint_cache: 'Abre una sesión de Claude Code para que la línea de estado actualice la caché.',
  doctorHint_version: 'Actualiza el plugin: /plugin update.',
  doctorVersionUnknown: 'última desconocida',
  setupWired: 'Línea de estado conectada en settings.json.',
  setupAlreadyWired: 'La línea de estado ya está conectada — nada que hacer.',
  setupBackedUp: (p) => `Configuración anterior respaldada en ${p}.`,
  statsHeader: 'estadísticas de uso de usage-limit-guard',
  statsNoData: 'aún no hay datos de uso',
  statsReadings: (n) => `lecturas: ${n}`,
  statsPeakFiveHour: (v) => `pico 5h: ${v}`,
  statsPeakSevenDay: (v) => `pico 7d: ${v}`,
  statsResets: (n) => `reinicios: ${n}`,
  // /limit-guard-legend (status line item legend), FORCE_HYPERLINK setup + doctor strings.
  legend: {
    header: 'leyenda de la línea de estado de usage-limit-guard',
    model: 'modelo activo',
    context: 'ventana de contexto usada (verde por debajo del 50 %, ámbar por debajo del 80 %, rojo por encima)',
    session: 'límite de sesión (5 h): uso y hora de reinicio; ámbar cerca del límite, rojo en el umbral',
    weekly: 'límite semanal (7 d): uso y hora de reinicio',
    pace: 'flecha: el uso va 10 o más puntos por delante del tiempo transcurrido de la ventana',
    projection: 'tiempo estimado hasta el umbral',
    project: 'carpeta del proyecto',
    worktree: 'git worktree',
    scratch: 'carpeta temporal',
    docs: 'Detalles:',
  },
  legendOn: 'Modo leyenda activado: la explicación aparece en la banda sobre el prompt.',
  legendOff: 'Modo leyenda desactivado.',
  setupHyperlinkSet: 'FORCE_HYPERLINK=1 establecido en settings.json (enlaces clicables activados).',
  setupHyperlinkAlready: 'FORCE_HYPERLINK=1 ya está establecido — nada que hacer.',
  setupHyperlinkOptOut: 'FORCE_HYPERLINK=0 está definido a propósito — se deja sin cambios.',
  doctor_hyperlink: 'Windows Terminal: los enlaces están ocultos — ejecuta /limit-guard-setup para activar FORCE_HYPERLINK=1',
};
