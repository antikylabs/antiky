# Execute goal 19: make Antiky demo inspection deterministic and keep its assertions live

## Prerequisites

- [Goal 99](execute-goal-99.md) is complete. This goal delivers A9, M13, M15, M16, U5,
  and G4 from its [summary](summary-goal-99.md).
- [Goal 18](execute-goal-18.md) is complete. This goal needs one observation for every
  completed fixed step.
- [Goal 16](execute-goal-16.md) is complete. Its BroMetal, dependency-lock, demo-package,
  capture, and committed-sidecar file lock is free.
- Reuse the existing CLI development authority, managed capture runtime, evidence store, pause/step
  actions, and capture identities. Do not create a second browser or evidence service.

### Needed from the owner before starting

None. On 2026-08-16, the owner decided that the packaged demo catalog contains only Antiky demos.
Delete the standalone Three.js and BroMetal demo families. Apply the one-post-pass tone-map
invariant only to Antiky demos. Antiky demos may continue to use BroMetal while framework rendering
capabilities grow; that hybrid implementation is in scope and is not a standalone BroMetal demo.

## `/goal` objective

Narrow the packaged demo surface to Antiky projects and turn their verification loop into a
repeatable inspection instrument. The current still-capture script cannot pause or step a
simulation, select a game-owned capture fixture, translate a camera, or suppress scene geometry.
The shared shader-discovery helper also points at `packages/demos/tests` instead of the Antiky demo
root, so `demos:verify` discovers no demos and the standalone material suite passes only three of
seven tests.

This goal delivers the capture and test-surface routes in
[`execute-goal-99.md:70-80`](execute-goal-99.md), the missing probes at
[`execute-goal-99.md:75-76`](execute-goal-99.md), and the capture protocols from
[`execute-goal-08.md:290-349`](execute-goal-08.md).

## Required outcome

When the work is complete, the repository must have:

1. no `packages/demos/threejs` or `packages/demos/brometal` tree and no package, workspace-lock,
   development alias, capture alias, website-publication, user-documentation, or test reference
   that still presents any deleted standalone demo as part of Antiky;
2. `scripts/shoot-demos.mjs` able to pause, advance to an exact completed step, and capture against
   the resulting session ID, step ID, state digest, build, runtime, dimensions, and source digest;
3. one strict game-owned capture-fixture contract for bounded scene visibility and camera
   translation controls, routed through the CLI development authority without arbitrary script
   execution or renderer-object access;
4. repeated fixed-step captures that prove comparable identities and bounded pixel/probe drift;
5. executable AC-V1 VFX-only, AC-L7 translated-camera, and tree-translucency control pairs for the
   demos that declare those criteria;
6. the exact missing M13 frame-time, bloom-halo, vignette-corner, and shadow probes measured where
   the originating goal required them, with unsupported measurements reported honestly;
7. the shared demo graph rooted at `packages/demos/antiky`, a working slug filter, and tests that
   fail if Antiky discovery becomes empty or the filter scans another demo;
8. every still-live Antiky assertion from `material-invariants.test.mjs` moved into the registered
   `demos:verify` surface, with obsolete duplicates deleted; and
9. `npm run demos:verify` reporting only owner-approved Antiky visual target failures, never
   discovery, loader, stale-sidecar, or deleted-demo-scope defects.

## In scope

- **Deterministic still capture.** Own `scripts/shoot-demos.mjs`, its tests, and the smallest CLI
  capture/control adapters needed to compose existing pause, step, capture, and evidence services.
- **Antiky-only demo catalog.** Delete `packages/demos/threejs/**` and
  `packages/demos/brometal/**`. Remove their entries from the root workspace lock, development and
  capture scripts, website publication and presentation data, repository documentation, and tests.
  Keep `packages/demos/antiky/**` even where a demo still uses BroMetal internally.
- **Capture fixtures.** Each game owns semantic fixture names and bounded values. The CLI owns
  validation, authority, observation fencing, and transport. A fixture can toggle declared scene
  groups or apply a declared camera delta; it cannot expose a raw renderer, function, path, or code
  string.
- **Measurement completion.** Implement only the named M13 and Goal 08 control pairs. Do not reopen
  every metric or art target.
- **Live test surface.** Own `packages/demos/tests/shader/graph.mjs`,
  `pipeline-invariants.test.mjs`, `material-invariants.test.mjs`, and their direct helper tests.
  Fix G4 by making `demoSources(slug)` restrict discovery to one Antiky demo.
- **Tone-map scope.** Apply the one-post-pass invariant to Antiky demos only. A demo remains in
  scope when it uses Framework and BroMetal together; renderer migration does not determine
  whether it is an Antiky demo.
- **Evidence.** Own affected `visual-metrics.json` sidecars and the private local capture receipts
  used to derive them.

## Required tests and evidence

At minimum, prove:

- the two standalone category trees are absent, their five package names are absent from
  `package-lock.json`, and no development alias, capture alias, website publication entry, public
  demo registry, or active test expects their five slugs;
- demo discovery finds every manifest-owned Antiky demo from the repository root and from a nested
  test process, rejects out-of-scope categories, and fails on an intentionally wrong root rather
  than returning an empty success;
- `demoSources('combat-arena')` reads only Combat Arena while an unknown slug returns a named error;
- the migrated Antiky material assertions fail when their real behavior is broken and cannot pass
  by discovering zero demos, shaders, models, pulses, or batches;
- pause plus exact step produces the requested completed-step count and digest before capture, and a
  stale step/build/runtime request fails with the existing structured error;
- two captures from the same build, seed, fixture, camera, and completed step agree on observation
  identity and remain within a declared pixel/probe repeatability bound;
- scene suppression affects only declared scene groups, camera translation is exactly the requested
  world delta, and neither control changes authoritative simulation state;
- AC-V1, AC-L7, and the translucency on/off pair each produce the two intended captures and a
  non-vacuous measurement over the named region;
- the M13 probes state actual values or the exact instrument limitation; refresh-capped frame time
  is a bound, not a fabricated measurement;
- `node --test packages/demos/tests/material-invariants.test.mjs` is no longer a forgotten red test
  because the live assertions are registered elsewhere or the obsolete file is deleted;
- `npm test` exits zero and `npm run demos:verify` has no infrastructure or stale-evidence failure;
  and
- every changed visual sidecar comes from a capture a person or agent actually inspected.

## Explicit non-goals

- Do not build deterministic gameplay replay, a general scenario runner, a browser automation API,
  arbitrary JavaScript evaluation, OS input, desktop capture, or a second evidence store.
- Do not remove BroMetal itself, the `BroMetalRenderDriver`, or any BroMetal patch still needed by an
  Antiky demo. Do not convert hybrid Antiky/BroMetal demos to framework-only rendering in this goal.
- Do not preserve, relocate, or replace the standalone Three.js and BroMetal demos inside the
  package. Their deletion is the product decision, not a migration project.
- Do not change M12's traversal composition or value targets, add concave AO, build fountain VFX,
  or make another art-direction decision.
- Do not make a metrics suite green by weakening a threshold, deleting a live Antiky assertion, or
  omitting an Antiky demo from discovery.
- Do not expose BroMetal, WebGPU, DOM, Playwright, process, or filesystem objects through Framework,
  MCP, or fixture input.
- Do not claim repeatable capture is cross-device deterministic rendering.

## Engineering constraints

- Follow `AGENTS.md`, `docs/GOOD_ENGINEERING_H.md`, the existing inspection-tooling goal 03
  boundaries, and accepted Framework/CLI ADRs.
- Write a failing regression for the wrong graph root and ignored slug before fixing either. Preserve
  the current 3-pass/4-fail material-suite output in the goal summary as the baseline.
- Use one deep capture-fixture contract rather than tool-specific toggles. Keep game-owned semantic
  names local to the game.
- Keep private evidence under the existing bounded retention policy. Commit metrics sidecars, not
  raw captured PNGs.
- Make short focused commits without coauthor tags and preserve unrelated worktree changes.

## Completion definition

The goal is complete only when the package and public demo catalog contain Antiky demos alone, the
capture script can produce observation-fenced fixed-step and declared-control pairs for them, the
named visual criteria and probes are measurable, Antiky discovery and slug filtering are proven
non-vacuous, all live Antiky material assertions run in the normal verification surface, and test
output contains no infrastructure or stale-sidecar failures.

If the required scene or camera control would bypass game authority, expose renderer internals, or
require arbitrary evaluation, stop and report the missing typed game boundary. Do not trade a
trustworthy inspection surface for a convenient hidden back door.
