# Slice 00 Baseline

## Run setup

- Run ID: `s00-20260804T185103Z`
- Attempt ID: `attempt-001`
- Checkpoint: `CP-00`
- Source revision: `b05a078394bf455beb7ababf30aa187e22c74f68`
- Alignment revision: `441563bcce94abd76fb6813869e603e13f116b5a`
- Branch: `feat/voxel-demo-work`
- Worktree: `/Users/josephduncan/github/emberwyrd/antikySite`
- Dependency-lock SHA-256: `e1dffabd6faeb6353f2050e22ab26397e9ab320d8c0a574edfc7e9156413fef9`
- Artifact directory: `docs/objectives/antiky-town/slice-00/outputs/s00-20260804T185103Z`
- Game address: `127.0.0.1:3010`
- Inspection address: `127.0.0.1:3011`
- Browser-control address: `127.0.0.1:9322`, temporary and baseline-only
- Test addresses: `127.0.0.1:43100` and `127.0.0.1:43101`
- Locale: inherited system locale
- Time zone: `America/Chicago`
- Seed: `N/A`; the harness does not add random game state
- Network: loopback only after tool selection

No other slice run was active. The current writable worktree and unique output directory isolate this
run. A resource collision is a readiness failure. The implementation must not select another port
silently.

## Environment

- macOS `26.5.2` (`25F84`), Darwin `25.5.0`, Apple arm64
- Node.js `22.15.0`
- npm `10.9.2`
- TypeScript `5.9.3`
- BroMetal `0.14.0`
- Vitest `4.1.10`
- Google Chrome `150.0.7871.188`
- Viewport for the ready-state capture: `756 x 469`

The in-app browser had no connected instance. This was an evidence-tool limitation, not a product
failure. The run selected installed Google Chrome with a dedicated temporary profile and the WebGPU
flag. The profile is outside the repository and contains no Antiky credential.

## Preflight

`npm run check` passed at the source revision. It covered workspace type checks, all existing unit
tests, the town validation test, and the WebGPU-only boundary test.

Ports `3010`, `3011`, and `9322` were free before launch. The first sandboxed launch was rejected by
the execution sandbox with `EPERM` while Next.js tried to bind `0.0.0.0:3010`. This attempt is
classified as `TRANSIENT`: the same revision started outside the network sandbox. It also exposed a
real Slice 00 requirement. The shipped host must bind to `127.0.0.1`.

## Current reference

The reference command was:

```sh
npm run dev:demos -- town-study
```

The route was `http://127.0.0.1:3010/demos/town-study`.

- Next.js reported ready in `1088 ms` after its process started.
- The first HTTP request returned status `200` in `2267 ms`, including initial route compilation.
- Chrome reached the town's `running` phase in `4572 ms` after target creation and activation.
- The ready runtime had a `694 x 512` canvas.
- The HUD reported `1,247` instances and `16` draw calls.
- The town showed the existing golden-hour voxel scene. No visual difference is approved.
- [`captures/baseline-town-ready.png`](captures/baseline-town-ready.png) is the primary visual
  reference. Its SHA-256 is
  `f467cdf38f1804aad11ed66fbf294612354dae6e1f7e7796d7dac093a13024d9`.
- [`captures/baseline-town.png`](captures/baseline-town.png) records the initial loading state. Its
  SHA-256 is `7ac4058bacb806e12f33c7163802f1669b063378f561602ff932f28118f447aa`.

The complete verifier must compare reachability, ready state, canvas presence, instance count, draw
count, and a final capture with this reference. Pixel identity is not required because animation and
the responsive viewport change the frame. The town composition and existing visible controls must
remain available.

## Current update, failure, and cleanup behavior

- Touching `packages/demos/src/react/LiveDemoStage.tsx` caused a Next.js update in `147 ms`.
- The current website command compiles shaders once before launch. It does not keep a shader watcher
  alive.
- A second launch on port `3010` failed with `EADDRINUSE` only after shader generation ran.
- The current wrapper returned exit status `0` for that busy-port failure. Slice 00 must replace this
  with a stable nonzero rejection before any partial session starts.
- Interrupting the primary command released port `3010`.
- Ports `3010`, `3011`, and `9322` were all released after cleanup.
- Shader generation normalized two generated WGSL expressions without changing their meaning. The
  refreshed generated files are part of this checkpoint so later clean launches do not create
  untracked drift.

## Capability inventory

| Need | Current source and proof | Decision |
| --- | --- | --- |
| Semantic inspection | `packages/framework/src/index.ts` exports no capability | `CREATE` |
| Browser runtime facts | `LiveDemoStage` keeps phase and measurements in React state | `EXTEND` |
| Game host | The current website and `town-study` route passed the reference run | `USE` |
| Development supervision | The current scripts forward one child and lose the busy-port exit code | `CREATE` |
| MCP adapter | No package or adapter exists | `CREATE` |
| Studio UI | No Slice 00 panel is approved | `DEFER` |
| WebGPU Inspector | Owner direction prohibits integration | `DEFER` |

## Engineering choices

Two inspection-store designs were compared:

1. Put mutable browser facts directly on the CLI host. This is small initially, but it makes the CLI
   own engine meaning and gives direct tests a second source.
2. Add a headless immutable store to `@antiky/framework`, then let the browser publish snapshots and
   the CLI transport them. This keeps one semantic source for direct, CLI, MCP, and Studio-compatible
   clients.

The run selected option 2 because it preserves the accepted ownership boundary and hides cloning,
validation, ordering, and subscription behavior behind one narrow module.

Two MCP designs were compared:

1. Add `@modelcontextprotocol/sdk@1.30.0`. Its package metadata adds a broad server, client, HTTP,
   authentication, and schema dependency tree that Slice 00 does not use.
2. Implement the required 2025-11-25 newline-delimited stdio adapter over the existing typed host
   client. Limit it to initialize, resource discovery and reads, tool discovery, reload, and capture.

The run selected option 2. It adds no runtime dependency and keeps protocol translation separate
from engine facts. Protocol and fixture-client tests must prove the selected subset. The local HTTP
service is not advertised as a general MCP transport.

Use Node.js built-ins for HTTP, process supervision, cryptographic credentials, file watching, and
tests. Use the existing Next.js host and BroMetal shader compiler. Do not add a bundler, web server
framework, browser library, or WebGPU inspector dependency.

## Permission, retry, and rollback rules

The run can change repository files, start owned local processes, bind the named loopback ports, and
use the installed local browser. It has no production, deployment, external-message, or secret
authority. The only external read was package and protocol metadata used to select the MCP approach.

Retry one attempt only when a failure is classified as `TRANSIENT` and health checks show that the
setup is unchanged. Do not retry deterministic defects, expected rejections, stale evidence, or
authority blocks. Use the latest passing checkpoint commit as the last-known-good revision.

The software rollback is a new corrective or revert commit. It must preserve shared history. Slice
00 adds no saved-data migration. A rollback stops all owned processes, removes the session descriptor,
and restores the prior CLI/config schema as one tested unit.
