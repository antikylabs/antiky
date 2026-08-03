---
description: Run one Antiky session — triage feedback, do the next task, test it, commit it
argument-hint: "[session id like 1.3, or task text, or empty for the next open task]"
---

# Run one Antiky session

One session = **one goal, one commit, 30–60 minutes.** Not a sprint. Not "and while I'm here".

Current task list: @docs/objectives/03-TODO_A.txt
Feedback inbox: @docs/objectives/01-FEEDBACK_H.txt
High-level goals: @docs/objectives/00-GOALS_H_A.txt
Engineering rules: @docs/GOOD_ENGINEERING_H.md

The product direction is `docs/VISION_DIRECTION_H.md`. Read the task's `vis:N.N` section when one
is present. Before making an architectural decision, read `docs/GOOD_ENGINEERING_H.md`, the docs
ownership rules in `docs/README.md`, and the relevant records in `docs/adr/` and `docs/aip/`.
Blank records are missing direction, not permission to invent it.

Requested: **$ARGUMENTS** (empty means "the next open task").

---

## 1. Triage the inbox first

**Only the lines below the `---` in `docs/objectives/01-FEEDBACK_H.txt` are feedback** — everything above it is the
file's own instructions. If there is nothing below the rule, skip straight to step 2.

Otherwise triage before picking up new work. Real usage outranks the plan.

- Each line becomes a todo.txt task in the same format as the existing ones.
- A leading `!` means blocking → priority `(A)`, and the line goes at the **front of the live
  band** (step 2), which is what makes it this session's next task. Everything else is filed into
  the band for its own phase.
- Tag them `+fb fb:<today>` so feedback-driven work is distinguishable from planned work.
- Attach `@ctx`, `ref:F##`, and `vis:N.N` tags where you can tell.
- Then append the **raw, unedited lines** to `docs/objectives/05-ARCHIVE-FEEDBACK_A.txt` under a `## <today>`
  heading, and reset `docs/objectives/01-FEEDBACK_H.txt` to just its header and the `---`.

Preserve the user's own words in the archive. Do not "clean up" their phrasing — the raw
complaint is the evidence, your task line is the interpretation.

Then do the same for `docs/objectives/02-AGENT-FINDINGS_A.txt`, the agent's own queue, tagging those `+found
found:<today>` instead. Append its raw lines to `docs/objectives/06-ARCHIVE-FINDINGS_A.txt`, then
reset the findings queue to its header and `---`. Human feedback is triaged first and outranks it.

Commit the triage on its own: `Triage feedback into tasks`.

## 2. Pick exactly one task

`CHECKPOINT` lines cut the plan into **bands**. The **live band** is every line above the first
`CHECKPOINT` that is not itself marked `x `. That band is the whole world for this session.
Nothing below that checkpoint is a candidate — not an `(A)`, not a blocking `!`, not something
that looks quicker.

- If `$ARGUMENTS` names a session id (`1.3`), take that session's tasks — they're designed to fit
  one sitting together. If it's free text, match it against task subjects. An explicit request
  outranks the band; say if it reaches past a checkpoint, then do it.
- If empty, take the **first open task in the live band, in file order**. Open means the line does
  **not** start with `x `. File order _is_ the plan — phase 2 alone records three deliberate
  re-sequencings and the reasoning for each. The `(A)`/`(B)` and `+pN` tags describe a task, they
  do not re-sort the band it sits in.

**A task you cannot do is a written decision, not a skip.** Append to its line, in the surrounding
style, what blocks it and what would unblock it. Commit that, then take the next line in the band.
The next session then reads the reasoning instead of re-deriving it, and a skip nobody wrote down
is indistinguishable from one nobody noticed.

**Skipping buys you nothing.** If every task in the live band is done or blocked, the session
**ends there**. You do not reach past the checkpoint for easier work — that is the exact move that
lets a checkpoint arrive with open tasks still above it, which is the one thing a checkpoint
exists to prevent. Name the blocked tasks and what each waits on, and hand it back. A fully
blocked band is real information about the plan, and acting on it is the user's call.

**A `CHECKPOINT` line is not work.** You only reach one with the band above it empty, and that
means it is time to go use the app for a while. Say so and stop. Do not implement past it. When
the user comes back and says it's passed, mark the checkpoint line `x <today>` like any other
line — that is what moves the live band to the next one.

State the task and its `est:` before you start. If the estimate is over 60 minutes, split the task
in `docs/objectives/03-TODO_A.txt` first and take the first half.

## 3. Plan it

Use TaskCreate to lay out the steps, and keep it updated as you go. This is the project
convention and it's also how the user follows along.

Read the `vis:N.N` section of the direction document. If the task has a `ref:F##`, read the matching
evidence in `docs/objectives/05-ARCHIVE-FEEDBACK_A.txt` or
`docs/objectives/06-ARCHIVE-FINDINGS_A.txt` before rebuilding it.

## 4. Do the work

- **Bug fixes are red-first.** Write the failing test, run it, watch it fail, then fix it. A fix
  without a test that failed first is not done.
- Follow `docs/GOOD_ENGINEERING_H.md`: compare two meaningful designs, choose the simpler deep
  boundary, and do not abstract before the code shows a real seam.
- Treat `_H` files as human-owned, `_A` files as agent-owned, and `_S` files as script-owned as
  defined in `docs/README.md`. Do not silently rewrite human direction.
- For work larger than a small fix, follow `CONTRIBUTING.md` and write or use an AIP before product
  implementation. Record accepted architectural decisions as ADRs; do not fill blank records with
  guessed policy.
- Validate external input at trust boundaries, pin dependencies, and never put secrets in code,
  logs, fixtures, or objective files.
- 500 lines is a warning, not a wall — when a file trips it, split at the nearest seam **in this
  session**, before committing.

## 5. Verify

Run the smallest sufficient thing. In rough order of cost:

```sh
npm test                          # unit — should stay under ~5s
npm run check                     # typecheck + unit
npm run build                     # integration/build claims, end of a session
```

Do not run the full ladder after every edit. Do not add packaging, signing, coverage thresholds,
or release machinery before the objective calls for them.

**A catastrophic result is the one you re-run before believing.** A few focused failures are
evidence. A mass failure can also mean the harness is broken, so reproduce it once before changing
product code.

If it does not reproduce, **say so and leave the cause open**. The temptation is to file the most
plausible story, and a story with a date on it reads as a finding forever after. Write down what
you tried and what you could not make happen.

If something is red at 60 minutes, cut scope and commit what genuinely works. Say what you cut.

## 6. Commit and tick it off

One commit. Short one-line message, imperative, no body, no co-author trailers.

Then mark the task done in `docs/objectives/03-TODO_A.txt` by prefixing the line with `x ` and today's date
(`date +%F`), leaving the rest of the line untouched:

```
x 2026-08-03 (A) 2026-08-03 Compile the first Demo Town slice through the framework +p1 @framework sess:1.2 est:45m vis:4
```

Completed tasks stay in the file — it's the session log. `grep -v '^x '` is the open list.

**Edit that file with an exact-match replace that fails when the anchor does not match.** Never a
script that computes offsets — it will happily write whatever it computed. This has damaged the
plan twice: once writing one task line over another's subject, once truncating the file from 102
lines to 37. Both were recovered with `git checkout` only because the file was already committed.
Everything else in the repo can be re-derived from the code and the history; this file is the only
record of _why_, and of what was tried and abandoned.

## 7. Hand it back

End with, briefly:

1. What now works that didn't before.
2. **Exactly what to look at** — the command to run and what to check on screen. This is the part
   that closes the loop, because the user's reaction becomes the next triage.
3. What you deliberately did not do.
4. What's next in `docs/objectives/03-TODO_A.txt`.

## Rules that override your defaults

These are the Antiky loop boundaries; `docs/GOOD_ENGINEERING_H.md` governs design decisions:

- **No subagent fanout.** Zero, or one if a search is genuinely wide. Not five.
- **New problems you notice go in `docs/objectives/02-AGENT-FINDINGS_A.txt`, not into this session.** The only
  exceptions are data loss, a crash, or a security hole. Scope that grows mid-session never
  converges. **Never write to `docs/objectives/01-FEEDBACK_H.txt`** — that inbox is the human's, and the value of
  `docs/objectives/05-ARCHIVE-FEEDBACK_A.txt` as evidence depends on it holding only their words.
- **Never run this under a loop with no terminal condition.** `npm run zdloop -- 60s` for Codex, or
  `/loop 60s /session until you reach the next checkpoint` for Claude Code, are the intended forms.
  The terminal condition is an open `CHECKPOINT` in `docs/objectives/03-TODO_A.txt`. Sessions and
  loop runs are meant to end.
- **Leave the 60-second gap between sessions.** It starts when a session finishes and the next one
  starts after it. Do not close it and do not fill it with work: it exists so the handoff above is
  readable and so there is a moment, with the tree clean and nothing half-done, when the user can
  stop the run.
- If you disagree with the task, say so in a sentence and do it anyway, or stop and ask. Do not
  silently substitute a different task.
