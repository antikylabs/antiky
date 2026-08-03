---
description: Turn raw Antiky feedback and findings into objective tasks without implementing them
argument-hint: "[optional extra notes to triage alongside the inbox]"
---

# Triage the feedback inbox

Capture only. **Write no product code in this command** — if something looks like a two-minute
fix, it still becomes a task. The point is to empty your head onto the list and stop.

Inbox: @docs/objectives/01-FEEDBACK_H.txt
Task list: @docs/objectives/03-TODO_A.txt
Goals: @docs/objectives/00-GOALS_H_A.txt

Also triage this, if present: $ARGUMENTS

## What to do

**Only the lines below the `---` in `docs/objectives/01-FEEDBACK_H.txt` are feedback.** Everything above it is the
file's own instructions. If there is nothing below the rule, say so and stop — do not invent work,
and do not treat the header as a finding.

For each line below the rule:

1. Decide if it is a **defect** (something is wrong), a **request** (something is missing), or a
   **note** (an observation, praise, or an idea with no action). Notes get archived, not listed.
2. Check it against `docs/objectives/00-GOALS_H_A.txt` and `docs/VISION_DIRECTION_H.md`. Consult
   relevant `docs/adr/` and `docs/aip/` records when placement depends on architecture, and do not
   invent an answer where those human-owned sources are blank.
3. Write it as a todo.txt task matching the surrounding format:

   ```
   (A) 2026-08-03 Demo Town fails to compile through the framework +p1 @framework +fb fb:2026-08-03 ref:F13 vis:4.2 est:45m
   ```

   - `!` in the raw note → `(A)`. Otherwise `(B)`, or `(C)` if it is polish.
   - `+fb` and `fb:<today>` on everything from the inbox, so real-usage findings stay visible as a
     class.
   - Add `+p<N>` for the phase, `@ctx` for the area, `vis:N.N` for the direction section, and
     `ref:F##` if it matches evidence in either formal archive.

4. **Put the line in the band where it will actually be done.** `CHECKPOINT` lines cut the file
   into bands and `/session` only ever picks from the one it is in, so placement decides when the
   task happens. File it at the end of the band for its `+p<N>` phase. A `!`/`(A)` line goes at
   the front of the **live** band — the one above the first `CHECKPOINT` not marked `x ` — because
   that is what "blocking" means here. Never park a task at the top of the file: everything above
   the first checkpoint gates that checkpoint, so an app-icon task landing there holds up the
   editor. That happened, and it is why this step exists.
5. If it duplicates an open task, do not add a second one — say which task already covers it.
6. If it contradicts `docs/VISION_DIRECTION_H.md`, say so rather than silently
   rewriting the vision. That is a decision for the user.

Then:

- Append the **raw, unedited lines** to `docs/objectives/05-ARCHIVE-FEEDBACK_A.txt` under a `## <today>` heading
  (`date +%F`). Their words, not your summary — the raw complaint is the evidence.
- Reset `docs/objectives/01-FEEDBACK_H.txt` to its header and the `---`.
- Then triage `docs/objectives/02-AGENT-FINDINGS_A.txt` the same way, tagging those `+found
found:<today>`. Append its raw, unedited lines to
  `docs/objectives/06-ARCHIVE-FINDINGS_A.txt`, then reset its inbox to the header and `---`. It is
  the agent's own queue; human feedback is triaged first and outranks it. Never write findings
  into `docs/objectives/01-FEEDBACK_H.txt` — keeping the human archive purely human is what makes
  it evidence.
- Commit: `Triage feedback into tasks`.

## Report back

A short list: what became a task and at what priority, what was already covered, what you read as
a note rather than an action. Then the count of open `(A)` tasks, so the user can see if the
blocking pile is growing.
