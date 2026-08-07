# Studio Slice 00 feedback implementation order

## Control

| Field | Value |
| --- | --- |
| Status | `READY` |
| Scope | [Slice 00 feedback, lines 1 through 9](slice-feedback.txt) |
| Priority | Feedback 08 and Feedback 09 run before the project-workflow feedback |
| Alignment revision | `0cf02f51dff72f0c22681cb5a3af890173c32b00` |
| Review date | `2026-08-06` |

## Outcome

Implement the feedback in a sequence that honors the owner's visual priorities and preserves clear
ownership boundaries. Complete one feedback plan and its evidence before the next dependent plan starts.

## Recommended sequence

| Order | Feedback | Start gate | Reason for this position |
| --- | --- | --- | --- |
| 1 | [08: Match the website layout](feedback-08-website-layout-plan.md) | Complete | The owner approved the website-derived workspace; the unavailable browser capture remains a recorded evidence limitation. |
| 2 | [09: Theme the embedded terminal](feedback-09-terminal-theme-plan.md) | Ready now; Feedback 08 complete | It is the second owner priority. It uses the terminal panel geometry and chrome established by Feedback 08. |
| 3 | [01: Open an Antiky project](feedback-01-open-project-plan.md) | Ready now, but deferred until 08 and 09 pass | It defines the shared project boundary for the remaining workflow. |
| 4 | [02: Initialize an Antiky project](feedback-02-init-project-plan.md) | Feedback 01 complete | It must create the exact manifest that Feedback 01 accepts. |
| 5 | [03: Load a game as a project](feedback-03-load-game-plan.md) | Feedback 01 and 02 complete | It adds the launcher and project-switch lifecycle on the accepted boundary. |
| 6 | [04: Start development with the project](feedback-04-auto-start-development-plan.md) | Feedback 03 complete | It gives the loaded project one CLI-owned development session. |
| 7 | [05: Start the terminal in the project](feedback-05-terminal-project-directory-plan.md) | Feedback 03 complete | It binds the already themed terminal to the active project without making it a process supervisor. |
| 8 | [06: Make demos real projects](feedback-06-demo-projects-plan.md) | Feedback 01 through 05 integration complete | Each demo must prove the complete project, development, and terminal workflow. |
| 9 | [07: Display compiled demos](feedback-07-website-demo-artifacts-plan.md) | Feedback 06 complete and its artifact ADR accepted | The website must consume outputs from stable standalone demo projects. |

Feedback 04 and Feedback 05 share Feedback 03 as their formal dependency. They can use separate branches
after Feedback 03. The recommended sequential run completes Feedback 04 first because development-session
ownership is the larger lifecycle boundary. Feedback 05 must not absorb that ownership.

## Dependency map

```text
Owner-priority visual track
08 layout -> 09 terminal theme

Project and distribution track
                                           +-> 04 auto development --+
01 project boundary -> 02 init -> 03 load -+                          +-> 06 demos -> 07 website artifacts
                                           +-> 05 terminal directory +
```

The two tracks are independent at the contract level. Run the visual track first because the owner gave it
priority. Preserve its approved captures as regression references for the project and distribution track.

## Ownership boundaries

| Feedback | Owns | Must not own |
| --- | --- | --- |
| 08 | Workspace hierarchy, compact chrome, responsive placement | Runtime data, project loading, terminal colors |
| 09 | Embedded Ghostty visual profile and startup appearance | Shell prompt, commands, history, project directory |
| 01 | `.antiky` identity, schema, validation, shared project parser | Project creation or Studio launcher |
| 02 | Safe `antiky init` creation | Dependency install, game scaffolding, project loading |
| 03 | Launcher, recent projects, one active project, project switching | Development supervision or terminal commands |
| 04 | Start, attach, stop, and restart of the CLI-owned development session | Terminal transcript or a second runtime host |
| 05 | Terminal working directory for the active project | Development startup or shell customization |
| 06 | Self-contained demo project source and build output | Website publication policy |
| 07 | Validated website staging, iframe protocol, and editorial publication | Demo source ownership or development services |

## Required plan alignment

- Recheck the next plan against the accepted code and ADR set before each goal starts.
- Update its alignment revision and readiness if an earlier feedback item changed an assumption.
- Treat Feedback 06's Studio-ready behavior as an integration dependency on Feedback 03, 04, and 05.
  Update Feedback 06's control table before its implementation starts.
- Keep Feedback 08's approved desktop and narrow captures through every later Studio change.
- Keep Feedback 09's shell-neutral theme checks through Feedback 05.
- Keep Feedback 01's shared parser as the only project interpretation path through Feedback 07.
- Stop for owner input when a required under-review ADR appears. Do not invent a local workaround.

## Execution rule

For each feedback item:

1. Start the exact `/goal` command in its plan.
2. Read every required document in that plan before code work.
3. Add the required failing regression before a reported defect fix.
4. Complete and commit one checkpoint at a time with the plan's short commit message.
5. Keep temporary verification under this slice directory.
6. Do not add permanent `verify-slice` package scripts or planning-only code to product packages.
7. Run the plan's focused checks and `npm run check`.
8. Capture actual browser or native evidence when the result is visual or interactive.
9. Update the slice summary with the user-visible result, repository changes, and simple test steps.
10. Write the receipt and mark every completion check before the next dependent feedback item starts.

## Priority completion gates

Do not start Feedback 01 until both priority items meet these gates:

- [x] Feedback 08 has owner-approved desktop, narrow, and native-terminal-boundary captures; direct browser zoom capture is an explicit recorded limitation.
- [x] Feedback 08 preserves one live-game iframe and does not reproduce the white-game or duplicate-window defects.
- [x] Feedback 09 has an audited visual-only Ghostty profile with no command or input keys.
- [x] Feedback 09 preserves the user's shell, prompt, profile, keybindings, and history. It does not change
  the current terminal working-directory rule.
- [x] Feedback 09 has approved first-frame, prompt, ANSI-output, and error-state captures.
- [x] Both items pass Studio tests, builds, `npm run check`, documentation review, and receipts.

## Final Slice 00 feedback gate

- [ ] All nine plans have complete receipts tied to exact revisions.
- [ ] The final Studio preserves the approved website-derived layout and terminal theme.
- [ ] Opening one `.antiky` project starts or attaches to one CLI-owned development session.
- [ ] The terminal remains an independent user shell in the active project root.
- [ ] Every demo is a standalone project and the website consumes only validated compiled artifacts.
- [ ] General user documentation describes the finished product behavior without slice terminology.
- [ ] The Slice 00 summary gives the owner simple launch, use, and test instructions.
