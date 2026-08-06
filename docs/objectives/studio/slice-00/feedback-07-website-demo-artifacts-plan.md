# Feedback 07 plan: Display compiled demos on the website

## Control

| Field | Value |
| --- | --- |
| Status | `NOT READY` until Feedback 06 creates standalone demo artifacts; CP-00 must accept the artifact ADR |
| Feedback source | [Slice 00 feedback, line 7](slice-feedback.txt) |
| Outcome | The website displays validated compiled demo artifacts without importing demo source code |
| Owner input | The source feedback selects compiled artifacts; no presentation choice remains open |
| Architecture decisions | New narrow browser-demo artifact ADR, [Studio 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md), and `UNDER_REVIEW_A.md` candidate 16 |
| Depends on | [Feedback 06](feedback-06-demo-projects-plan.md) |
| Alignment revision | `dd0eda5d8c4f4273e0cab8b3a5bfa843b8d17b40` |
| Review date | `2026-08-06` |
| Complete check | `node docs/objectives/studio/slice-00/verification/feedback-07/verify.mjs` |
| Evidence | `docs/objectives/studio/slice-00/outputs/studio-s00-feedback-07-{run-id}/receipt.json` |

Goal command:

```text
/goal implement docs/objectives/studio/slice-00/feedback-07-website-demo-artifacts-plan.md until complete
```

## Feedback

> website should bring in compiled demos for display on the site.

## Outcome

The website presents each approved demo as an immutable browser build produced by that demo project.

### Observable behavior

- The website build first consumes already compiled demo outputs or builds them through their public
  project build commands.
- The website does not import demo runtime, renderer, shader, React, registry, or test source.
- Each demo route loads a staged static artifact through a narrow iframe boundary.
- The website keeps its editorial title, description, poster, activation, maturity, and navigation.
- Activation, pause, resume, ready, error, and bounded measurement messages cross one versioned protocol.
- A stale, missing, incompatible, or corrupt artifact fails the website build with the demo slug and code.

### Non-goals

- Do not make the website compile game source inside Next.js.
- Do not publish arbitrary local projects or discover demos from the filesystem at runtime.
- Do not deploy unreviewed demos, source maps with private paths, or development services.
- Do not design native game packages, installers, remote hosting, or a general release marketplace.
- Do not move editorial metadata into the game project manifest.

## Chosen shape

Each demo build emits `dist/index.html`, hashed runtime assets, and one bounded `antiky-artifact.json`.
The website staging step validates the manifest and digests, then copies the immutable directory into an
ignored build-input folder. Next.js copies that folder into its output. The demo route activates it in
an iframe.

```text
demo source -> project build -> dist + artifact manifest -> validation and staging
                                                               |
website editorial catalog -> Next.js build --------------------+-> `/demo-builds/<slug>/index.html`
website stage <-> versioned postMessage protocol <-> compiled demo iframe
```

The artifact manifest records schema version, project name, slug, source revision, entry file, base
path, file paths, sizes, SHA-256 digests, WebGPU requirement, viewport, and protocol version. It does
not contain local absolute paths, commands, credentials, timestamps that break reproducibility, or
development-session data.

The website catalog remains the source for public title, copy, tags, poster, order, and publication
approval. A build artifact cannot publish itself by appearing on disk.

### Options considered

- **Static artifact in an iframe — selected.** It preserves a standalone game build and keeps the
  website from becoming the game's module loader. A small message protocol supplies host controls.
- **Compiled ESM mount function — rejected for now.** It couples the artifact to website React and DOM
  lifecycle details and does not prove that the game runs by itself.
- **Continue source imports — rejected.** Next.js remains the demo compiler and hides missing runtime
  files until website build or deployment.

## Required reading

- [Source feedback](slice-feedback.txt)
- [Studio objective guidance](../AGENTS.md) and [slice workflow](../../antiky-town/SLICE_WORKFLOW_A.md)
- [Feedback 06](feedback-06-demo-projects-plan.md)
- [ADRs under review](../../../adr/UNDER_REVIEW_A.md) in full, especially candidate 16
- [Website design](../../../../packages/website/DESIGN.md) and [website product rules](../../../../packages/website/PRODUCT.md)
- [Studio architecture](../../../architecture/studio/overview_A.md)
- [Good Engineering](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

- [PlayCanvas](https://developer.playcanvas.com/user-manual/editor/projects/downloading/) emits a
  self-contained static package for direct hosting and a separate editable npm project. Antiky uses
  the same source-versus-build distinction.
- [Vite](https://vite.dev/guide/build) builds a static `index.html` application and rewrites assets for
  a configured base. Relative base support lets one artifact run at its staged website path.
- [Vite build options](https://vite.dev/config/build-options.html) can emit a bundler manifest, but
  Antiky needs a separate product-level manifest for identity, complete files, hashes, and protocol.
- Godot and Unreal export playable builds from editable projects. The website consumes an export, not
  the editor project.
- [Phaser templates](https://phaser.io/tutorials/create-game-app) use `npm run build` for production
  output. [Bevy's web path](https://github.com/bevyengine/bevy/blob/main/examples/README.md) also creates
  files that must be served over HTTP. Antiky uses the same explicit artifact gate.
- Unity build output and project source are separate. Antiky preserves that ownership boundary.
- `npm ls brometal` and the [npm registry](https://registry.npmjs.org/brometal/latest) both report
  BroMetal `0.15.0` on `2026-08-06`. Shader compilation stays inside each demo build. The website
  receives only browser-ready WGSL and runtime code, never the BroMetal compiler.
- `UNDER_REVIEW_A.md` candidate 16 is necessary. Before code work, record and accept a narrow ADR for
  the browser-demo artifact and embed protocol. Do not use this feedback to decide all shipped games.

## Current state

- The website imports `@antiky/demos/catalog`, `@antiky/demos/react`, and a generated shader module.
- `DemoDeck` mounts `DemoStage`, which loads demo source from the monolithic registry at runtime.
- Website `prebuild` invokes the demo package's shader compiler, then Next.js compiles game source.
- There is no standalone demo artifact, artifact manifest, staging gate, or embed protocol.

## Deliverables

- Record the narrow browser-demo artifact and iframe protocol in an accepted ADR.
- Add deterministic artifact-manifest generation to each demo build.
- Add one durable website staging command. It validates allowed slugs, exact files, hashes, sizes,
  entry path, base path, source revision, and protocol compatibility.
- Keep staged output generated and ignored. Do not commit duplicate compiled games to website source.
- Replace source imports and `DemoStage` runtime coupling with an iframe-based compiled-demo stage.
- Add a small strict message adapter for activate, pause, resume, ready, error, and measurements.
- Keep poster-first activation, reduced motion, offscreen pause, keyboard controls, text states, and
  44-pixel mobile actions from the website design system.
- Remove website shader compilation and demo-source package dependencies after artifact parity.
- Update website build documentation and general demo integration guidance.

## Safe behavior

- Accept only catalog-approved slugs and files inside one staged artifact root.
- Reject symlinks, path traversal, extra files, missing files, digest mismatch, oversized artifacts,
  incompatible schemas, and source revisions that do not match the build input.
- Validate `event.origin`, `event.source`, protocol version, slug, and bounded payload shape for every
  iframe message. Do not interpret arbitrary messages as engine state.
- Do not expose inspection, MCP, terminal, credentials, or local file access to a website demo.
- A failed artifact keeps its verified poster, plain error text, and retry/build guidance.
- Keep the last passing website build as the software rollback artifact.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Capture current website/demo behavior and accept the narrow artifact ADR | Reference captures, import graph, and ADR | `Define browser demo artifacts` |
| `CP-01` | Add deterministic manifests and clean standalone artifacts | Rebuild digest and out-of-checkout tests | `Build demo artifacts` |
| `CP-02` | Add staging validation and remove source imports | Corruption, path, size, and import-boundary tests | `Stage demos for the website` |
| `CP-03` | Add compiled-demo stage and protocol while preserving website behavior | Browser, message, accessibility, and visual tests | `Display compiled demos` |
| `CP-04` | Remove old coupling, update docs, and verify production output | Clean website build and receipt | `Verify compiled website demos` |

## Test plan

- Add a failing import-boundary test first for the current website-to-demo-source imports.
- Build each demo twice from identical source. Compare the complete artifact file list and digests.
- Serve each artifact outside the checkout. Test nested base paths, all assets, WebGPU startup, errors,
  disposal, and no source or development-service dependency.
- Test missing manifest, unknown field, bad digest, extra file, symlink, traversal, excessive size,
  incompatible protocol, unpublished slug, stale revision, and partial staging cleanup.
- Test iframe source and origin validation, malformed messages, stale messages, duplicate ready, pause,
  resume, offscreen behavior, reduced motion, retry, and disposal.
- Verify that the production website output contains the approved artifacts and no demo TypeScript,
  test files, source maps with private paths, credentials, or `.antiky` development descriptors.
- Use browser control and owner-reviewed visual captures for poster, activation, live demo, measurements,
  pause, failure, desktop, narrow layout, zoom, keyboard, and reduced motion.
- Run all demo builds and tests, website type check and production build, website tests, and `npm run check`.

## Completion checks

- [ ] The website consumes only validated compiled demo artifacts.
- [ ] No website production path imports demo runtime or renderer source.
- [ ] Each artifact is deterministic, complete, bounded, and runnable outside the checkout.
- [ ] Only the website editorial catalog can approve public display.
- [ ] The embed protocol is versioned, strict, origin-checked, and free of development authority.
- [ ] Poster-first, accessibility, responsive, pause, error, and visual behavior match the reference.
- [ ] The old source-coupled host and website shader compile are removed after parity.
- [ ] Actual browser evidence, docs, production build, receipt, and slice summary pass.

## Run and evidence rule

- Build into isolated demo outputs and stage into one empty temporary website input for each attempt.
- Keep the current source-mounted website build as the rollback point through CP-03.
- Roll back if an artifact is nondeterministic, incomplete, unsafe, unpublished, visually regressed, or
  dependent on repository source at runtime.
- Demo owners own artifacts. Website maintainers own catalog approval, staging, and presentation.
