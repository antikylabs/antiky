---
name: zd-triage
description: Triage raw Antiky human feedback and agent findings into prioritized tasks in docs/objectives/03-TODO_A.txt without implementing product work. Use when the user asks to triage Antiky feedback, process the formal objective inboxes, empty either inbox, or capture extra notes into the task plan.
---

# Triage Antiky feedback

Treat `.claude/commands/triage.md` as the canonical workflow. Read it completely at the start of every invocation, then follow it exactly.

Apply these Codex translations while following the file:

- Treat text supplied with `$zd-triage` as `$ARGUMENTS`. With no supplied text, use an empty value.
- Treat `@path` references as instructions to read that repository-relative file when the workflow calls for it.
- Use the available task-plan tool to track the triage steps and keep it current.
- Translate command references for the user as `/triage` to `$zd-triage`, `/status` to `$zd-status`, and `/archive` to `$zd-archive`.

Preserve the capture-only boundary. Do not implement any task discovered during triage.
