# Loading, authority, and lifecycle

This document compiles the trust, capability, loading, replacement, and failure-isolation research.
It does not authorize project-local executable code or choose an isolation mechanism.

Evidence labels are **Established**, **Claimed**, **Inferred**, and **Gap** as defined in
[`01-current-state-and-proving-cases.md`](01-current-state-and-proving-cases.md). Full evidence and
primary platform links are retained in
[`04-app-security-lifecycle.md`](subagent_outputs/04-app-security-lifecycle.md).

## One word currently hides several trust models

“Plugin” can mean static first-party composition, validated project data, or executable project
code. Those models have materially different authority and failure behavior.

| Tier | Source | Effective trust | Plausible first use |
| --- | --- | --- | --- |
| Built-in core | Statically shipped Studio code | Full main-realm trust | Existing shell and host services |
| Studio-bundled app | Reviewed code shipped with Studio | Full main-realm trust if imported there | Initial first-party apps |
| Project-local declarative contribution | Strict validated data rendered by trusted Studio code | Untrusted input with bounded meaning | Panel metadata, known commands, workspace suggestions, asset references |
| Project-local executable app | JavaScript supplied by an opened project | Potentially malicious or faulty | Only with an explicit trust decision and isolated, revocable broker |

**Established:** `EditorHost` is deliberately narrow, CLI project services own local project
process/build/host/inspection authority, engine mutation uses versioned commands, and accepted ADRs
require serialized data at process, worker, network, storage, and trust boundaries.

**Inferred:** A TypeScript interface or dynamic `import()` organizes a bundled app but does not
isolate it. Code loaded into Studio's main document can affect the DOM, globals, storage, network,
CPU, memory, and any native bridge exposed to that document.

**Established:** Opening an existing project already starts its configured development command
with the operating-system authority of the user. That does not imply permission for project code
to run in Studio's privileged DOM realm, invoke Tauri, inspect Studio state, or receive credentials.

## Current boundary observations

- **Established:** Project selection validates and stages identity before activation, serializes
  switches, and publishes a new project only after native activation succeeds.
- **Established:** Development work is keyed by manifest path and revision; coordinator generations
  fence stale asynchronous results and cleanup stops the previous connection.
- **Established:** The native development host starts only packaged Antiky runtime/worker resources,
  bounds startup messages, validates session identity, uses timeouts, and kills the worker if
  graceful stop fails.
- **Established:** The live game uses a sandboxed loopback-origin iframe. Its game-host response
  sets `nosniff` and `no-store`, but does not set a child CSP or Permissions Policy.
- **Established:** A script executing at the exact game origin can bootstrap the development
  session credential. A future project app must not accidentally inherit that origin-level power.
- **Established:** Project development commands inherit the project-service environment. That is a
  secrets boundary to audit before any UI broker exposes process control or output.
- **Established:** Studio's privileged main document currently loads the remote SSPS script and
  permits its endpoint in CSP. That code has main-realm provenance and needs separate security
  review; it is not a safe loading precedent for apps.

## Candidate capability posture

This table is an inferred safe default, not an accepted app policy.

| Authority | Bundled app | Declarative project data | Executable project app |
| --- | --- | --- | --- |
| Add panels/workspace metadata | Validated registration | Validated descriptor | Serialized request |
| Read project/development state | Scoped typed projection | Bounded declared fields | Brokered snapshot tagged with project/revision |
| Change engine state | Versioned command | Known command identifier | Serialized versioned command with permission/revision checks |
| Raw world, renderer, BroMetal, or WebGPU objects | No | No | No |
| Raw Tauri invocation | No; use host adapter | No | No |
| Files | Explicit bounded host operation | Validated project references | Deny by default; project-root broker only if approved |
| Processes/terminal | Explicit named operation | No | Deny by default |
| Network | Shared main-document policy | No | Deny or give the isolated child its own allowlist |
| Provider/session secrets | Host-owned only | No | No |
| Persistent state | App-ID/version namespace | Host-owned validated data | Brokered isolated namespace |

**Inferred:** A first-party app API is a composition and change-control boundary, not a malicious
code security boundary. Project-local executable code must not be imported into the main Studio
realm by default.

## Lifecycle invariants

These rules are inferred from current project, coordinator, CLI, and Framework lifecycle behavior:

1. **Validate before evaluation.** Check identity, provenance, API/schema version, requested
   capabilities, paths, sizes, and project revision before importing code or creating a realm.
2. **Bind activation to immutable identity.** Include app ID/version, host API version, canonical
   project identity/revision, session identity when relevant, and a monotonic generation.
3. **Activate transactionally.** Publish no contribution until activation completes; roll back all
   acquired listeners, timers, observers, ports, frames, workers, canvases, GPU resources, and
   broker handles on failure.
4. **Keep core usable after optional-app failure.** A failed app becomes unavailable with a bounded
   diagnostic; it does not replace or corrupt the current game workspace.
5. **Fence stale asynchronous work.** Reject callbacks after disposal, project/revision change,
   session replacement, or activation-generation change.
6. **Make stop idempotent and exhaustive.** Attempt all cleanup in reverse ownership order and
   aggregate failures rather than abandoning later resources.
7. **Give project switching a commit boundary.** Candidate validation runs no app code; old
   capabilities are revoked before stale work can affect the new project.
8. **Replace faulted authority.** A realm that violates protocol or faults during activation is
   terminated and recreated rather than silently resumed.
9. **Fail closed on incompatible versions.** Unknown serialized versions do not partially load.
10. **Do not confuse module caching with disposal.** ESM has no unload operation; clean replacement
    needs explicit cleanup and, where freshness matters, a new realm or document.
11. **Bound all work.** Limit descriptor size, contribution count, messages, activation time,
    queues, retries, output, and shutdown time.

## Failure-isolation choices

No choice is selected here.

| Boundary | Useful isolation | Important limit | Candidate use |
| --- | --- | --- | --- |
| In-process ES module | Module organization; some render failures can use React error boundaries | No security, CPU, memory, DOM, global, storage, or network isolation; no unload | Reviewed first-party apps |
| Dedicated worker | Separate realm, no DOM, serialized messages, host termination | Not an OS sandbox; still has CPU, memory, network, and message-flood risks | Bundled compute; possibly tightly brokered project logic |
| Cross-origin sandboxed iframe | Separate origin/DOM, child CSP and browser feature policy, own UI/canvas | Still consumes browser/GPU resources; message protocol and exact origin required | Project-local executable UI |
| Separate Tauri webview | Capability can target a webview/origin | More native lifecycle/layout complexity; process isolation varies | Only if iframe constraints are proven insufficient |
| Sidecar/child process | Strong crash and kill boundary | Inherits OS user authority unless separately sandboxed; highest packaging/protocol cost | Native work that cannot fit a browser boundary |

**Established:** A sandboxed iframe with scripts must remain on a distinct origin, and
cross-document messages need exact-origin and payload validation. The parent document's CSP does
not become the child's CSP.

## Project schema and architecture pressure

**Established:** `.antiky` schema version 1 is exact and rejects unknown fields. Adding app
discovery or permissions there requires a schema version and migration decision.

**Inferred:** A compiled first-party registry can prove composition without changing the project
schema. It does not answer how independently distributed or project-local apps should be found.

The following choices would require owner input and likely an ADR before implementation:

- executing project-local code at all;
- the provenance/trust signal for independently shipped code;
- app discovery in `.antiky` or another durable source;
- a capability vocabulary that grants file, process, network, or native access;
- a new iframe, worker, webview, or process trust boundary;
- whether an app may veto project opening or only enter a degraded state;
- externally visible app/host compatibility and persisted-state migration rules;
- changes to game-origin credentials, remote main-realm scripts, or Tauri capability topology.

## Security and lifecycle gaps

- **Gap:** The packaged `development_restart` path appears to be implemented and invoked but absent
  from the generated command permission/capability list; a packaged runtime test must establish the
  actual result.
- **Gap:** Graceful application-close cleanup of the development worker and detached descendants is
  not proven.
- **Gap:** The live game child document has no own CSP or Permissions Policy.
- **Gap:** Environment inheritance and credential exposure have not been threat-tested.
- **Gap:** No app identifier, registry, compatibility declaration, capability schema, or app-state
  namespace exists.
- **Gap:** The owner has not decided whether project-local contributions are data-only or may run
  code.
- **Gap:** Failure behavior for a required versus optional app is undefined.

## Planning implications

- Treat version 1 as trusted first-party composition unless the owner explicitly chooses a wider
  trust model.
- Keep project-local contributions declarative until executable code has a real proving case and an
  approved boundary.
- Pass narrow, revocable service façades rather than shell internals or ambient native access.
- Make transactional activation, generation fencing, and exhaustive disposal part of the contract,
  not later hardening.
- Resolve project-switch truth, packaged restart permissions, and application-close cleanup at the
  host seam before apps multiply lifecycle owners.
