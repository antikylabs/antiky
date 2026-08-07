# Studio Feedback 06 confirmation checks

Run `studio-s00-feedback-06-20260807T163700Z` passed its automated and native interaction checks.

- [x] Antiky Town, Town Study, and Shader Study each own one `.antiky` manifest, package, game entry, tests, and build.
- [x] Each project compiles `dist/antiky.game.js` without a project-owned server, canvas host, inspection server, or MCP endpoint.
- [x] Clean artifact tests copy and import every compiled module outside its source folder and prove deterministic bytes.
- [x] CLI mounts every public manifest in its own development host and owns inspection, MCP, lifecycle, and cleanup.
- [x] Studio packages the CLI project-service worker and starts it directly instead of running `antiky dev` through a shell.
- [x] The packaged macOS Studio opened all three manifests and showed a connected live game for each.
- [x] Antiky Town published two inspection entities and 16 draw calls through the optional Framework inspection port.
- [x] Native pause, one exact step from 2984 to 2985, resume, project switching, and final cleanup passed.
- [x] The deleted monolithic demo host remains deleted, and demos have no sibling-source or delivery-host imports.
- [x] Project and game-module user guides, ADR validation, package tests, and `npm run check` pass.

The native views were inspected with Computer Use. They were not copied into the run because they displayed
workstation-private absolute paths, which this output directory must not retain. No stored capture is claimed.
