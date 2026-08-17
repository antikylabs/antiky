# Demo refining objective summary

The demo refining objective is complete and was archived on 2026-08-17. It turned four visually
deficient Antiky demos into measured, lit, testable projects, narrowed the packaged and public demo
catalog to Antiky work, and established deterministic capture and inspection boundaries. The
completed working folder was removed after this summary was written.

## Delivered outcome

- The packaged and public catalog now contains four Antiky demos: Antiky Town, Combat Arena, Point
  Light Expo, and Traversal Study. The standalone BroMetal and Three.js demo families, their five
  packages, and their publication and test assumptions were removed.
- The demos gained a complete linear rendering path: source color decoding, HDR offscreen targets,
  one display-space tone-map operation, GGX materials, directional ambient light, sun and shadows,
  bloom, and vignette. The four projects apply that stack through their own Antiky game modules.
- Asset conversion preserves UVs and material maps. The repository also gained checked material
  construction, atlas tooling, and live shader and material invariants.
- The Framework gained the capabilities needed by the demos, including render-resource disposal,
  explicit input and random state, engine events and sessions, a BroMetal render driver, and a live
  observer for each completed simulation step.
- BroMetal moved to 0.18.0. Nine local, behavior-tested patches supply the capabilities still absent
  from that release, including discard, presentation, sampling fixes, multisampling, LOD clamps,
  texture arrays, WebGPU perspective depth, and bounded render-target readback.
- Capture now pauses a managed session, advances to an exact completed step, and fences the result by
  development session, build, runtime, engine session, completed-step count, state digest,
  dimensions, and source digest. Four sealed `visual-metrics.json` sidecars are the durable evidence;
  raw capture images are temporary and are not tracked.
- Games own bounded semantic fixture names for scene groups, camera translations, and visual
  variants. The CLI owns validation, transport, and identity fencing. These controls cannot expose
  renderer, browser, process, filesystem, or arbitrary-code authority.
- `npm run demos:verify` owns the live demo graph, material, shader, pipeline, inspection, and sealed
  evidence checks. Discovery is rooted at `packages/demos/antiky` and fails when it is empty or
  includes a package outside the Antiky manifest.

## Durable decisions and boundaries

- An Antiky game can use the Framework's BroMetal-specific `BroMetalRenderDriver` or hand-write its
  BroMetal integration. Hybrid Antiky and BroMetal projects are valid while the Framework grows.
  This objective does not fund a framework-only renderer migration or a general renderer
  abstraction.
- The one-post-tone-map rule and the demo verification contracts apply to Antiky demos. Do not
  restore standalone renderer showcase packages as part of this work.
- A game owns the names and meaning of its capture fixtures. The CLI can select only declared,
  bounded fixtures and owns the session and build fences around them.
- Capture evidence is valid only when its source digest, exact paused-step identity, metrics, and
  seal agree. Publication time and sequence churn are not simulation identity.
- Raw PNGs remain private temporary evidence. The committed sidecars retain the measurement,
  threshold, outcome, artifact hash, and source identity needed for later review.
- Material and shader assertions are part of `demos:verify`, not one-off planning evidence.
- A completed-step observer receives one Framework-owned frozen data graph after each successful
  simulation step. It does not provide replay, history, subscription, rendering, or transport
  authority.

## Important corrections and lessons

- The first luminance-spread metric rewarded brightness and did not prove local visual contrast.
  The objective replaced it with bounded local-contrast and control-pair measurements. A useful
  visual criterion must vary its cause and prove that the instrument responds.
- Several planned visual checks initially measured the wrong region, tolerated blank treatments, or
  did not react when the target feature changed. Those premises were corrected with semantic
  fixtures, exact stepping, paired controls, changed-pixel evidence, and explicit failure results.
- Browser render statistics are refresh-capped. The recorded frame times are upper bounds near one
  display interval, not measured GPU execution costs.
- Goal 19 expected an initial material result of three passes and four failures. The exact current
  command produced one pass and six failures because discovery and TypeScript loading were also
  broken. After those faults were corrected, the registered suite reached seven of seven.
- Deleting the standalone demo families exposed stale package-count, shader-parity, hierarchy, and
  script-collection assumptions. The full repository gate, not the focused deletion checks, found
  those contracts.
- Exact-step evidence depended on the Framework's immutable completed-step observer and game-owned
  semantic fixtures. Freezing caller data alone was insufficient; accepted input is copied into a
  fresh, recursively frozen, data-only graph so accessors, callables, and proxies cannot mutate a
  later step.

## Accepted debt and excluded work

Some visual targets still fail. The sidecars preserve those failures as measured debt; thresholds
were not weakened. Town still misses translucency, bloom, and shadow targets. Combat still misses
the VFX-falloff, translated-camera, and bloom targets. Point Light still misses the VFX-falloff and
translated-camera targets. Traversal still misses the translated-camera, bloom, vignette, and
shadow targets. Reopen a result only when a future Antiky visual objective changes that demo or
deliberately adopts the criterion.

[Goal 17's architecture reconciliation packet](../_deferred/demo-refine-goal-17-adrs/README.md) is
separately preserved as acceptable architecture debt. Current accepted ADRs remain authoritative.
Resume the packet only when one of its recorded triggers occurs; it is not unfinished work in this
archive.

This objective did not add a general replay or scenario runner, arbitrary evaluation, retained step
history, cross-device determinism, or a renderer migration. Goal 16 opened no new upstream pull
requests. Its nine BroMetal patches remain local and verified; their maintained state and retirement
procedure live in the [BroMetal patch ledger](../../upstream/brometal-patch-ledger.md).

## Closeout verification

- `mise exec node@22.14.0 -- npm run demos:verify` passed 73 of 73 checks.
- All four demo packages and typechecks passed: Town 46 Node tests plus 11 Vitest tests, Combat 78,
  Point Light 89, and Traversal 75.
- Repeated exact-step baseline captures compared all 921,600 pixels per demo with zero mean, p99,
  or maximum luminance drift.
- `mise exec node@22.14.0 -- npm run typecheck` exited successfully, including Studio's Rust check.
- `mise exec node@22.14.0 -- npm test` exited successfully. The final run included 112 root tests,
  10 camera tests, all workspaces, the website build and publication checks, 58 Studio application
  tests, 25 Tauri JavaScript tests, 11 Rust unit tests, and 7 native contract tests.
- `mise exec node@22.14.0 -- npm run test:gpu` passed all four real-GPU checks for target readback
  and array textures.
- Manual anti-slop review found no disabled or tautological tests, placeholders, swallowed failures,
  or unexplained suppressions in the closeout changes. The separate structure checker selected an
  incorrect root-only test oracle for this npm workspace; its collection findings are contradicted
  by the executing package and repository commands above.

Future visual work starts as a new Antiky objective with current requirements. It should use the
sealed sidecars and capture contracts as its baseline instead of restoring this plan or the retired
standalone demo scope.
