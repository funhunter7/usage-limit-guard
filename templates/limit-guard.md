# Limit-guard instructions for this project

When usage-limit-guard reports the threshold was crossed, do this in order:

1. Finish the atomic step in progress — leave no half-done edit.
2. Write/update the handoff (`.claude/RESUME.md`): what is done, what remains,
   the current git branch, the files changed so far, the concrete next step to
   resume, and the time the limit resets.
3. (Optional) If this is a git repo, commit the work in progress to a branch.
4. Tell me the work is saved and I can shut down the PC.
5. Stop taking new tasks until the limit resets.

<!-- Adapt this procedure to the nature of the project. A Czech version is in limit-guard.cs.md. -->
