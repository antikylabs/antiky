---
name: zd-session
description: Run one Antiky development session from formal-objective feedback triage through one scoped task, verification, commit, and completion. Use when the user asks to run an Antiky session, continue with the next objective task, execute a session id such as 1.3, or implement a task from docs/objectives/03-TODO_A.txt according to the repository workflow.
---

# Run an Antiky session

Treat `.claude/commands/session.md` as the canonical workflow. Read it completely at the start of every invocation, then follow it exactly.

Apply these Codex translations while following the file:

- Treat text supplied with `$zd-session` as `$ARGUMENTS`. With no supplied text, use an empty value.
- Treat `@path` references as instructions to read that repository-relative file when the workflow calls for it.
- Use the available task-plan tool wherever the workflow says `TaskCreate`, and keep the plan current throughout the session.
- Translate command references for the user as `/session` to `$zd-session`, `/triage` to `$zd-triage`, `/status` to `$zd-status`, and `/archive` to `$zd-archive`.

Keep the session boundary strict: one selected goal and one product commit, aside from the workflow's separately required triage commit. Do not continue past a checkpoint or absorb unrelated findings.
