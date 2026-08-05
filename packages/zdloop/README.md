# ZD loop

This workspace vendors the scripts and terminal UI that run Codex against
[`docs/objectives`](../../docs/objectives/README.md). From the repository root:

```sh
npm run zdloop -- 60s
npm run zdloop -- 60s --dry-run
npm run zdarchive
npm run test:zdloop
```

The implementation is copied from the ZenSuite [`zd`](https://github.com/iammrduncan/zd) project
while that tool is still under development. Antiky-specific changes are intentionally limited to
the formal objective paths and prompts. When the process or TUI changes in `zd`, port the same
change and its regression tests here; this temporary package can disappear once Antiky consumes a
released upstream package.

`@COMPARE` tasks run as normal Codex sessions and commit a neutral side-by-side artifact. When the
following `@DECIDE` reaches the front of the queue, the dashboard pauses before launching Codex,
shows the decision task, and accepts the user's answer directly. Type the decision and press
Enter; zdloop passes it to one explicit Codex run. That run follows `.claude/commands/session.md`
and records the choice before the loop continues. A non-interactive or `--no-tui` run stops cleanly
and requests an interactive restart instead of repeating the unanswered decision. These exact
todo.txt tags are the control signal; the words COMPARE and DECIDE in ordinary task prose do not
affect the loop. A dry run reports the number of upcoming comparison tasks and decision gates at
the top of its summary.

The root manifest pins the shared Next, PostCSS, sharp, and Transformers.js versions as security
anchors. npm applies root overrides consistently across workspaces only when those packages are
also direct root dependencies; `tests/integration.test.mjs` guards the patched resolved versions.
