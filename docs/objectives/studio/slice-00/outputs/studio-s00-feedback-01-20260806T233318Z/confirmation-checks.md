# Studio Feedback 01 confirmation checks

Run `studio-s00-feedback-01-20260806T233318Z` is complete.

- [x] The completed Studio Slice 00 is the readiness baseline.
- [x] BroMetal 0.15.0 matches the latest npm registry version at review time.
- [x] ADR 0005 records the complete version 1 project manifest and ownership rules in ASD-STE100 Issue 9 language.
- [x] The source baseline records the missing manifest, file association, and launcher.
- [x] The shared parser, discovery, loader, and migration command pass.
- [x] Automated native picker, cold-open, warm-open, and active-project adapter contracts pass.
- [x] The release macOS bundle contains the owned `.antiky` document type.
- [x] The dedicated Projects guide covers launcher, Finder, identity, safe switching, CLI use, and migration.
- [x] The launcher and project workspace pass actual usability review.
- [x] The Finder and picker paths pass actual native interaction review.
- [x] The approved loopback CLI suite passes all 67 tests.
- [x] CP-02 is committed as `5295b1c`.
- [x] CP-03 is committed as `7b0b0f2`, and the clean-worktree repository check passes.
- [x] The complete verifier passes 7 of 7 checks and 8 of 8 commands.
- [x] The receipt is closed.

Computer Use verified the corrected launcher, macOS title-bar inset, Settings disclosure and toggle,
keyboard order, picker, cancellation, active identity, and invalid replacement behavior. A cold Finder
launch first exposed an initialization-order defect. Red regressions drove the fix, and the rebuilt app
then opened `antiky-town.antiky` directly. Five JPEG captures in `captures/` record the accepted states.

The shared worktree also contains unrelated demo edits. The complete repository check passed in a clean
Git worktree at CP-03, so those outside changes remained untouched. The temporary worktree, copied
dependencies, and invalid project fixture were removed after verification.
