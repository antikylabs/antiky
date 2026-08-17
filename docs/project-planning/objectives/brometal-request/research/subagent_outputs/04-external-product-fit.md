# External product fit and ownership

## Findings

### 1. An external BroMetal user cannot install Antiky Framework today

**Established — released surface.** `@antiky/framework` is not available from npm. The package manifest is private, remains at `0.0.0`, exports TypeScript source files, and has no build or publication script. The shared compiler configuration has `noEmit: true`.

- `packages/framework/package.json:2-17`
- `packages/framework/package.json:19-24`
- `packages/framework/tsconfig.json:1-7`
- `tsconfig.base.json:3-14`

Live checks on 2026-08-14 CDT:

```text
npm view @antiky/framework name version dist-tags --json
→ E404: '@antiky/framework@*' is not in this registry.

gh release list --repo antikylabs/site
→ no releases

gh release list --repo antikylabs/antiky
→ no releases
```

The repository says the same thing: only browser demos and the source workflow work today, all workspaces are private/pre-release, and Framework has no stable package release.

- `README.md:30-33`
- `README.md:82-91`
- `README.md:113-115`
- `README.md:137-149`
- `packages/website/src/app/framework/page.tsx:49-67`

**Established — source availability.** Framework source is MIT-licensed, so a user can inspect, copy, modify, or use it from a checkout.

- `packages/framework/LICENSE.md:1-13`
- `README.md:179-183`

**Inferred.** “Consume today” therefore means clone the Antiky repository and use its workspace/Vite/Node-22 source workflow, or copy selected MIT source. It does not mean `npm install @antiky/framework`. I did not install the folder into an independent consumer project, so local-folder compatibility outside this monorepo remains unverified.

### 2. The current package shape is not a conventional release artifact

**Established.** A dry-run pack of `packages/framework` produced:

```text
packed size:   103,452 bytes
unpacked size: 409,133 bytes
entries:       54
```

It contains raw `.ts` source, tests, test fixtures, API-generation scripts, and `tsconfig.json`. It contains no emitted JavaScript, declaration build, package README, or consumer smoke test. This follows from the absence of a `files` allowlist and build output in the manifest.

**Inferred.** Removing `"private": true` would not by itself make a supported package. A release boundary still needs emitted JS/types or an explicitly supported source-package toolchain, a package README, an intentional file set, packed-artifact testing, versioning, and installation documentation.

### 3. Full Framework adoption does not require CLI or Studio, but it is conceptually much larger than the requested helper

**Established.** Framework has one declared runtime dependency, exact-pinned `brometal@0.17.2`; it does not depend on CLI, Studio, React, Next.js, Playwright, or MCP.

- `packages/framework/package.json:19-24`
- `packages/framework/tests/import-boundary.test.mjs:6-13`
- `packages/framework/tests/import-boundary.test.mjs:27-57`

The observed production dependency tree is:

```text
@antiky/framework
└─ brometal@0.17.2
   ├─ chokidar@4.0.3
   │  └─ readdirp@4.1.2
   └─ typescript@5.9.3
```

For a requester already using exactly BroMetal `0.17.2`, npm can normally deduplicate that renderer tree. A different BroMetal version can produce a second exact-pinned installation. The requester’s actual version and lockfile are unknown.

**Established.** The generated reference exposes 233 Framework symbols across identity, engine sessions, inspection, point lights, game hosting, disposal, randomness, input, game contracts, render contracts, and the local render-driver work.

- `docs/user-facing-docs/api/reference.md:6-36`
- `docs/user-facing-docs/api/reference.md:47-99`

The user guide explicitly permits renderer-only projects to declare a small structural host type and keep Framework out of their dependency graph.

- `docs/user-facing-docs/framework/game-modules.md:85-95`
- `docs/user-facing-docs/studio/renderers.md:17-28`
- `docs/user-facing-docs/studio/renderers.md:63-79`

**Inferred.** Installation cost is modest for an existing BroMetal user, but cognitive and API cost is high relative to “a few dozen transforms, click-to-pick, pan/zoom/follow.” A narrow subpath can hide API breadth from imports, but installing the Framework package still installs its exact BroMetal dependency.

Runtime bundle/tree-shaking cost was not measured and must not be inferred from tarball or on-disk size.

### 4. Antiky has useful ingredients, not a proven externally consumable solution to all three requests

**Established — current public/source ingredients.**

- Stable UUIDv7 entity identity exists: `packages/framework/src/identity/ids.ts:94-100`.
- The host contract supplies semantic pointer position, down/active state, drag deltas, and a click latch: `packages/framework/src/game/contract.ts:20-29`.
- The host/game split keeps raw platform work outside game code: `docs/adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md:24-64`.
- A validated transform value exists, but it is currently a point-light record containing only a 3D position: `packages/framework/src/point-light/records.ts:1-27`, `packages/framework/src/point-light/records.ts:113-126`.
- The accepted world-model direction calls for stable entities, components, systems, queries, and initially simple private maps, while explicitly rejecting a premature general ECS: `docs/adr/framework/0001-entity-component-system_H.md:18-45`.
- Equal 2D/3D/2.3D support and selection across mixed data are accepted requirements: `docs/adr/framework/0004-23d_H.md:12-26`.

**Inferred, pending lines 01–03.** These are ingredients, not yet evidence of a reusable general entity store, complete screen-to-stable-entity picking path, or reusable 2D camera. The other research returns determine exactly how much new code is needed. No packaging finding can turn those ingredients into an external product without a release boundary.

### 5. The render driver should not be made part of this helper’s minimum contract

The issue author explicitly wants a standalone layer that does not touch the render path. ADR 0021 also separates Antiky world/render data from BroMetal objects.

- Issue #8: <https://github.com/ericdrowell/brometal/issues/8>
- `docs/adr/framework/0021-brometal-render-driver-ownership_H.md:29-66`

**Established — local committed branch, not released/public package.** The current local branch contains a `@antiky/framework/render-driver` export. It is deliberately absent from the package barrel.

- `packages/framework/package.json:6-10`
- `packages/framework/src/render/brometal-driver.ts:1-12`
- `packages/framework/src/render/render-contract.ts:1-19`

At the time of this research:

- no demo imports or runs `createBroMetalRenderDriver`;
- the prior objective records the critical demo-migration criterion as unmet;
- the public product taxonomy correctly keeps the driver a Direction claim;
- no remote branch currently contains the driver’s first commit.

Historical evidence:

- The [demo-refining archive](../../../_archives/2026-08-17-demo-refining-summary.md) records the later driver
  delivery and the valid hybrid Antiky/BroMetal boundary. It supersedes this research snapshot's
  unmet demo-migration premise.
- `packages/website/PRODUCT.md:84-96`
- `git branch -r --contains 49fd76b` returned no branch.

**Established — in-flight release gate.** At local HEAD, the generated API reference is already stale:

```text
npm run docs:api:check --workspace @antiky/framework
→ Framework API reference: add descriptions for new exports: PipelineProgram
```

**Established / inferred release risk.** Antiky applies five BroMetal `0.17.2` patches from the repository root’s `postinstall`. The Framework package itself has no postinstall, and a dry-run Framework tarball contains none of those patch modules.

- `package.json:13-17`
- `scripts/patch-brometal.mjs:1-39`
- `scripts/patch-brometal.mjs:105-127`
- `packages/framework/package.json:12-24`

Some driver behavior uses patched target options, including filtering and off-screen multisampling. A future external Framework consumer would receive upstream BroMetal, not Antiky’s patched local installation, unless the patches are released upstream or the distribution design changes. This does not affect a pure entity/picking/camera helper and is another reason not to couple that helper to the driver.

### 6. The issue comment is a claim about future availability, not evidence of current coverage

**Established.** Issue #8 is open. The requester asks whether a separate, opt-in, render-independent helper would be welcome. The only reply is from `shadowcodex`, whose association is `CONTRIBUTOR`, not a maintainer response. It says Antiky is building something similar and plans a weekend release.

**Claimed, not established.**

- “Something similar is already being built” is partially supported by Antiky’s ingredients and direction, but complete coverage depends on research lines 01–03.
- “Provides bits like what you are talking about” is too broad to treat as current product behavior.
- “Planning to release it this weekend” is a future intent. As checked on 2026-08-14 CDT, npm and both release surfaces are empty.
- “Antiky is open source fully” is accurate for Framework’s MIT source, but not literally for every repository package; the root license says the website is source-available rather than MIT (`LICENSE.md:1-8`).

No BroMetal maintainer has yet said whether the proposed companion layer is welcome or who should own it.

## Bounded delivery shapes

| Shape | External dependency/complexity | Fit | Tradeoff |
| --- | --- | --- | --- |
| **A. Candid ecosystem response; no Antiky implementation** | No dependency. Tell the requester what exists, what does not, and welcome their separate helper while coordinating on generic renderer needs. | Highest respect for the requester’s stated ownership and current Antiky release reality. | Does not fulfill the earlier implication that Antiky already supplies the solution. Antiky gains no reusable slice. |
| **B. Proof-first Antiky slice, then narrow Framework subpaths** | Prove entity tracking, CPU picking, and a 2D camera in one focused renderer-independent demo/module. Promote earned boundaries to entries such as `@antiky/framework/spatial-2d`; publish only after the package gate exists. | Best fit with Antiky’s demo-first method, existing identity/host ingredients, and primary product ownership. | The user initially consumes source or waits for the package release. Installing Framework still brings its exact BroMetal dependency even if the helper subpath never imports it. |
| **C. Independent zero-runtime-dependency companion package** | A small package accepts caller-owned IDs, pointer coordinates, bounds, and target positions; its BroMetal example is an adapter, not a dependency. | Closest match to the requester’s “helper, not a framework” description. | Creates another product, version, documentation surface, release workflow, and potential duplication with Framework identity/transforms. Choose only if the owner explicitly wants a separately supported product. |
| **D. Publish the whole Framework as the immediate answer** | 233-symbol product surface, exact BroMetal dependency, source-only package today, release engineering and current red docs gate. | Weakest match to the thin-helper request. | Not a usable current delivery shape. It couples this small need to unrelated release work and still does not prove the three requested capabilities. |

**Inferred recommendation for planning.** If Antiky wants to implement rather than only respond, Shape B is the lowest-regret route: prove one small renderer-independent slice, then decide whether evidence justifies a Framework subpath or Shape C. Do not start by promising the whole Framework or creating a package abstraction before the working cut-point exists.

This follows the project direction to use demos, hand-write missing pieces, classify ownership, and promote incremental reusable slices.

- `docs/VISION_DIRECTION_H.md:31-50`
- `docs/GOOD_ENGINEERING_H.md:5-16`
- `docs/GOOD_ENGINEERING_H.md:47-50`
- `docs/GOOD_ENGINEERING_H.md:69-73`

## Capability ownership matrix

| Capability | Ownership now / proposed | Basis |
| --- | --- | --- |
| Stable durable entity IDs | **Existing Antiky** | Public `createEntityId`; reuse when the caller wants Antiky identity. A standalone package should consider accepting caller-owned IDs to stay thin. |
| Semantic pointer `x/y`, click, down, active, drag | **Existing Antiky** | Game-host contract already supplies it. The helper should accept this data rather than own DOM listeners. |
| General few-dozen entity/transform registry | **New Antiky**, if Antiky implements | Current implemented transform is point-light-specific; ADR 0001 supports simple private maps but is direction, not an existing registry. Confirm against line 01. |
| 2D transform shape and update/query API | **New Antiky**, if not found reusable by line 01 | Do not expose the point-light service as a generic scene API merely because it contains `Transform`. |
| Screen/world coordinate conversion | **New Antiky** | It belongs with a renderer-independent 2D camera/spatial module. Confirm existing ingredients with line 03. |
| Few-dozen object hit testing to stable entity ID | **New Antiky** | Bounded CPU picking is product-level spatial behavior, not BroMetal core. Final algorithm depends on line 02. |
| GPU object-ID/readback primitive | **No action now**; **upstream BroMetal only if proven necessary and renderer-general** | The requester’s scale does not yet justify it. If line 02 proves a missing general renderer primitive, ADR 0021 permits a focused upstream change. |
| Pan/zoom/follow camera and damping policy | **New Antiky** if it serves Antiky games; otherwise requester-owned | Keep camera math separate from BroMetal objects. Confirm reusable current demo code through line 03. |
| Selection state, Studio feedback, inspector UI | **No action for this minimum request** | Click-to-pick does not require adopting the full Studio selection architecture. Add only when an Antiky-owned use case needs it. |
| BroMetal render driver | **Existing Antiky direction/local committed code; no action for this request** | The proposed helper explicitly should not touch rendering. The driver is also unproven and unreleased. |
| Package build, versioning, docs, packed-artifact test, release | **New Antiky** | Required before telling an external user to install any Antiky package. |
| General renderer defect or primitive uncovered by implementation | **Upstream BroMetal** | ADR 0021 requires focused upstream work that helps renderers generally or corrects an error. |
| Canal dashboard application and its product policy | **No action** | Requester-owned; Antiky should provide reusable boundaries, not take ownership of their product. |
| Whether BroMetal welcomes/hosts a companion package | **No action until maintainer direction** | The open issue has no maintainer answer. |

## Owner decisions needed before planning

1. **Commitment:** Is Antiky offering a real externally supported implementation, or correcting the issue reply and encouraging the requester’s own helper?
2. **Product home:** If Antiky implements it, should the earned API become narrow Framework subpaths, or a separately versioned zero-dependency companion?
3. **Release scope:** Is a public pre-release Framework package now an objective? The current source and documentation are not an installable artifact.
4. **Identity coupling:** Must the helper require Antiky UUIDv7 IDs, or accept any caller-owned stable key and offer Antiky IDs as an adapter?
5. **Proof target:** Which Antiky-owned demo/use case proves the same few-dozen-2D-object needs without taking ownership of the requester’s canal project?
6. **Issue communication:** Should the contributor comment be clarified now so “release this weekend” and “already provides” are not read as current availability?
7. **Upstream posture:** Wait for the BroMetal maintainer’s ecosystem answer before proposing any BroMetal-hosted companion. Upstream only a general renderer primitive independently justified by lines 00/02.

## Gaps and dependencies on the other research lines

- **Line 00** can change only the BroMetal/upstream rows: maintainer intent and any already-existing renderer primitive.
- **Line 01** determines whether the general registry/transform rows are genuinely new or can be extracted from reusable current behavior.
- **Line 02** determines the smallest CPU picking boundary and whether any GPU primitive merits upstream work.
- **Line 03** determines how much camera code is reusable versus demo-specific and whether coordinate conversion already has a stable cut-point.
- The requester’s package manager, BroMetal version, bundler, coordinate convention, object shapes, overlap/occlusion expectations, and support expectations are unknown.
- No independent consumer install or bundle measurement was performed; research remained read-only and installed no dependency.
- Live statuses of BroMetal patch pull requests #3–#7 were not refreshed in this line.
- The local render-driver commits are ahead of every remote branch and must not be described as a public source/release surface.
- None of the other research findings can remove the package/release gap without a new publication artifact.
