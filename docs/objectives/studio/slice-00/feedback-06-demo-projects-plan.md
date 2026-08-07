# Feedback 06 plan: Make demos real projects

## Control

| Field | Value |
| --- | --- |
| Status | `COMPLETE WITH RECORDED EVIDENCE LIMITATION` |
| Feedback source | [Slice 00 feedback, line 6](slice-feedback.txt) |
| Outcome | Each public demo is a self-contained Antiky game project that compiles one portable game module |
| Owner input | The source feedback and demo-game goal supply the product direction |
| Architecture decisions | [Framework 0020](../../../adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md), [CLI 0002](../../../adr/cli/0002-supply-cli-project-services-through-a-library-api_H.md), [CLI 0003](../../../adr/cli/0003-make-cli-project-services-the-development-authority_H.md), and [Studio 0006](../../../adr/studio/0006-use-cli-project-services-directly_H.md) |
| Depends on | Completed project selection and initialization work |
| Alignment revision | `6607a9c81840c7a58b3ec2b526d3742134a8228a` |
| Review date | `2026-08-07` |
| Complete check | [Archived passing verifier](outputs/studio-s00-feedback-06-20260807T163700Z/final-verifier.json) |
| Evidence | [Run receipt](outputs/studio-s00-feedback-06-20260807T163700Z/receipt.json) |

## Feedback

> demos should be structured as project folders, self contained, launchable, compilable.

## Outcome

Every public demo proves the same project workflow that an independent Antiky game developer uses.

### Definition of self-contained

A demo owns its `.antiky` manifest, package manifest, game entry, source, assets, shader inputs and
outputs, build configuration, tests, and documentation. It can use declared package dependencies.
It cannot use relative imports from another demo, the website, or an objective folder.

The project compiles its default game-module entry to `dist/antiky.game.js`. The output contains all
required runtime chunks and assets. The project does not contain a server, canvas host, raw-input
adapter, process supervisor, inspection server, or MCP endpoint.

### Observable behavior

- `antiky dev --project <demo>/<name>.antiky` compiles the game and mounts it in the CLI-owned host.
- Studio opens the same manifest and starts the same CLI project service without a shell command.
- Each package build emits one portable ESM game module and all required runtime files.
- A clean test host can mount the compiled module outside the source checkout.
- Game tests run without a server, website, Studio, or sibling demo source.
- Adding a demo needs one project folder and one deliberate website catalog entry.

### Non-goals

- Do not add host or delivery code to a demo project.
- Do not name demos after implementation slices or move slice verification into demos.
- Do not make one demo import private source from another demo.
- Do not move town-specific code into Framework only to remove a relative import.
- Do not publish demo npm packages in this plan.

## Chosen shape

Convert `packages/demos` from one source package into three independent npm workspaces:

```text
packages/demos/
  antiky-town/   -> package.json + antiky-town.antiky + src + assets + tests + dist
  town-study/    -> package.json + town-study.antiky + src + assets + tests + dist
  shader-study/  -> package.json + shader-study.antiky + src + assets + tests + dist
```

The root workspace list includes `packages/demos/*`. Vite compiles the game entries in library mode.
In development, each `development.command` runs that compiler in watch mode. It does not start a Vite
HTTP server. The CLI project service supplies the canvas host, loopback server, inspection service,
MCP endpoint, process supervision, and cleanup. Studio starts the same service through its packaged
library worker.

Antiky Town and Town Study currently share a cohesive town renderer. If the renderer keeps one narrow
input and two real consumers, move it to one declared private support package outside both demo
folders. Otherwise, duplicate the necessary game code and keep the projects independent.

### Options considered

- **Independent game-project workspaces — selected.** Each demo proves the external project, CLI,
  Studio, test-host, and build path.
- **Keep one slug-driven demo package — rejected.** It preserves sibling-source and website coupling.
- **Give each project a Vite page and server — rejected.** It restores the host code that Framework
  0020 assigns to delivery targets.
- **Move demo code into Framework — rejected.** Demo-specific rendering is not framework behavior.

## Completed state

- The deleted generic demo and React hosts remain deleted.
- Three independent demo workspaces own their manifests, entries, tests, shaders, assets, and builds.
- Town rendering is shared through the declared private `@antiky/demo-town-support` package.
- Every demo emits one portable `dist/antiky.game.js` plus its bounded artifact manifest.
- CLI and Studio mount those modules through the CLI-owned project service.
- The website consumes only the compiled artifacts through its own publication catalog and host.

## Deliverables

- Create one workspace folder and one valid `.antiky` manifest for each public demo.
- Give each demo one default entry that implements `GameModuleEntry` from `@antiky/framework/game`.
- Compile `dist/antiky.game.js` and required chunks or assets without a project-owned host.
- Move each demo's shaders, assets, tests, package data, and short README into its project.
- Resolve all sibling imports through independence or one proved private support package.
- Remove the stale registry, runtime exports, deleted-host scripts, and monolithic package after parity.
- Add boundary tests that reject website, objective-folder, CLI, Studio, server, and sibling-demo imports.
- Preserve Antiky Town engine-session and point-light inspection through the generic game-module contract.
- Update general demo, CLI, and Studio documentation.

## Safe behavior

- Preserve the host deletion. Do not restore `packages/demos/dev-host`, the old React host, or the old
  generic demo runtime.
- Build each module into its own ignored `dist/` folder. Never write generated output into source.
- Keep local descriptors, credentials, commands, and absolute paths out of compiled output.
- Resolve project-relative paths from the `.antiky` manifest and reject escapes.
- Preserve current public routes and approved website metadata until Feedback 07 switches consumers.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Add failing ownership tests and record the current dependency graph | Boundary failures and baseline facts | `Qualify demo projects` |
| `CP-01` | Convert Shader Study to the game-module contract | CLI host, test host, type check, and build | `Make Shader Study a project` |
| `CP-02` | Convert Town Study and isolate shared town rendering | Independent imports and render parity | `Make Town Study a project` |
| `CP-03` | Convert Antiky Town and preserve Framework inspection | Studio, CLI, MCP, controls, and render parity | `Make Antiky Town a project` |
| `CP-04` | Remove stale monolithic coupling and update docs | Boundary tests and repository check | `Complete demo project migration` |

## Test plan

- Add a failing boundary test first for current sibling, website, and deleted-host coupling.
- Run test, type-check, shader, development-build, and production-build scripts in every demo.
- Start every manifest with the CLI project service and fetch the CLI-owned host and compiled module.
- Mount every output with a clean test host outside the checkout.
- Open every manifest in Studio and verify managed startup, game frame, diagnostics, and cleanup.
- Preserve Antiky Town world inspection, event history, controls, MCP tools, fixed-step behavior, render
  counts, upload bytes, resource counts, and zero normal GPU readback.
- Capture actual desktop and narrow visual evidence for all three demos.
- Run each package check and then `npm run check` from the repository root.

## Completion checks

- [x] Every public demo is one real `.antiky` game project with one owned folder.
- [x] Every demo tests, type-checks, and compiles without a project-owned host or sibling demo source.
- [x] CLI and Studio mount the same compiled module through the CLI-owned development host.
- [x] Every compiled module runs outside the checkout and contains no development state or secrets.
- [x] Antiky Town inspection and reference render measurements remain correct.
- [x] Stale monolithic exports, registry, scripts, and imports are removed.
- [x] Native interaction, the recorded capture limitation, docs, checks, receipt, and slice summary pass.

## Run and evidence rule

- Use one isolated port pair and output directory for each demo.
- Keep the host deletion as a fixed boundary throughout the migration.
- Roll back a project if it needs sibling source, adds host code, fails outside the checkout, or changes
  rendering without approved evidence.
- Demo owners maintain game code. CLI and Studio owners maintain the development host.

The packaged macOS Studio was inspected with Computer Use while it opened all three project manifests.
Those native views displayed workstation-private absolute paths, so the run records the observations but
does not store screenshots that would violate the output policy.
