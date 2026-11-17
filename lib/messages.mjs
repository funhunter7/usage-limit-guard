// Thin re-export: the message catalog now lives in ./messages/ as per-language modules.
// Existing imports of `getMessages` from './messages.mjs' keep working unchanged.
export { getMessages } from './messages/index.mjs';

// The built-in guard routines end with "follow .claude/limit-guard.md if it exists": a pointer to a
// project file the model would obey. Untrusted unless allow_project_actions is on, so drop that
// sentence (in any locale) from the default text. shortcut: sentence = text up to ". " or "。";
// a handoff path containing ". " would split early, upgrade to per-locale templates if that matters.
export function withoutProjectMdHint(text) {
  return text.split(/(?<=。)|(?<=\.)(?=\s)/).filter((s) => !s.includes('limit-guard.md')).join('').trim();
}
