---
description: Explain every item of the claude-limit-guard status line, or switch legend mode (the explanation block in the band above the prompt) on or off
allowed-tools: Bash
argument-hint: "[on|off]"
---

Communicate with the user exclusively in Czech.

- If `$ARGUMENTS` is empty, run the legend command and show its output to the user:

```
node "${CLAUDE_PLUGIN_ROOT}/bin/legend.mjs"
```

The command prints one line per status line item: a sample as it looks in the user's terminal, then
what it means (model, context window bar, five-hour and weekly limit, the pace arrow, projection,
project, worktree and scratch folder). The last line links to the detailed legend page.

Report the output verbatim in a code block, then add one short sentence in Czech: `/limit-guard-legend on`
shows the same explanation as a block in the band above the prompt (and `off` hides it).

- If `$ARGUMENTS` is `on` or `off`, switch legend mode (an explanation block in the band above the prompt;
  the button `ⓘ popisky` there does the same):

```
node "${CLAUDE_PLUGIN_ROOT}/bin/legend.mjs" $ARGUMENTS
```

Report the one-line confirmation in plain Czech. The band picks the change up on its next redraw (a press of the button does it at once); it needs Claude Code 2.1.287 or newer.
