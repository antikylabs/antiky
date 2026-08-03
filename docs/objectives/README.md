# Antiky objectives

This folder is the system of record for the Antiky agent loop. It turns human direction and raw
feedback into small, checkpoint-bounded sessions without mixing human evidence, agent findings,
or script output.

Before planning or implementing work, read:

- [`../VISION_DIRECTION_H.md`](../VISION_DIRECTION_H.md) for human-owned product direction.
- [`../GOOD_ENGINEERING_H.md`](../GOOD_ENGINEERING_H.md) before making design or architecture
  decisions.
- [`../README.md`](../README.md) for document ownership.
- Relevant records in [`../adr`](../adr/README.md) and [`../aip`](../aip/README.md). A blank record
  is missing direction, not permission for an agent to invent it.

## Files

| File                                                     | Owner         | Purpose                                                               |
| -------------------------------------------------------- | ------------- | --------------------------------------------------------------------- |
| [`00-GOALS_H_A.txt`](00-GOALS_H_A.txt)                   | Human + agent | High-level objectives and the gut check for task creation.            |
| [`01-FEEDBACK_H.txt`](01-FEEDBACK_H.txt)                 | Human         | Raw human feedback below `---`; agents never write here.              |
| [`02-AGENT-FINDINGS_A.txt`](02-AGENT-FINDINGS_A.txt)     | Agent         | Out-of-scope findings captured during a session.                      |
| [`03-TODO_A.txt`](03-TODO_A.txt)                         | Agent         | Ordered task bands and checkpoints consumed by sessions and `zdloop`. |
| [`04-AGENT-SESSIONS_A.txt`](04-AGENT-SESSIONS_A.txt)     | Agent         | Durable session handoffs appended by `zdloop`.                        |
| [`05-ARCHIVE-FEEDBACK_A.txt`](05-ARCHIVE-FEEDBACK_A.txt) | Agent         | Human feedback archived verbatim during triage.                       |
| [`06-ARCHIVE-FINDINGS_A.txt`](06-ARCHIVE-FINDINGS_A.txt) | Agent         | Agent findings archived verbatim during triage.                       |
| [`07-DONE_S.txt`](07-DONE_S.txt)                         | Script        | Completed task lines moved by `npm run zdarchive`.                    |
| [`08-REPORT_S.txt`](08-REPORT_S.txt)                     | Script        | Reports produced by the configured todo.txt tooling.                  |
| [`todo.cfg`](todo.cfg)                                   | Script config | Makes todo.txt CLI commands use the formal filenames from any cwd.    |

## Commands

Claude Code uses `/status`, `/session`, `/triage`, and `/archive` from `.claude/commands/`.
Codex uses the matching `$zd-status`, `$zd-session`, `$zd-triage`, and `$zd-archive` project skills
from `.agents/skills/`.

The deterministic root commands are:

```sh
npm run zdloop -- 60s
npm run zdloop -- 60s --dry-run
npm run zdarchive
npm run test:zdloop
todo.sh -d docs/objectives/todo.cfg ls
```

`CHECKPOINT` lines divide the task list into bands. A session takes only the first open task above
the first open checkpoint. Reaching the checkpoint means stop, review or use the result, and wait
for a human to mark the checkpoint complete. The initial checkpoint intentionally guards the blank
human-owned direction and architecture placeholders; seed the first implementation band only after
that direction is ready.

Task lines use todo.txt-compatible plain text: one task per line, `(A)` through `(C)` priority,
`+pN` phase, `@area`, `sess:N.N`, `est:Nm`, optional `vis:N.N`, and optional evidence tags. A
completed line keeps all of that text and gains `x <date>` at the front.
