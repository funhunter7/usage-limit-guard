---
description: Pick claude-limit-guard settings from a list instead of typing them (global or per-project)
allowed-tools: AskUserQuestion, Bash
---

You are configuring the `claude-limit-guard` plugin. Claude Code's `/config` dialog has no
pick-from-list (enum) inputs, so this command lets the user **choose** values from menus
and writes them through the validated helper — never hand-edit JSON.

Reply in the user's language (the language they write in); translate any option labels and explanations below into it.

Steps:

1. Use **AskUserQuestion** to ask which setting to change. Offer:
   - **Threshold (%)** → option `threshold` (number 0–100; the guard fires at/above it).
   - **Warn band (%)** → option `warn_band` (number 0–100; status line turns amber).
   - **Watched limits** → option `watch` (which limit windows to show/guard).
   - **Time format** → option `time_format` (status-line reset time).
   - **Status line style** → option `style` (glyphs).

   (Note: weekday/date language and message language follow the OS automatically and are
   intentionally not configurable here.)

2. Use **AskUserQuestion** to ask the scope:
   - **Global** — all projects (writes `~/.claude/settings.json`).
   - **Project** — only the current project (writes `.claude/limit-guard.json`).

3. Ask for the value of the chosen setting:
   - `time_format` → AskUserQuestion with options **system** (follow the OS), **12**, **24**.
   - `style` → AskUserQuestion with options **auto** (detect the terminal), **emoji**, **ascii**.
   - `watch` → first offer **auto** (model-aware default: 5h + weekly + any per-model weekly
     window in use). If the user instead wants to pin windows, AskUserQuestion with
     **multiSelect: true** offering **five_hour**, **seven_day**, **seven_day_opus**,
     **seven_day_sonnet**; join the chosen keys with a comma (e.g. `five_hour,seven_day`).
     Pass the literal value `auto` to use the model-aware mode.
   - `threshold` / `warn_band` → a plain prompt for a whole number 0–100.

4. Run, substituting `<scope>` (global|project), `<option>` (the option name from step 1),
   and `<value>`:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/config.mjs" --scope <scope> --option <option> --value-stdin <<'LG_EOF'
   <value>
   LG_EOF
   ```
   The value goes in through a quoted heredoc (keep `'LG_EOF'` quoted), never on the command line,
   so no character in it can be interpreted by the shell.

   The command runs in the current project directory, so project scope writes to the right
   `.claude/limit-guard.json`. The helper validates the value and prints `OK: ...` or
   `ERROR: ...`; if it errors, report the message and offer to try again.

5. Report the helper's output to the user and remind them of the precedence:
   **per-project file > /config option (global) > built-in default**.

Never edit the JSON files by hand — always go through `bin/config.mjs` so writes are
validated and other keys are preserved.
