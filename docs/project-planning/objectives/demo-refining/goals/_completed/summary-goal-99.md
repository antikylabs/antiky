# Summary — goal 99: close the revisit register and route the remaining work

**Completed:** 2026-08-16
**Commits:** none; this documentation closeout is in the current worktree
**Goal file:** [`execute-goal-99.md`](execute-goal-99.md)

## Action needed from the owner

None. On 2026-08-16, the owner chose an Antiky-only packaged demo catalog. Goal 19 now removes the
standalone BroMetal and Three.js demos and applies the tone-map invariant only to Antiky demos.

The prior art-direction questions are not immediate engineering work. Their triggers remain below.
No agent selected a new frame, visual target, meadow layout, paused-frame behavior, concave AO pass,
or fountain effect during this closeout.

## What was delivered

Goal 99 was replaced as a working register by four bounded contracts:

1. [Goal 16](execute-goal-16.md) owns the BroMetal update, patch necessity checks, two missing
   local patches, and retirement evidence. Upstream submission is deferred.
2. [Goal 17](../../../_deferred/demo-refine-goal-17-adrs/README.md) is deferred as acceptable
   architecture debt with its source audits and restart procedure intact.
3. [Goal 18](execute-goal-18.md) adds the one missing Framework seam: an observation after every
   completed fixed step.
4. [Goal 19](../execute-goal-19.md) repairs demo discovery and the live material-test surface, then
   adds fixed-step, camera, and scene-control capture evidence.

The owner's instruction to produce these four contracts changes Goal 99's old sequencing premise.
Goal 99 is complete when the register has durable routes. The follow-on implementation does not
remain hidden inside this closeout goal.

## Final register disposition

### Final active and deferred routes

| IDs | Final durable route |
|---|---|
| A4 | Goal 18. Add one ordered completed-step observer with zero-, one-, multi-, partial-, and single-step tests. |
| A9, M13, M15, M16, U5, G4 | Goal 19. Remove the standalone demo families, repair Antiky-only discovery and the registered invariant surface, then add observation-fenced fixed-step and declared camera/scene capture controls. |
| A11, U3 | Goal 16. Update from the current pin, prove whether every patch remains necessary, and add local perspective and readback patches when the current release still lacks them. |
| R1 | [Deferred Goal 17 packet](../../../_deferred/demo-refine-goal-17-adrs/README.md). Preserve the 37-error/11-warning/6-info machine result and reopen only through an owner-controlled architecture review. |

### Dormant with one observable trigger and one durable location

| IDs | Trigger and durable location |
|---|---|
| A1 | Reopen measurement-module promotion when a second consumer exists, an MCP consumer needs it, or metrics survive another target revision. Keep the finding in this summary and `docs/project-planning/ideas/executable-requirement-contracts.md`. |
| A2 | Reopen executable requirement contracts when visual, motion, and simulation contracts converge on one shape. Keep the finding in this summary. |
| A5 | Reopen shared sun/fog bindings when one demo varies them at runtime. Keep the finding in this summary. |
| A8 | Reopen `rock-boulder-dry` when a town-material pass directly needs it. Keep the finding in this summary. |
| A10 | Reopen the Point Light Expo renderer when it crosses 500 lines or a cohesion review finds a real split. Keep the finding in this summary. |
| A13 | The convex-rock bake stays withdrawn. Reopen concave AO only when the owner commissions it for Combat Arena or Traversal Study. Keep the finding in this summary and their art-direction briefs. |
| A14 | Reopen `edges.hard` when a lighting-only change produces a false result. Keep its contrast confound in the existing visual-budget comments. |
| A16 | Reopen fountain particles only when the owner commissions Town fountain VFX. Keep the design in Goal 08's summary and the Town art-direction brief. |
| M3 | Add another motion representation only when P1 through P3 leave a named diagnostic gap for a real consumer. Keep the trigger in this summary. |
| M4 | Revisit the 30 fps sequence limit for a named pixel-only defect above its approximately 15 Hz Nyquist limit. Keep the trigger in this summary. |
| M11 | Strengthen the metrics seal only if the threat model expands beyond accidental edits. Keep the trigger in this summary. |
| M12 | Reopen Traversal Study composition or its value contract only when the owner selects one of those directions. Keep the measured conflict in Goal 08's summary and this summary. |
| U1 | Reopen upstream submission when the owner asks to resume BroMetal contributions. Preserve existing pull-request URLs and keep every unsubmitted patch marked honestly until then. |
| U2 | Reopen closed pull request 2 triage only when upstream submission resumes or a current consumer demonstrates a need for one of its remaining general capabilities. Keep this disposition in the Goal 99 summary. |
| S2 | Write a measurement-tooling skill only after Goal 19 settles the capture controls and missing probes. Keep the trigger in this summary. |
| S3 | The skill-library plan remains in `docs/project-planning/objectives/scratch/skill-research/`. It follows that plan's schedule. |
| G2 | Replace Town's final sine hash when the owner permits the resulting meadow-layout change or a new Town art baseline is commissioned. Keep the trigger in this summary. |
| G3 | Revisit Town's paused/faulted presentation when the next Town-host integration goal owns that behavior and the owner selects it. Keep the trigger in this summary. |
| G6 | Revisit Framework's BroMetal dependency if Framework is published or a headless consumer cannot accept the optional render-driver subpath. Keep the trigger in this summary. |
| N1 | Split `town/index.ts` when the next functional change owns that file or an explicit Town-cohesion objective starts. Preserve behavioral fences before the split. |
| N2 | Revisit Traversal Study's ignored parallax input and unused uniforms when a camera or shader goal next owns those files. Keep the trigger in this summary. |
| N3 | Keep the texture-array patch as one contribution unless a future upstream contribution splits. Goal 16 applies this as a patch-ownership constraint. |
| N4 | Revisit the hand-written layer URL list or test-only `atlasGridUniform` only when the atlas layer set changes or a replacement validator exists. Keep the trigger in this summary. |

### Resolved or withdrawn; no new action

| IDs | Final disposition |
|---|---|
| A3, G5 | Closed by Goal 12. Point Light Expo and Town use `BroMetalRenderDriver`, with 3D and 2.3D evidence. |
| A6, M1, M9, M14 | Closed as a general visual-budget dispute. M12 preserves the one remaining demo-specific owner choice. |
| A7 | Withdrawn. The courier uses authored palette/material color; the asset pipeline did not remove a rich character texture. |
| A12 | Closed. Goal 06-04 measured peter-panning at 0.47 px and bounded frame-time cost. |
| A15 | Closed. `sourceDigest` includes shared demo scripts by design. |
| M5 | Closed. The separate Town foliage sun was measured and retained. |
| M2, M6 | Withdrawn. Goal 19 removes the framework-free demo catalog and Glass Garden rather than maintaining visual targets for either. |
| M7 | Withdrawn as work. A metric moving in the preferred direction is not visual proof. |
| M8 | Withdrawn. The proposed normal-map target was not calibrated. |
| M10 | Closed. Test discovery was widened and the retired `town-study` defects are not active work. |
| U4 | Closed by Goals 14 and 15. The layer-based atlas boundary measure is zero. |
| R2 | Closed. Studio ADR 0007 points to Framework ADR 0021 for Framework plus BroMetal. |
| R3 | Closed at `Emerging`. Two of four Antiky demos use the driver; broader proof is necessary before `Current`. |
| R4 | Closed as the Goal 09 umbrella. G4 is routed and N2 is dormant. |
| S1 | Closed. The BroMetal patch, pull-request, update, and retirement workflow exists. |
| G1 | Closed. `town-study` is retired, so no shared-town-code placement decision remains. |

Every original register identifier A1-A16, M1-M16, U1-U5, R1-R4, S1-S3, G1-G6, and N1-N4 appears
above. No active item depends on the completed Goal 99 file as its sole record.

## What I got wrong

The first closeout premise said Goal 99 had to remain the final goal and made seven owner decisions
block routing. The owner clarified the useful outcome: four follow-on contracts and a completed
register. The new sequence records those later decisions inside the work they actually govern.

The old 56/60 demo-verification result was also stale. The current run is 10 passes and 23 failures:
three demo sidecar sets have stale source digests, and `pipeline-invariants.test.mjs` aborts because
the shared graph resolves its root to `packages/demos/tests`. That failure is reproduced and routed
to Goal 19 rather than described as M12 or U5.

## Traps worth knowing

- BroMetal 0.18.0 was published while this register still named only “a newer version.” A version
  claim in a closeout document is evidence to refresh, not durable truth.
- A test with non-vacuity assertions can still be outside the normal script and stay red unnoticed.
  The direct material run catches this: three pass and four fail because it discovers zero demos.
- `demoSources(slug)` accepts an argument that its implementation ignores. A call site that appears
  scoped is not evidence that the scan is scoped.
- The STE linter correctly finds real vocabulary and structure defects, but it also treats several
  software technical nouns and Markdown list structures as findings. Machine and judgment results
  must stay separate.

## Evidence

| Check | Result |
|---|---|
| BroMetal installed/published version | Antiky pins 0.17.2. npm `latest` was 0.18.0 on 2026-08-16. |
| BroMetal pull requests | PR 2 closed without merge. PRs 3, 4, 5, 6, and 7 open. The two Goal 15 patches have no PR URL. |
| BroMetal 0.18.0 source audit | The seven patched capabilities, WebGPU-correct perspective terms, and public target readback remain absent. |
| `node --test packages/demos/tests/material-invariants.test.mjs` | 3 pass, 4 fail. All four failures trace to empty demo discovery. |
| `npm run demos:verify` | 10 pass, 23 fail. Failures are stale sidecars plus the empty-discovery abort; Goal 19 owns both. |
| `npm test` | Exits 1 in `@antiky/studio-tauri`. Its Node suite has 23 passes and 2 failures because `resources/node` cannot load `@rpath/libnode.141.dylib`; `cargo test` therefore does not run. The root script tests, camera-shake tests, and earlier workspaces passed. This independent Studio packaging failure is not assigned to the four demo-refining follow-ons. |
| ADR 0021 STE machine audit | `37 errors, 11 warnings, 6 info`, unchanged, using Issue 9 and `--fail-on never`. |
| ADR 0021 judgment audit | Genuine vocabulary and text-structure defects remain. Several `render`, `state`, `pull request`, and Markdown-list findings require technical-term or parser dismissal. The accepted ADR was not edited. |

## What this unblocks

- Goals 16 and 18 are complete.
- Goal 19 can start; the completed-step seam exists and the BroMetal/demo sidecar file lock is free.
- The demo-refining objective no longer needs Goal 99 as an unbounded live backlog.

## What remains blocked

None. Goal 19's Goal 16 and Goal 18 prerequisites are complete.
