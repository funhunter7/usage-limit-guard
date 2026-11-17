---
description: Run a claude-limit-guard self-check (Node version, token, status-line, cache, plugin version)
allowed-tools: Bash
---

Reply in the user's language (the language they write in); translate any option labels and explanations below into it.

Run the self-check and show its output to the user:

```
node "${CLAUDE_PLUGIN_ROOT}/bin/doctor.mjs"
```

The command prints a localized report with one line per check: Node version (≥ 18), whether the OAuth
token is present, whether the status-line is wired (and its script still exists), whether the usage cache is fresh, and how the
installed plugin version compares to the latest GitHub release. A ✅ means the check passed; a ❌ is
followed by an indented hint on how to fix it. In Windows Terminal without `FORCE_HYPERLINK=1` there is also an ℹ️ info line (not a failure): the status line links are hidden; mention that `/limit-guard-setup` can enable them.
The version line is informational (it never fails when
the latest release can't be fetched, e.g. offline).

Report the output to the user and, for any ❌, explain the suggested fix in plain words in the user's language.
