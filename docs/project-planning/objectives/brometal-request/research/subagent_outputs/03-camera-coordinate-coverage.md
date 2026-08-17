# 03 — Camera and coordinate coverage

## Findings

**Verdict — Inferred from established code:** Antiky has camera ingredients, not a reusable 2D camera. BroMetal 0.17.2 provides a reusable, CPU-only perspective pose/lens/matrix primitive. Antiky supplies normalized pointer input, resize handling, generic render uniforms, and several independently authored follow/damping implementations. No public module composes those parts into orthographic projection, pan, anchored zoom, follow, bounds, and viewport/world conversion.

A previous extraction audit reached the same conclusion: the camera implementations shared idioms
but had not converged into one module. It explicitly rejected promoting them at that time. The
[demo-refining archive](../../../_archives/demo-refining-summary.md) preserves that extraction
boundary.

Status labels below mean:

- **Established** — implemented code, an accepted ADR, or an executable test.
- **Claimed** — documentation or intended architecture not matched by implementation.
- **Inferred** — conclusion drawn from those sources.

## Capability matrix

| Capability | Coverage and evidence | Status |
|---|---|---|
| Projection | Installed BroMetal is 0.17.2 and publicly exports `createCamera` and its types. Lens state is only `fovY`, `near`, and `far`; `viewProjection()` always calls `mat4.perspective`. The public matrix module has perspective and look-at, but no orthographic or inverse operation. `node_modules/brometal/package.json:2-4`; `node_modules/brometal/dist/index.d.ts:11-14`; `node_modules/brometal/dist/camera/camera.d.ts:2-29`; `node_modules/brometal/dist/camera/camera.js:73-90`; `node_modules/brometal/dist/math/mat4.d.ts:11-34` | **Established:** reusable perspective primitive. **Inferred:** no first-class 2D projection. |
| Orthographic 2D | BroMetal’s packaged 2D example says it has no `mat4.orthographic` and writes sixteen floats locally. Town also has a private orthographic helper, but it drives a shadow light, not the player camera. `node_modules/brometal/examples/demos/LegendOfBroDemo.tsx:92-112`; `packages/demos/antiky/antiky-town/src/town/index.ts:112-135,284-292` | **Established:** local examples only. |
| Perspective correctness | BroMetal’s perspective terms use the OpenGL `-1..1` depth convention, and `createCamera` consumes them. Antiky demos document the WebGPU clipping mismatch and locally test a corrected `0..1` light projection. `node_modules/brometal/dist/math/mat4.js:81-89`; `packages/demos/antiky/point-light-expo/src/sun.ts:72-106`; `packages/demos/antiky/point-light-expo/tests/sun.test.ts:146-156` | **Established:** version-sensitive renderer defect in 0.17.2; general upstream candidate. |
| Pan | BroMetal supplies absolute `setPosition`, and the host accumulates normalized `dragX`/`dragY`. Repository search found no camera consumer of either drag field and there is no relative pan, bounds, or controller API. `node_modules/brometal/dist/camera/camera.d.ts:12-18`; `packages/framework/src/game/contract.ts:20-29`; `packages/cli/src/host/game-server.ts:419-438,501-503` | **Established:** primitives. **Inferred:** pan behavior is absent. |
| Zoom | BroMetal can change perspective FOV with `setLens`. Town changes FOV for mode/aspect, not from user zoom. The actual pointer contract has no wheel or pinch value, and no Framework, host, Studio, or demo source handles wheel input. `node_modules/brometal/dist/camera/camera.d.ts:18`; `packages/demos/antiky/antiky-town/src/town/index.ts:235-249,929-932`; `packages/framework/src/game/contract.ts:20-29` | **Established:** FOV setter only. **Inferred:** no 2D scale, clamp, or cursor-anchored zoom. |
| Wheel contract | Generated user documentation says `GamePointerInput` includes wheel input, but its displayed seven-field type and the real implementation contain no wheel field. `docs/user-facing-docs/api/game-contract.md:38-51`; `docs/user-facing-docs/api/game-host.md:38-51`; `packages/framework/scripts/api-reference-content.mjs:632-634`; `packages/framework/src/game/contract.ts:20-29` | **Claimed, contradicted by implementation.** |
| Follow | Traversal, Combat Arena, and Town all follow a player through different game-specific state shapes. Point Light Expo is fixed apart from shake. `packages/demos/antiky/traversal-study/src/presentation.ts:26-87`; `packages/demos/antiky/combat-arena/src/presentation.ts:168-266`; `packages/demos/antiky/antiky-town/src/town/index.ts:898-923`; `packages/demos/antiky/point-light-expo/src/presentation.ts:63-70` | **Established:** several working follow examples. **Inferred:** no reusable target/dead-zone/bounds contract. |
| Damping | Traversal uses frame-rate-independent exponential easing and reset snapping. Combat uses another exponential rate and long-gap reset. Town has a third inline exponential accumulator. `packages/demos/antiky/traversal-study/src/presentation.ts:66-87`; `packages/demos/antiky/combat-arena/src/presentation.ts:105-126,243-253`; `packages/demos/antiky/antiky-town/src/town/index.ts:910-917` | **Established:** proven pattern, separate implementations. |
| Viewport → normalized pointer | The development host maps the canvas CSS box to nominal `[0,1]` coordinates, flips Y upward, and derives drag deltas in that normalized space. The values are not explicitly clamped. `packages/cli/src/host/game-server.ts:419-430` | **Established.** |
| World → viewport | BroMetal exposes the world-to-view and world-to-clip matrices. Antiky tests manually multiply world points by the matrix and divide by clip W. `node_modules/brometal/dist/camera/camera.d.ts:19-27`; `packages/demos/antiky/point-light-expo/tests/presentation.test.ts:31-42`; `packages/demos/antiky/traversal-study/tests/visual/contract.test.ts:48-77` | **Established:** raw math works. **Inferred:** repeated manual code is not a reusable conversion API. |
| Viewport → world | Neither BroMetal Camera nor Framework exposes inverse matrices, unprojection, a screen ray, or plane intersection. BroMetal’s own Star Bro example privately calculates NDC-to-plane coordinates from FOV/aspect and reconstructs a camera basis. `node_modules/brometal/dist/math/mat4.d.ts:11-34`; `node_modules/brometal/examples/demos/StarBroDemo.tsx:319-388` | **Established absence from public APIs.** |
| Camera-relative input | Town has a pure helper that rotates screen-relative movement onto a known world plane from a supplied camera offset. It preserves speed and has headless tests, but it maps a direction rather than a viewport point or ray. `packages/demos/antiky/antiky-town/src/town/camera-relative-movement.ts:15-47`; `packages/demos/antiky/antiky-town/tests/town/camera-relative-movement.test.ts:6-92` | **Established:** useful ingredient, not general conversion. |
| Resize | The host writes drawing-buffer dimensions from CSS size × DPR before frames. BroMetal separately observes CSS resize, owns drawing-buffer sizing, exposes current aspect, and invalidates camera projection when aspect changes. Three.js demos implement a separate tested per-game resize guard. `packages/cli/src/host/game-server.ts:398-404,458-484`; `node_modules/brometal/dist/runtime/webgpu.js:102-140`; `node_modules/brometal/dist/camera/camera.js:73-82`; `packages/demos/threejs/glass-garden/src/resize-guard.ts:1-25`; `packages/demos/threejs/glass-garden/tests/resize-guard.test.ts:7-45` | **Established:** current demos resize. **Inferred:** there is no one camera viewport contract, and canvas sizing currently has more than one writer. |
| Render-target resize | Framework’s driver rebuilds canvas-scaled targets when canvas dimensions change and preserves fixed-size targets. This logic is headlessly tested. `packages/framework/src/render/brometal-driver.ts:183-213`; `packages/framework/tests/render/brometal-driver.test.ts:155-161,348-363` | **Established:** reusable renderer resource behavior, not camera behavior. |
| Ownership | Accepted ADR 0020 gives the host canvas selection, raw events, time, and window-size signals; simulation belongs to `EngineSession` and graphics resources to the render driver. Studio ADR 0007 says the game module initializes/resizes its renderer while the host supplies canvas and input. `docs/adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md:24-61`; `docs/adr/studio/0007-framework-first-allow-others_H.md:20-47` | **Established direction.** **Inferred:** game presentation owns the player camera; host supplies semantic input and size signals. |
| Studio camera | The in-progress Studio architecture specifies separate editor and game cameras, attached/detached modes, focus behavior, and preservation of game-camera state. The current Studio only embeds the game in a sandboxed iframe; there is no editor-camera state or canvas-coordinate bridge. `docs/architecture/studio/overview_A.md:1-13,185-225,385-415`; `packages/studio/app/src/components/LiveGameFrame.tsx:1-20` | **Claimed architecture, not implemented product coverage.** |
| Headless testing | Traversal and Combat camera calculations are pure and tested under Node; Point Light projection tests instantiate BroMetal Camera without a GPU. Town’s directional conversion is pure, though its actual follow regression is a source assertion. `packages/demos/antiky/traversal-study/tests/presentation.test.ts:9-78`; `packages/demos/antiky/combat-arena/tests/presentation.test.ts:22-119`; `packages/demos/antiky/combat-arena/tests/camera-shake.test.mjs:195-317`; `packages/demos/antiky/point-light-expo/tests/presentation.test.ts:127-154`; `packages/demos/antiky/antiky-town/tests/render-interpolation.test.ts:13-26` | **Established:** good unit-level seams. **Gap:** no reusable 2D-camera contract test. |
| Reuse/public surface | Framework’s barrel and package exports contain no camera module. Its render contract can carry number arrays such as a view-projection matrix, but assigns them no camera meaning. Every demo package is private. `packages/framework/src/index.ts:1-18`; `packages/framework/package.json:2-10`; `packages/framework/src/render/render-contract.ts:41-45,109-127`; `packages/demos/antiky/traversal-study/package.json:2-4` | **Established:** no consumable Antiky camera capability. |

## Current implementation shapes

- **Traversal Study** is closest to a reusable rig shape: aspect, player/reset state, pointer, delta time, retained pose vectors, portrait framing, follow, and damping. It remains coupled to `TraversalSnapshot` and a perspective 2.3D composition. `packages/demos/antiky/traversal-study/src/presentation.ts:3-15,26-87`

- **Combat Arena** follows the player, responds to pointer position, supports portrait composition, and damps its pose. Its threat, aim, velocity, dash, and trauma policies are game-specific; reactive motion is deliberately disabled after owner motion-sickness feedback. `packages/demos/antiky/combat-arena/src/presentation.ts:142-159,168-266`

- **Antiky Town** follows the interpolated hero with responsive offsets/FOV and inline damping inside a large renderer module. `packages/demos/antiky/antiky-town/src/town/index.ts:235-249,898-933`

- **Point Light Expo** has a fixed perspective pose with optional danger shake and ignores pointer state for camera placement. `packages/demos/antiky/point-light-expo/src/presentation.ts:63-70`; `packages/demos/antiky/point-light-expo/src/renderer.ts:481-503`

- **Three.js demos** use Three’s own perspective camera and direct pointer-controlled orbit-like poses, not an Antiky camera. `packages/demos/threejs/glass-garden/src/game.ts:66-72,244-275`

Framework ADR 0004 nevertheless requires equal Framework support for 2D, 3D, and 2.3D games and shared rendering contracts. The lack of a reusable orthographic camera is therefore an implementation gap, not evidence that 2D is out of scope. `docs/adr/framework/0004-23d_H.md:12-26`

## Gaps

1. No orthographic player-camera primitive exists in BroMetal or Framework.
2. No public pan, user zoom, follow-target, dead-zone, clamp, bounds, or precedence policy exists.
3. No wheel or pinch semantic input exists; generated documentation incorrectly claims wheel coverage.
4. No world-to-viewport or viewport-to-world API exists. Matrix inversion, screen rays, and plane intersections are missing.
5. BroMetal Camera has no pose or lens getters. A wrapper cannot safely implement relative behavior around an externally mutated Camera unless it retains canonical state itself.
6. The coordinate convention is unstated: CSS pixels versus device pixels, Y direction, world plane, world units per screen unit, and clamping behavior all need explicit contracts.
7. The host and BroMetal both write or own drawing-buffer resize behavior; no explicit viewport-size signal crosses `GameHostContext`.
8. Current follow targets are raw demo-state positions, not a general target resolver or stable entity.
9. Studio’s separate editor camera is architecture only.
10. There is no Framework-owned 2D demo proving pan, zoom, follow, conversion round trips, and resize behavior.
11. BroMetal 0.17.2’s perspective depth convention is a separate correctness defect that should remain visible even if the first 2D camera uses orthographic projection.

## Planning implications

The evidence supports evaluating two bounded delivery shapes:

1. **Renderer-neutral Antiky camera module.** Own canonical 2D camera state and expose explicit viewport, center, zoom, optional follow target, delta time, projection, and conversion operations. Emit plain matrices/values that the existing render contract can carry. Reuse the proven exponential-damping pattern, but do not extract a demo rig wholesale.

2. **General BroMetal math additions plus a thin Antiky controller.** Evaluate upstream `mat4.orthographic`, a correct WebGPU perspective matrix, inversion, and project/unproject helpers because those help renderers generally or correct an error, satisfying ADR 0021. Keep entity targeting, input policy, damping, dead zones, and editor/game ownership in Antiky. `docs/adr/framework/0021-brometal-render-driver-ownership_H.md:29-66`

Before executable planning, the owner must decide:

- fixed orthographic projection versus optional perspective support;
- the 2D world plane and coordinate origin/Y direction;
- programmatic-only zoom versus wheel/pinch input;
- cursor-centered versus camera-centered zoom;
- pan/follow bounds and how manual pan interacts with follow;
- whether follow consumes raw coordinates or resolves an Antiky stable target;
- whether the first proof is an Antiky game camera, the Studio editor camera, or an external-consumer example.

Headless proof should cover screen/world round trips across aspect ratios, pan and zoom anchor invariants, frame-rate-independent damping, follow reset behavior, bounds, and resize. One real 2D demo should prove the renderer integration. Studio editor-camera work should not be counted as existing coverage or made a prerequisite unless the owner selects it as the first consumer.

No files were changed.
