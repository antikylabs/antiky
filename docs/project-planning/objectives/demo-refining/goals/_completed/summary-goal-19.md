# Summary — goal 19: make Antiky demo inspection deterministic and keep its assertions live

**Status:** complete

**Completed:** 2026-08-17
**Commits:** `bdd2b2e`, `b5ee715`, `7013d7a`, `b20cd5a`, `b10f9bd`, `3b3b6a1`,
`30619a0`, `e06e3b9`, `3cb24a3`
**Goal file:** [`execute-goal-19.md`](execute-goal-19.md)

## Action needed from the owner

None. The remaining visual-target misses are accepted, measured tech debt under the direction to
close the demo-refining objective and continue with Antiky work. Their durable locations and restart
trigger are listed under **Deferred visual debt**.

## What was delivered

1. The standalone `packages/demos/brometal` and `packages/demos/threejs` families are deleted. Their
   five packages, workspace-lock entries, development and capture aliases, website publication,
   public media, active documentation, and test assumptions are gone. The packaged and public demo
   catalog now contains only `antiky-town`, `combat-arena`, `point-light-expo`, and
   `traversal-study`.
2. The shared demo graph is rooted at `packages/demos/antiky`. It fails on empty or out-of-scope
   discovery, works from nested test processes, and restricts `demoSources(slug)` to one known
   manifest-owned demo.
3. The seven live material assertions run in `npm run demos:verify`. Their helper and test now live
   under `packages/demos/tests/material/`, and the shader-output parity gate verifies the exact four
   manifest-owned Antiky shader packages.
4. Framework and CLI now carry one strict semantic capture-fixture contract. Games declare bounded
   scene groups, camera translations, and named variants. The CLI validates and transports those
   values through the existing development authority without exposing renderer, browser, process,
   filesystem, or arbitrary-code access.
5. Each Antiky game owns its allowed presentation controls. The controls change only presentation;
   tests prove they do not change the simulation digest. Combat, Point Light, and Traversal suppress
   their display-space overlays when the declared scene geometry is suppressed, so the AC-V1
   treatment is a real VFX-only frame.
6. `scripts/shoot-demos.mjs` launches the existing managed runtime, pauses the game, advances to one
   exact completed step, and fences every capture by development session, build, runtime, engine
   session, completed-step count, state digest, dimensions, and source digest. Repeated captures
   compare the stable identity and ignore only publication timing and sequence churn.
7. Capture configuration and image analysis are private focused modules. The orchestration file is
   738 lines after cohesion review; fixture declarations are 92 lines and pixel/control analysis is
   226 lines.
8. Four schema-version-5 `visual-metrics.json` sidecars contain sealed exact-step evidence, baseline
   repeatability, frame-time limitations, AC-V1 and AC-L7 pairs where declared, the Town
   translucency pair, and the required M13 bloom, vignette, and shadow pairs. Raw PNGs remain outside
   the repository under the existing evidence policy.
9. `npm run demos:verify` is a green 73-test infrastructure and evidence gate. Visual target
   outcomes remain explicit `pass` or `fail` data inside the sidecars, so accepting debt does not
   weaken a threshold or turn a miss into a passing measurement.

## What I got wrong

The goal contract said the direct material baseline was three passes and four failures. The exact
command in the current checkout produced one pass and six failures: the shared graph pointed one
directory too shallow, and Node could not load the TypeScript sources without its strip/transform
flags. After the graph and loader command were corrected, the intermediate result was five passes
and two failures. The final registered suite is seven of seven. This summary preserves both the
contract expectation and what execution actually observed.

The first repeated-capture comparison used the complete observation envelope. Publication sequence
and timestamp legitimately change between two captures of the same paused step, so that comparison
reported a false identity mismatch. The stable identity now selects only development session,
accepted build, runtime instance, engine session, completed-step count, and state digest.

The first capture process ran through an npm wrapper. Stopping npm did not reliably stop the child
CLI host and left ports 3010 and 3011 occupied. The script now launches the CLI entry directly in a
process group and sends the group `SIGINT` during cleanup.

The first full repository test after implementation disproved three closeout assumptions. Shader
parity still required at least seven renderer-demo packages, the new material filenames violated the
package hierarchy policy, and the new private capture modules were absent from the script allowlist.
`3cb24a3` made parity derive its exact set from Antiky manifests, moved the material files under a
real domain directory, and registered the two private modules. The next complete repository run
passed.

Two existing renderer-construction suites used `node:module.registerHooks`, which is not exported by
the repository's Node 22.14 toolchain. `30619a0` moved their existing strict BroMetal and virtual
module redirection to `node:module.register` with one shared loader. Both construction suites and
their full packages pass on Node 22.14.

## Traps worth knowing

- `capture_frame` must establish the managed browser before session pause and exact stepping are
  available. The script performs one bootstrap capture, then pauses and steps.
- A first fenced capture can lose a race to the managed browser's build revision. Only the existing
  build, runtime, and dimension stale codes retry, within a four-attempt bound.
- Combat Arena and Traversal Study used dynamic `new URL()` asset expressions that Vite could not
  rewrite in a production bundle. Goal 16 fixed both while producing the prerequisite captures;
  Goal 19's final evidence uses those corrected builds.
- Refresh-capped `get_render_stats` cannot resolve GPU time below one display interval. Sidecars
  label the reported frame time as an upper bound instead of calling it GPU cost.
- The anti-slop structure checker selects the wrong test oracle in this npm monorepo and reports
  many tests as uncollected even though the workspace commands execute them. It also called the two
  imported capture modules orphan scripts. The direct import, root script allowlist, 19/19 capture
  tests, 73/73 demo gate, and full repository run contradict those findings.

## Evidence

| Check | Result |
|---|---|
| Wrong graph root and slug filter, test first | The new graph suite initially failed on wrong root, empty discovery, out-of-scope category, and ignored slug. It now passes 7/7 and the combined graph/pipeline surface passes 30/30. |
| Direct material suite | Contract expected 3 pass / 4 fail. Actual first run was 1 pass / 6 fail; corrected loader and graph produced 5/2; implementation is 7/7. |
| Standalone-demo deletion | Both category trees and all five package names are absent. Website tests/build pass 51/51 and publish four Antiky routes. The Impeccable stale-reference detector returned `[]`. |
| Capture fixture authority | Framework full suite 173/173, CLI focused capture contract 13/13, and Framework/CLI typechecks pass. |
| Capture orchestration and measurement | `scripts/tests/shoot-demos.test.mjs` passes 19/19, including exact stepping, stale-target rejection, stable identity, changed-pixel evidence, threshold-failure preservation, source digest, and sealed sidecars. |
| Deterministic baseline | Every demo compares 921,600 pixels across two captures of one paused identity. Mean, p99, and maximum absolute luminance difference are all exactly 0. |
| Frame time | Town 8.303 ms, Combat 8.333 ms, Point Light 8.786 ms, Traversal 8.333 ms. Each is explicitly a refresh-capped upper bound. |
| Visual inspection | The baseline and all treatment frames in `/tmp/antiky-goal19-final/` were inspected. Baselines are populated intended scenes; VFX-only and variant treatments are intentional controlled frames, not blank or error output. |
| Four demo packages | Town 46/46 plus Vitest 11/11; Combat 78/78; Point Light 89/89; Traversal 75/75. All four typechecks pass. |
| Live Antiky verification | `mise exec node@22.14.0 -- npm run demos:verify` passes 73/73. |
| Workspace typecheck | `mise exec node@22.14.0 -- npm run typecheck` exits 0, including Studio's Rust check. |
| Repository gate | `mise exec node@22.14.0 -- npm test` exits 0: root 112/112, camera 10/10, all workspaces, website build/publication, Studio app 58/58, Tauri JavaScript 25/25, Rust unit 11/11, and native contract 7/7. |
| Anti-slop review | Manual review found no disabled or tautological tests, placeholders, swallowed failures, or unexplained suppressions in Goal 19 changes. The repository has no installed Oxlint anti-slop plugin. The structure checker's monorepo and imported-module findings are contradicted by the named executing commands above. |

## Measured control outcomes

| Demo | Criterion | Result | Measurement |
|---|---|---|---|
| Town | Tree translucency | Fail | 7.28% of the region changed; on/off luminance ratio 1.005 against 1.4. |
| Town | Bloom | Fail | 9.08% changed; on/off ratio 1.002 against 1.2. |
| Town | Vignette | Pass | Corner attenuation 11.46%, inside the 10–25% band. |
| Town | Shadow | Fail | On/off ratio 0.792 against a maximum of 0.75. |
| Combat | AC-V1 VFX falloff | Fail | Boundary p99 gradient 0.256 per pixel against 0.1. |
| Combat | AC-L7 translated camera | Fail | Registered p99 difference 0.404 against 0.1 after the known 0.5 m world delta. |
| Combat | Bloom | Fail | On/off ratio 1.187 against 1.2. |
| Combat | Vignette | Pass | Corner attenuation 17.74%, inside the 10–25% band. |
| Combat | Shadow | Pass | On/off ratio 0.662 against a maximum of 0.75. |
| Point Light | AC-V1 VFX falloff | Fail | Boundary p99 gradient 0.617 per pixel against 0.1. |
| Point Light | AC-L7 translated camera | Fail | Registered p99 difference 0.184 against 0.1 after the known 0.5 m world delta. |
| Traversal | AC-V1 VFX falloff | Pass | Boundary p99 gradient 0.0903 per pixel against 0.1. |
| Traversal | AC-L7 translated camera | Fail | Registered p99 difference 0.204 against 0.1 after the known 0.5 m world delta. |
| Traversal | Bloom | Fail | No captured signal: zero changed pixels and an on/off ratio of 1.0. |
| Traversal | Vignette | Fail | Corner attenuation 3.80%, below the 10–25% band. |
| Traversal | Shadow | Fail | On/off ratio 0.997 against a maximum of 0.75. |

## Deferred visual debt

The failed rows above are accepted debt, not hidden failures. The durable evidence is in each
Antiky demo's `visual-metrics.json`, including region, fixtures, artifact hashes, threshold, value,
and outcome. Reopen them only when a future Antiky visual-quality objective changes one of the four
demos or intentionally adopts these criteria. Do not reopen the retired standalone demo scope.

## What this unblocks

- The demo-refining objective can be archived. Its only remaining architecture packet, Goal 17, is
  already preserved separately as accepted deferred debt.
- Future Antiky work can capture a known paused simulation step, apply only game-owned semantic
  presentation controls, and compare exact sealed evidence without reviving the deleted renderer
  showcase families.

## What remains blocked

Nothing blocks Goal 19 or objective closeout.
