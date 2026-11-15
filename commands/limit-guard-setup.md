---
description: Auto-wire the claude-limit-guard status line into ~/.claude/settings.json (with a backup)
allowed-tools: Bash, AskUserQuestion
---

Communicate with the user exclusively in Czech.

The user wants the plugin to wire its status line into the global settings automatically, instead of
editing `~/.claude/settings.json` by hand. Run:

```
node "${CLAUDE_PLUGIN_ROOT}/bin/setup.mjs" "${CLAUDE_PLUGIN_ROOT}"
```

This sets `statusLine` in `~/.claude/settings.json` to run this plugin. Before overwriting, it saves a
backup next to the file (`settings.json.bak-limitguard`). If the status line is already wired, it
reports that and changes nothing. Other settings keys are preserved.

Report the command output to the user in plain Czech. Tell them the status line will appear after the
next Claude Code restart (or new session), and that the previous settings were backed up so the change
is reversible.

## Clickable links (Windows Terminal only)

After wiring, check whether to offer clickable links:

```
node "${CLAUDE_PLUGIN_ROOT}/bin/setup.mjs" --check-hyperlink
```

If it prints `skip`, say nothing more (`WT_SESSION` not set, i.e. not Windows Terminal, or `FORCE_HYPERLINK` is already `1`, or the
user set it to `0` on purpose). If it prints `ask`, the user runs Windows Terminal and `FORCE_HYPERLINK`
is not set. Use AskUserQuestion (in Czech) to ask whether to enable clickable
links. Explain that Claude Code hides terminal links in Windows Terminal unless `FORCE_HYPERLINK=1`
is set, that enabling it lets the project, worktree and scratch folders in the status line open on click, and that it applies to all links Claude Code prints (not only this plugin's). On "yes" run:

```
node "${CLAUDE_PLUGIN_ROOT}/bin/setup.mjs" "${CLAUDE_PLUGIN_ROOT}" --force-hyperlink
```

It sets `env.FORCE_HYPERLINK` to `"1"` in `~/.claude/settings.json` (with the same backup, idempotent).
Report the result in plain Czech and mention it applies after the next Claude Code restart. On "no"
do nothing.
