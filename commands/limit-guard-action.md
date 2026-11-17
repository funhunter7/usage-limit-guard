---
description: Set or clear the usage-limit-guard guard action or warn action (globally or for this project)
allowed-tools: AskUserQuestion, Bash
---

You are configuring **guard actions** for the `usage-limit-guard` plugin.

Reply in the user's language (the language they write in); translate any option labels and explanations below into it.

There are two action types:
- **guard action** (`guard_action`) — instruction the assistant follows when the threshold is reached (blocks).
- **warn action** (`warn_action`) — gentle notice appended to context when utilization is in the warn band
  (below threshold, non-blocking).

Steps:

1. Use **AskUserQuestion** to ask what the user wants to configure. Offer these options:
   - **Guard action — global** — set the guard action for all projects.
   - **Guard action — project** — set it only for the current project.
   - **Warn action — global** — set the warn action for all projects.
   - **Warn action — project** — set it only for the current project.
   - **Clear** — remove an action (back to the built-in behaviour).

2. If the user chose **Clear**, use AskUserQuestion to ask:
   - Which type to clear: **guard** or **warn**.
   - Which scope: **global** or **project**.

   Then run one of:
   - `node "${CLAUDE_PLUGIN_ROOT}/bin/guard.mjs" --scope global  --action clear --kind guard`
   - `node "${CLAUDE_PLUGIN_ROOT}/bin/guard.mjs" --scope project --action clear --kind guard`
   - `node "${CLAUDE_PLUGIN_ROOT}/bin/guard.mjs" --scope global  --action clear --kind warn`
   - `node "${CLAUDE_PLUGIN_ROOT}/bin/guard.mjs" --scope project --action clear --kind warn`

3. For set operations, ask the user for the action text, then run (Bash), pasting the text
   verbatim between the heredoc lines. The delimiter MUST stay quoted (`'LG_EOF'`): that keeps
   quotes, backticks and `$(...)` in the text from being interpreted by the shell. Never put
   the text on the command line.

   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/guard.mjs" --scope <scope> --action set --value-stdin --kind <kind> <<'LG_EOF'
   <text>
   LG_EOF
   ```
   where `<scope>` is `global|project` and `<kind>` is `guard|warn`. If the text itself contains a
   line `LG_EOF`, pick another delimiter.

   The command runs in the current project directory, so project scope writes to the
   right `.claude/limit-guard.json`.

4. Report the helper's output to the user and remind them of the precedence:
   **per-project file > /config option (global) > built-in default**.

Never edit the JSON files by hand — always go through `bin/guard.mjs` so writes are
validated and other keys are preserved.
