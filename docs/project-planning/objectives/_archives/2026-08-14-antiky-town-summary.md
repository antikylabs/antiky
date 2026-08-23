# Antiky Town legacy objective summary

The first Antiky Town objective was retired on 2026-08-14. It was not completed against its
open-ended gameplay roadmap. The owner chose to close the stale working arc after the repository,
game project, and Framework architecture had changed substantially, and to plan future Town work
from the current state instead.

The objective delivered and verified Slices 00 through 02. Its original Slice 03 and Slice 04 plans
were superseded before implementation. The working folder was removed after this summary was
written so that those old plans cannot be mistaken for current direction.

## Delivered outcome

- Added the first Antiky development runtime. `antiky dev` could start and supervise the Town,
  publish structured runtime facts, support direct, CLI, MCP, and Studio-compatible clients, and
  clean up its owned processes and ports.
- Added the Framework inspection contract and separated semantic engine measurements from
  development-host measurements. Local inspection used versioned, bounded data instead of terminal
  text, DOM state, or BroMetal objects.
- Established Antiky Town as a standalone game project and made `Market Lamp West 01` its first
  complete Framework-backed behavior. The lamp has a stable entity ID, validated point-light data,
  command handling, bounded accepted-event history, separate authoring/runtime/render projections,
  structured inspection, and correction-based undo.
- Added shared point-light operations to the typed development client and MCP Tools. Accepted,
  rejected, duplicate, stale, unauthorized, and correction requests use the same Framework service
  instead of separate client-specific state.
- Added the first fixed-step `EngineSession`. It owns a `1/60`-second clock, an immutable system
  order, explicit step input, bounded catch-up, pause and resume state, retry-safe single-step
  control, revisions, inspection, and one-time disposal.
- Connected Town simulation to the session clock while keeping presentation work at most once per
  presentation callback. The UI, typed client, CLI, MCP Tools, and Studio-compatible client used
  the same pause, resume, status, and step operations.
- Added Framework-owned generation for world, entity, command, and session IDs. The CLI generator
  delegates to that Framework capability.
- Kept the current implementation and its maintained guidance outside this archive. Antiky Town now
  lives at [`packages/demos/antiky/antiky-town`](../../../../packages/demos/antiky/antiky-town/README.md),
  and the current Framework and CLI documentation is authoritative.

## Verification record

Each completed slice ended with a passing repository check and a passing clean verification run.
The receipts recorded the actual defects found on the way to those results. The closeout does not
preserve the raw receipt tree, because those run-specific paths and commands are no longer the
maintained verification contract.

The work corrected several assumptions and implementation defects during verification:

- Runtime snapshot publication needed serialization so an older, slower publication could not
  replace a newer snapshot.
- Recursive file watching exhausted platform resources and was replaced with bounded polling of
  known authored files.
- Production output initially contained the development inspection bridge; a production-only
  replacement removed it.
- Process shutdown could leave children and a session descriptor behind; lifecycle handling was
  corrected and verified.
- Pausing stopped visible drawing but initially left an empty GPU loop running. The host now stops
  and restarts that loop with the session lifecycle.
- The first single-step rendering path attempted to draw outside BroMetal's supported loop. The
  browser verification found and corrected that path.

## Durable decisions and boundaries

The following rules outlive this objective. The accepted ADRs, not the retired slice plans, control
their current form.

- Game code and game hosts live in different modules. The game project owns rules, state, systems,
  render data, shaders, assets, and its game-module entry. Delivery hosts own canvas and platform
  work. See [Framework ADR 0020](../../../adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md).
- `EngineSession` owns fixed simulation time, ordered work, world authority, and lifecycle. Hosts
  supply platform time and semantic input. Rendering does not decide simulation state.
- External world changes use validated commands. Important accepted changes can become domain
  events; high-frequency simulation and presentation values do not become durable events by
  default. Authoring, runtime, inspection, and render projections remain separate.
- Stable UUIDv7 identifiers cross durable and public boundaries. Numeric render slots and runtime
  indexes are temporary implementation aliases.
- The BroMetal render driver is the default owner of BroMetal programs and GPU resources. Direct
  BroMetal use in a game module is an explicit exception. See
  [Framework ADR 0021](../../../adr/framework/0021-brometal-render-driver-ownership_H.md).
- Physics authority and execution device are separate choices. Rapier is the selected CPU physics
  engine and Nexus is the selected GPU physics engine, each behind a private adapter. A Nexus and
  BroMetal path still requires qualification. See
  [Framework ADR 0018](../../../adr/framework/0018-select-physics-authority-and-execution-independently_H.md)
  and [Framework ADR 0019](../../../adr/framework/0019-use-rapier-for-cpu-physics-and-nexus-for-gpu-physics_H.md).

## What was learned

- A small player-visible slice exposed useful Framework boundaries better than a large engine-first
  plan. The point-light path proved identity, commands, projections, inspection, correction, and
  host integration without requiring a general ECS or registry.
- The fixed session clock was a useful deep boundary. It separated simulation from browser timing
  without adding a scheduler, plugin model, or general host API.
- Verification was most valuable when it tested real lifecycle and browser behavior. It found
  ordering, cleanup, production-exclusion, pause, and GPU-loop defects that headless checks did not
  expose.
- The original roadmap aged faster than the game. Package paths, host ownership, render ownership,
  and the Town reference changed after the first three slices. A long backlog was not a durable
  contract.
- The first Slice 03 plan selected CPU character simulation and proposed publishing the existing
  handwritten motor. The owner rejected that direction in favor of a complete GPU path aligned
  with Nexus and BroMetal. An addendum could record the conflict, but it could not make the old
  executable plan safe. Superseding the whole plan was the correct result.
- Raw run evidence was useful during implementation but is poor durable documentation. Future
  objectives should keep concise summaries and maintained tests, and avoid treating historical
  evidence paths as current instructions.

## What was not done

- The objective did not qualify a Nexus and BroMetal integration, move hero or NPC physics to a
  GPU-resident path, add stable actor inspection, or add `list_actors` and `get_actor`. The original
  Slice 03 was rejected and superseded before implementation.
- The objective did not add its proposed Framework asset registry, deterministic compiled Town
  asset, asset inspection Tools, or stable compiled owner mapping. Slice 04 depended on the rejected
  Slice 03 direction, still needed owner decisions, and never started.
- The unordered backlog did not deliver NPC behavior, Town interaction and selection, a Town asset
  boundary, global illumination, online play, durable simulation history, or a release contract.
  Later work elsewhere in the repository may have advanced some adjacent capabilities, but this
  objective did not deliver them.
- The archive does not preserve obsolete workflow templates, raw receipts, temporary measurements,
  superseded plans, or old package-path instructions. Git history remains available when that
  evidence is needed.

## Follow-on work

Future Antiky Town work must start as a new objective with a bounded player-visible outcome. It must
read the current Town project, current user documentation, accepted ADRs, and completed work from
other objectives before it chooses a plan. It must not restore or execute the retired Slice 03,
Slice 04, or backlog text.

The owner will need to choose the next visible Town result when the replacement objective begins.
If that result still depends on GPU physics, the new objective must recheck current Nexus and
BroMetal versions and qualify their integration before promising the gameplay path.
