# Feedback 06 plan: Make demos real projects

## Control

| Field | Value |
| --- | --- |
| Status | `NOT READY` until Feedback 01 and Feedback 02 define and create projects |
| Feedback source | [Slice 00 feedback, line 6](slice-feedback.txt) |
| Outcome | Each demo is a self-contained Antiky project that can initialize, launch, test, and compile by itself |
| Owner input | The source feedback supplies the product direction |
| Architecture decisions | Feedback 01 project-boundary ADR and [Framework 0016](../../../adr/framework/0016-give-platform-work-to-game-host_H.md) |
| Depends on | [Feedback 01](feedback-01-open-project-plan.md) and [Feedback 02](feedback-02-init-project-plan.md) |
| Alignment revision | `dd0eda5d8c4f4273e0cab8b3a5bfa843b8d17b40` |
| Review date | `2026-08-06` |
| Complete check | `node docs/objectives/studio/slice-00/verification/feedback-06/verify.mjs` |
| Evidence | `docs/objectives/studio/slice-00/outputs/studio-s00-feedback-06-{run-id}/receipt.json` |

Goal command:

```text
/goal implement docs/objectives/studio/slice-00/feedback-06-demo-projects-plan.md until complete
```

## Feedback

> demos should be structured as project folders, self contained, launchable, compilable.

## Outcome

Every public demo proves the same project workflow that an independent Antiky game developer uses.

### Definition of self-contained

A demo project owns its `.antiky` manifest, package manifest, entry page, source, public assets, shader
inputs and outputs, build config, tests, and documentation in one folder. It can use declared package
dependencies such as Antiky Framework and BroMetal. It cannot use relative imports from another demo,
the website, or a slice folder. Its compiled output contains every runtime file it needs.

### Observable behavior

- `antiky dev --project <demo>/<name>.antiky` launches each demo from its own folder.
- Studio opens each demo by its `.antiky` file and reaches a ready runtime.
- The demo package's normal build command creates one static browser artifact.
- The artifact runs from a clean HTTP server outside the source checkout.
- The demo package's tests run without starting the website or another demo.
- Adding a demo means adding one project folder and one deliberate website catalog entry.

### Non-goals

- Do not name demos after implementation slices or move slice verification into demos.
- Do not make the website the game host, bundler, or source owner.
- Do not make one demo import private source from another demo.
- Do not promote town-specific code into Framework only to remove a relative import.
- Do not publish demo npm packages in this plan.

## Chosen shape

Convert `packages/demos` from one source package into a folder of independent npm workspaces.

```text
packages/demos/
  antiky-town/   -> package.json + antiky-town.antiky + src + public + tests + dist
  town-study/    -> package.json + town-study.antiky + src + public + tests + dist
  shader-study/  -> package.json + shader-study.antiky + src + public + tests + dist
```

The root workspace list includes `packages/demos/*`. Each project has the same small scripts:
`dev`, `build`, `test`, `typecheck`, `shaders`, and `shaders:watch` when shaders apply. Vite supplies
the browser host and static build. Antiky CLI supplies development supervision and inspection.

Use a declared private package only when two demos have one cohesive reusable module. The current
Antiky Town relative imports from Town Study must first pass a cohesion probe. If the shared town
renderer has a narrow stable input and two real consumers, move it to one private package outside
the demo folders. Otherwise, keep each demo independent even when that needs deliberate duplication.

### Options considered

- **Independent project workspaces — selected.** Each demo proves the external project, Studio, CLI,
  test, and build path.
- **Keep one slug-driven demo package — rejected.** It preserves the website and sibling-source
  coupling reported in the feedback.
- **Move demo code into Framework — rejected.** Town and study code does not become reusable engine
  code only because the current folder structure is inconvenient.

## Required reading

- [Source feedback](slice-feedback.txt)
- [Studio objective guidance](../AGENTS.md) and [slice workflow](../../antiky-town/SLICE_WORKFLOW_A.md)
- [Feedback 01](feedback-01-open-project-plan.md) and [Feedback 02](feedback-02-init-project-plan.md)
- [Development harness research](../../general-stuff/DEV_HARNESS_RESEARCH_A.md)
- [Framework 0016](../../../adr/framework/0016-give-platform-work-to-game-host_H.md)
- [ADRs under review](../../../adr/UNDER_REVIEW_A.md)
- [Website design](../../../../packages/website/DESIGN.md) and [Good Engineering](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

- [Phaser Create Game](https://phaser.io/tutorials/create-game-app) creates normal local projects with
  their own template and launch instructions. Antiky demos must prove the same external workflow.
- [Unreal projects](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-projects-and-gameplay)
  keep each game in one self-contained project directory with a named project file.
- [Godot](https://docs.godotengine.org/en/latest/tutorials/editor/project_manager.html) installs demos
  as normal projects that users can open and edit.
- [Bevy examples](https://github.com/bevyengine/bevy/blob/main/examples/README.md) can run and build as
  named Cargo examples, but Antiky chooses full project folders because Studio and website artifacts
  need real project boundaries.
- [PlayCanvas](https://developer.playcanvas.com/user-manual/editor/projects/downloading/) distinguishes
  an editable npm project from a self-hostable static build. Antiky projects produce both workflows.
- [Vite production builds](https://vite.dev/guide/build) produce static artifacts and support relative
  asset bases. Antiky uses Vite instead of creating a bundler.
- `npm ls brometal` and the [npm registry](https://registry.npmjs.org/brometal/latest) both report
  BroMetal `0.15.0` on `2026-08-06`. Each project keeps BroMetal shader compilation at build time. The
  migration must preserve draw counts, uploads, resources, and zero normal GPU readback.
- `UNDER_REVIEW_A.md` candidate 16 applies to the compiled artifact. Feedback 07 records the narrow
  artifact ADR before the website consumes it. This plan proves ordinary static builds without fixing
  the later website staging manifest or embed protocol.

## Current state

- `@antiky/demos` owns one catalog, registry, React host, runtime, all demo sources, and all demo tests.
- The focused Vite host selects a demo slug through environment state.
- Antiky Town imports Town Study source by relative path.
- The website imports `@antiky/demos/catalog` and `@antiky/demos/react` source directly.
- Only the repository root has development configuration. No demo has a `.antiky` file or build output.

## Deliverables

- Create one workspace folder and one valid `.antiky` manifest for each deliberate public demo.
- Move each demo entry, assets, shaders, build config, tests, and short README into its project.
- Give each demo a canvas-only Vite application with no website presentation dependency.
- Resolve all cross-demo relative imports through independence or one proved private package.
- Remove the slug dispatcher, monolithic registry, and package-wide shader/test scripts after parity.
- Add ownership-boundary tests that forbid imports from website, slice docs, or sibling demo source.
- Preserve Framework inspection for Antiky Town without adding inspection obligations to render studies.
- Update general demo, CLI, and Studio documentation. Keep slice verification in objective folders.

## Safe behavior

- Build each artifact into its own ignored `dist/` folder. Never write generated output into source.
- Resolve project-relative paths from the `.antiky` file and reject escapes.
- Preserve all current public routes and explicitly approved metadata until Feedback 07 switches them.
- Keep old demo host available until all three independent project builds and references pass.
- Do not copy secrets, local descriptors, `.antiky/dev-session.json`, source maps with private paths, or
  development credentials into static artifacts.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Capture all demo references, dependency graph, artifact needs, and render measurements | Baseline facts and import graph | `Qualify demo projects` |
| `CP-01` | Convert Shader Study as the smallest complete project | Standalone dev, test, and build | `Make Shader Study a project` |
| `CP-02` | Convert Town Study and resolve its reusable boundary | Standalone parity and render measures | `Make Town Study a project` |
| `CP-03` | Convert Antiky Town with Framework inspection and session parity | Studio, CLI, MCP, and render parity | `Make Antiky Town a project` |
| `CP-04` | Remove monolithic host and update docs | Boundary tests and complete check | `Complete demo project migration` |

## Test plan

- Add a failing boundary test first for the current cross-demo and website-source coupling.
- From each demo directory, run install-compatible package scripts, `antiky dev`, tests, type check,
  shader production compile, and static build.
- Copy each `dist` to a clean temporary directory. Serve it over HTTP and verify all chunks, shaders,
  textures, sprites, fonts, workers, and routes load without source checkout access.
- Open each `.antiky` file in Studio. Verify project name, game frame, terminal root, diagnostics, and cleanup.
- Preserve Antiky Town world inspection, event log, controls, MCP tools, fixed-step behavior, render counts,
  upload bytes, resources, and no normal GPU readback.
- Use browser control and Computer Use or owner review for all three visible demos at desktop and narrow
  sizes. Save actual visual comparisons; code review is not visual evidence.
- Run each package check independently and then `npm run check` from the repository root.

## Completion checks

- [ ] Every demo is a real `.antiky` project with one owned folder.
- [ ] Every demo launches, tests, type-checks, and compiles without the website or a sibling demo source.
- [ ] Every static artifact runs outside the checkout and contains no development state or secrets.
- [ ] Studio opens every demo through the normal project workflow.
- [ ] Antiky Town inspection and all reference render measurements remain correct.
- [ ] The old monolithic registry and focused slug host are removed after parity.
- [ ] Actual visual evidence, docs, checks, receipt, and slice summary pass.

## Run and evidence rule

- Use one isolated port pair and output directory for each demo. Never overlap their descriptors.
- Keep the current `@antiky/demos` host as the rollback point through CP-03.
- Roll back a project if it needs another demo's source, fails outside the checkout, or changes rendering
  without approved reference evidence.
- Demo owners maintain each project. Framework maintainers own only reusable engine behavior.
