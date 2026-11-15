# Status line legend

Sample line (compact layout, terminal tier "full"):

```text
Opus 5.5 │ ▰▰▰▰▱▱▱▱▱▱ 42% │ 5h 84%↑ 20:08 │ 7d 25% Wed 09:00 │ 🏠 my-project │ 🔀 rule-fixes │ 📁 scratchpad
```

Each segment can be turned off in the options (`show_model`, `show_context`, `pace_arrow`, `show_paths`, `window_display`).
Segments with no data are left out. The same list is available as `/limit-guard-legend`;
`/limit-guard-legend on` shows the same explanation as a block in the band above the prompt (the
`ⓘ legend` button there does the same, instantly).

<a id="model"></a>
## Model

The model Claude Code is using right now (for example `Opus 5.5`). No color, nothing to act on.
It follows `/model` switches immediately.

<a id="context-window"></a>
## Context window

A 10-cell bar with the percentage of the context window used by this conversation.
Green below 50 %, amber below 80 %, red from 80 %. Nothing is shown until Claude Code reports a value
(early in a session or right after `/compact`). At red, run `/compact` or start a new session.

<a id="session-limit-5h"></a>
## Session limit (5h)

`5h 84%↑ 20:08`: how much of the 5-hour window you used, and when it resets (just the time on the same day,
weekday plus time otherwise). The percentage is green, amber from `warn_band` (default 80 %) and red from
`threshold` (default 95 %), where the guard saves a handoff. If it is red, wrap up or wait for the reset.
With `window_display: nearest` only the watched window closest to its threshold is shown. The arrow
is explained in [Pace arrow](#pace-arrow).

<a id="weekly-limit-7d"></a>
## Weekly limit (7d)

`7d 25% Wed 09:00`: the same for the 7-day window. `7dO` and `7dS` are the separate Opus and Sonnet weekly
windows (shown when you use those models). Colors and thresholds are the same as for the session limit.
A red weekly limit means you have to wait for the reset (or switch plan), so plan the big tasks.

<a id="pace-arrow"></a>
## Pace arrow

The `↑` (`^` in ascii terminals) after a percentage means usage is at least 10 points ahead of the time that has
passed in that window. Example: 5 % of the window time elapsed but 20 % used. It is a hint to slow down,
not an error. Turn it off with `pace_arrow: false`.

<a id="projection"></a>
## Projection

`📈 ~1h40m to 90%`: estimated time until the soonest-to-breach window reaches its threshold, based on the recent
usage trend. Shown only with `projection_display: on` and enough history. Treat it as a rough guess.

<a id="project"></a>
## Project

The name of the project folder (`workspace.project_dir`). Click to open it where links work.

<a id="worktree"></a>
## Worktree

`🔀 name`: shown only when the session runs in a linked git worktree. Click to open the worktree folder.

<a id="scratch-folder"></a>
## Scratch folder

`📁 scratchpad`: the scratch folder of this session, shown only when it exists and is not empty.
Claude Code's built-in scratchpad by default; set `scratch_dir` to use your own folder (relative to the project).

## Terminal tiers

The look follows what your terminal can draw (`style: auto`, or force `emoji` = full, `basic`, `ascii`):

| Tier | Where | Look |
|------|-------|------|
| full | Windows Terminal, iTerm2, WezTerm, VS Code, Kitty, Alacritty, ... | 256 colors, `▰▱` bar, `│` separator, `🔀`/`📁`, links |
| basic | tmux/screen, JetBrains, Konsole, Terminal.app, other Unix terminals | 16 colors, `█░` bar, `│`, no emoji, no links |
| ascii | legacy Windows console (cmd/PowerShell host), `TERM=dumb` | 16 colors, `[####------]` bar, `\|`, `^` arrow, no links |

`NO_COLOR` removes all colors. The bar glyphs can be changed with `bar_style`.

<a id="links-in-the-terminal"></a>
## Links in the terminal

Links work in the full tier. Windows Terminal: Claude Code hides terminal links unless `FORCE_HYPERLINK=1` is set
in its environment. `/limit-guard-setup` offers to add it to `settings.json` (`env`); it then applies to all links
Claude Code prints. Set `FORCE_HYPERLINK=0` to turn links off everywhere.
