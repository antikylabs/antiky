# Feedback 07 plan: Display compiled demos on the website

## Control

| Field | Value |
| --- | --- |
| Status | `COMPLETE WITH RECORDED BROWSER EVIDENCE LIMITATION` |
| Feedback source | [Slice 00 feedback, line 7](../slice-feedback.txt) |
| Outcome | The website mounts validated compiled game modules without importing demo source |
| Owner input | The source feedback and demo-game goal supply the product direction |
| Architecture decisions | [Framework 0020](../../../../adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md) and [Studio 0002](../../../../adr/studio/0002-tauri-portable-web-editor_H.md) |
| Depends on | [Completed Feedback 06](feedback-06-demo-projects-plan.md) |
| Alignment revision | `3d7dd5d4207e44f1a7ab989c1989c0ba13a74672` |
| Review date | `2026-08-07` |
| Complete check | Archived `PASS`; temporary verifier removed after completion |
| Closeout | [Studio Slice 00 summary](../slice-summary.md) |

## Feedback

> website should bring in compiled demos for display on the site.

## Outcome

The website supplies a delivery host and mounts each approved compiled game module on a
website-owned canvas.

### Observable behavior

- The website build stages already compiled demo outputs through their public build commands.
- Website production code does not import demo source, renderer source, shaders, tests, or registry code.
- Each demo stage imports one validated `antiky.game.js` artifact and mounts it on its own canvas.
- The website host owns raw input, presentation timing, visibility, activation, and disposal.
- The website keeps editorial title, description, poster, maturity, order, and navigation data.
- A missing, stale, incompatible, oversized, or corrupt artifact fails staging with a stable code and
  demo slug.

### Non-goals

- Do not compile game source inside Next.js.
- Do not package a second game host inside each demo artifact.
- Do not publish arbitrary local projects or discover demos from the filesystem at runtime.
- Do not deploy source maps with private paths or any development service or credential.
- Do not move website publication approval into the game project manifest.

## Chosen shape

Each demo emits `dist/antiky.game.js`, optional hashed runtime files, and one bounded
`antiky-artifact.json`. The website staging command validates every declared file and copies the
immutable artifact into an ignored build-input folder. Next.js publishes that folder. A small
website-owned host dynamically imports the module and calls its default `GameModuleEntry`.

```text
demo source -> game-module build -> dist + artifact manifest -> validation and staging
                                                                    |
website editorial catalog -> Next.js build -------------------------+-> `/demo-builds/<slug>/`
                                                                    |
website canvas host -> import antiky.game.js -> mount game instance
```

The artifact manifest records schema version, project name, slug, source revision, entry file, file
paths, sizes, SHA-256 digests, WebGPU requirement, viewport, and game-module contract version. It does
not contain commands, local paths, timestamps, credentials, development-session data, or a host page.

The website catalog remains the authority for public title, copy, tags, poster, order, and publication
approval. An artifact cannot publish itself by appearing on disk.

### Options considered

- **Compiled ESM game module — selected.** It gives the website the same portable module boundary as
  CLI, Studio, and test hosts.
- **Static iframe application — rejected.** It packages a second host with the game and conflicts with
  Framework 0020.
- **Continue source imports — rejected.** It makes Next.js the demo compiler and hides incomplete
  standalone builds.

## Completed state

- Website production source owns its editorial catalog and imports no demo source package.
- Every approved demo emits a deterministic game artifact and bounded manifest before website staging.
- Strict staging rejects stale, changed, extra, missing, invalid, excessive, unsafe, or symlinked output.
- `DemoStage` owns the canvas, input, timing, visibility, pause, error, retry, and disposal lifecycle.
- The production build publishes the three validated modules at same-origin `/demo-builds/` paths.

## Deliverables

- Add deterministic artifact-manifest generation to every public demo build.
- Add one staging command that validates approved slugs, exact files, hashes, sizes, entry path,
  source revision, contract version, symlinks, and path containment.
- Keep staged output generated and ignored. Do not commit duplicate compiled games to website source.
- Move editorial catalog data into the website and keep it independent from game manifests.
- Replace source-coupled demo components with a website-owned canvas host for `GameModuleEntry`.
- Preserve poster-first activation, reduced motion, offscreen pause, keyboard and pointer controls,
  text states, and 44-pixel mobile actions.
- Remove website shader compilation and demo-source dependencies after parity.
- Update website build documentation and general demo integration guidance.

## Safe behavior

- Accept only catalog-approved slugs and files inside one staged artifact root.
- Reject symlinks, path traversal, extra or missing files, digest mismatch, excessive size,
  incompatible schemas, and stale source revisions.
- Import only same-origin staged modules. Do not accept arbitrary module URLs from runtime messages.
- Validate the module default export and returned game instance before the presentation loop starts.
- Always call `dispose`, cancel presentation callbacks, and remove platform listeners on deactivation.
- Do not expose inspection, MCP, terminal, credentials, or local-file access to website demos.
- A failed module keeps its verified poster and plain error text.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Add failing website/demo import-boundary tests | Current source imports fail | `Qualify compiled demo delivery` |
| `CP-01` | Add deterministic manifests and clean module artifacts | Rebuild digest and out-of-checkout tests | `Build demo artifacts` |
| `CP-02` | Add strict staging and move editorial catalog data | Corruption and boundary tests | `Stage demos for the website` |
| `CP-03` | Add the website canvas host and preserve presentation behavior | Host lifecycle, accessibility, and visual tests | `Display compiled demos` |
| `CP-04` | Remove old coupling and verify production output | Clean build, receipt, and evidence | `Verify compiled website demos` |

## Test plan

- Add a failing import-boundary test first for current website-to-demo-source imports.
- Build each demo twice from identical source and compare every file path and digest.
- Copy each artifact outside the checkout and mount it with a clean host.
- Test missing manifests, unknown fields, bad digests, extra files, symlinks, traversal, excessive size,
  incompatible contracts, unpublished slugs, stale revisions, and partial staging cleanup.
- Test invalid module exports, invalid game instances, activation, offscreen pause, reduced motion, retry,
  listener cleanup, presentation cancellation, and disposal.
- Verify production output contains approved artifacts and no demo TypeScript, tests, private source maps,
  credentials, descriptors, inspection endpoints, or MCP code.
- Capture actual poster, activation, live game, measurement, error, desktop, narrow, zoom, keyboard, and
  reduced-motion evidence.
- Run all demo builds and tests, website type check and production build, and `npm run check`.

## Completion checks

- [x] The website consumes only validated compiled game-module artifacts.
- [x] No website production path imports demo source or compiles game code.
- [x] Every artifact is deterministic, complete, bounded, and runnable outside the checkout.
- [x] Only the website editorial catalog approves public display.
- [x] The website host owns canvas, raw input, timing, visibility, and cleanup.
- [x] Poster-first, accessibility, responsive, pause, error, and visual contracts pass.
- [x] Old source coupling and website shader compilation are removed.
- [x] The browser limitation, docs, production build, receipt, and slice summary are recorded and pass.

## Run and evidence rule

- Build into isolated demo outputs and stage into one empty temporary input for each attempt.
- Keep each last passing artifact as the software rollback point.
- Roll back if an artifact is nondeterministic, unsafe, unpublished, visually regressed, or dependent on
  source checkout files at runtime.
- Demo owners own compiled modules. Website maintainers own catalog approval and the delivery host.

Browser Control reported no attached browser during final verification. The run does not substitute a
synthetic image or the native Studio view for browser evidence. Production delivery and accessibility
contracts pass, and the limitation remains explicit in the receipt.
