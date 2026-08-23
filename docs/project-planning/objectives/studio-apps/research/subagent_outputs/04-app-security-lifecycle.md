# 04 - Loading, authority, lifecycle, and security boundaries

## Evidence labels

- **Established** - accepted ADR, current repository code, or primary platform specification.
- **Claimed** - documented in an in-progress architecture guide but not fully established by accepted ADR or implementation.
- **Inferred** - conclusion drawn from established evidence.
- **Unverifiable** - requires an owner decision, prototype, or runtime security test.

## Findings

The extension model cannot safely treat every “app” as one trust class.

- **Established:** Studio UI code is intentionally portable and separated from native authority by narrow host adapters. `EditorHost` currently exposes only project selection, validation, activation, and recent-project operations; it does not expose arbitrary files, processes, network access, or Tauri invocation (`packages/studio/app/src/editor/types.ts:47-56`; `docs/adr/studio/0002-tauri-portable-web-editor_H.md:24-44`).
- **Established:** CLI project services, not Studio panels or app code, own project process, build, game-host, inspection, MCP, and cleanup authority (`docs/adr/cli/0002-supply-cli-project-services-through-a-library-api_H.md:20-66`; `docs/adr/cli/0003-make-cli-project-services-the-development-authority_H.md:21-71`).
- **Inferred:** Built-in and Studio-bundled JavaScript loaded into the main document are fully trusted code. TypeScript interfaces and dynamic imports organize code but do not create a security boundary.
- **Inferred:** A project-local declarative contribution can remain untrusted data if Studio validates it before rendering it with trusted components. Project-local executable code needs a separate trust decision and, by default, an isolated realm plus serialized, revocable capabilities.
- **Established:** Opening a project already causes configured project commands to execute with the current user’s operating-system authority. `shell: false` avoids shell interpretation, but the executable can still access files, processes, and networks available to that user and inherits the project-service environment (`packages/cli/src/project.ts:20-39,146-186`; `packages/cli/src/host/session.ts:614-665,668-699`).
- **Inferred:** Existing authority to run a project’s development command does not automatically authorize project code to execute in Studio’s privileged DOM realm, call Tauri, read Studio state, or receive provider credentials.
- **Established:** Framework ADRs already require serialized schemas at process, worker, network, storage, and trust boundaries. Direct typed values are allowed only within one permission level and process (`docs/adr/framework/0010-serialize-at-boundaries_H.md:18-48`).

## Current authority boundaries

```text
Studio panel
  -> portable typed host/client
     -> bounded Tauri command or authenticated loopback request
        -> project-service lifecycle authority
           -> game host / inspection / configured project processes
```

- **Established:** Project selection is serialized by a queue and monotonic selection ID. The new source is parsed and path-validated before native activation; it is published only after activation succeeds (`packages/studio/app/src/editor/projectManager.ts:81-149`).
- **Established:** Tauri stages pending, prepared, and active project state and verifies selection ID, canonical path, and revision at validation and activation (`packages/studio/tauri/src/project.rs:62-170`). Manifest reads are bounded to 64 KiB, reject symlink manifests, use `O_NOFOLLOW`, and canonicalize project-relative working directories inside the project root (`packages/studio/tauri/src/project.rs:216-359`).
- **Established:** Development state is keyed by manifest path and revision. React cleanup stops the old coordinator and requests native project-service stop; coordinator generations discard stale asynchronous results (`packages/studio/app/src/development/useStudioDevelopment.ts:47-97`; `packages/studio/app/src/development/coordinator.ts:137-221,263-384`).
- **Established:** The native development host launches only the packaged runtime and packaged project-service worker, bounds its first message to 8 KiB, validates session revision and owner PID, uses startup/stop timeouts, and kills the worker if graceful stop fails (`packages/studio/tauri/src/development.rs:13-19,55-148,236-344`).
- **Established:** Current Tauri capability configuration grants the main window only enumerated project, development, terminal, event, and fullscreen permissions (`packages/studio/tauri/capabilities/main.json:1-26`). Tauri runtime authority evaluates commands against webview origin, capability, and scope; remote origins are not enabled automatically ([Tauri capabilities](https://v2.tauri.app/security/capabilities/), [runtime authority](https://v2.tauri.app/security/runtime-authority/)).
- **Established:** The live game runs in a loopback cross-origin iframe with `sandbox="allow-same-origin allow-scripts allow-pointer-lock"`, no referrer, and a limited feature allowlist including WebGPU (`packages/studio/app/src/components/LiveGameFrame.tsx:10-19`).
- **Established:** The game host disposes its instance on `pagehide`, cancels animation, disconnects inspection, and stops scheduling after a frame/start fault (`packages/cli/src/host/game-server.ts:448-529`).
- **Established:** The game-host response sets `nosniff` and `no-store`, but no CSP or Permissions-Policy header (`packages/cli/src/host/game-server.ts:613-663`). Therefore, the parent Studio CSP controls whether the frame may load, but does not constrain the child document’s own outbound connections.
- **Established:** Any script executing at the exact game origin can call `/v1/browser/bootstrap` and receive the development-session credential. Other inspection routes require that credential (`packages/cli/src/host/inspection-server.ts:324-399`).
- **Inferred:** A future project-local app served from the game origin would receive the same origin-level privilege unless it uses a distinct origin or the credential endpoint gains a narrower identity model.
- **Established:** Studio’s privileged main document currently loads `https://usessps.com/ssps.js` by default in native mode, and its CSP explicitly permits that script and its WebSocket endpoint (`packages/studio/app/src/sspsPresence.ts:1-4,54-69`; `packages/studio/app/src/main.tsx:28-34`; `packages/studio/tauri/tauri.conf.json:27-30`).
- **Inferred:** That remote script executes with the main document’s DOM/global authority. Because Tauri ACLs distinguish webviews/origins rather than individual scripts, it should be treated as privileged main-realm code. Whether it can successfully invoke every page-permitted Tauri command needs a threat test.

## Trust tiers

| Tier | Source and loading | Trust consequence | Suitable first use |
| --- | --- | --- | --- |
| **0 - Built-in core** | Statically shipped Studio code in the main realm. | **Established/Inferred:** Fully trusted. A fault or infinite loop can affect the complete Studio UI. Native access must still stay behind host adapters. | Existing workspace, host adapters, core services. |
| **1 - Studio-bundled app** | App code included and versioned with the Studio distribution, loaded statically or with `import()`. | **Inferred:** If loaded in the main realm it has the same effective authority as core, regardless of API typing. “Bundled” is provenance, not isolation. | First-party apps reviewed and released with Studio. |
| **2 - Project-local declarative contribution** | Strict JSON-like data validated before any project app code runs; trusted Studio components render it. | **Inferred:** Can be treated as untrusted input if it cannot contain executable URLs, HTML, event handlers, or unrestricted command arguments. | Panel metadata, commands that map to known host operations, workspace suggestions, asset references. |
| **3 - Project-local executable app** | JavaScript supplied by the opened project. | **Inferred:** Potentially malicious, stale, or accidental-faulting. It must not be imported into the privileged Studio realm by default. Use a worker, cross-origin sandboxed iframe, or process boundary with a serialized broker. | Only if real proving apps cannot be expressed as Tier 2 and the owner approves the trust model. |
| **Current remote main-realm exception** | `usessps.com/ssps.js`. | **Established/Inferred:** Remote provenance but Tier-0-equivalent runtime authority inside the main document. | Existing presence integration; needs a security review before the same loading shape is copied. |

No Studio app registry, `StudioApp`, `AppContribution`, activation registry, or app-version contract exists in the inspected packages. Repository search for those terms returned no matches. **Established, repository snapshot.**

## Authority and capability matrix

The following is an **inferred candidate default**, not an accepted app-system decision. It applies existing ADR boundaries to the proposed trust tiers.

| Authority | Built-in core | Studio-bundled app | Project-local declarative | Project-local executable |
| --- | --- | --- | --- | --- |
| Contribute panel or workspace metadata | Direct trusted registration | Validated registration | Validated data | Serialized contribution request |
| Read project identity/revision | Typed current-project projection | Scoped projection | Bounded declared fields | Brokered snapshot tagged with project and revision |
| Read engine/development state | Typed development client | Capability-scoped query client | No direct client | Serialized, capability-scoped query |
| Change engine/world state | Versioned command only | Versioned command only | Known command identifier only | Serialized versioned command with permission and revision checks |
| Direct world, renderer, or BroMetal objects | No panel access | None | None | None |
| WebGPU/canvas | Host/driver-owned surface | Explicit host-owned surface | None | Its own isolated canvas or a serialized render-data boundary |
| Raw Tauri invocation | Native adapter only | None | None | None |
| File access | Bounded host/service operations | Explicit broker only | Validator resolves declared project references | Deny by default; project-root-scoped broker if approved |
| Process or terminal access | Native/project service only | Explicit named operation only | None | Deny by default; never arbitrary command arguments through the UI broker |
| Network access | Shared main-document CSP | Shared CSP; no per-module isolation | None | Deny by default or explicit child CSP/origin allowlist |
| Provider/session secrets | Host-owned only | No direct access | None | None; use capability tokens that cannot be exchanged for broader credentials |
| Persistent state | Core-owned | App-ID/version namespace | Host-owned validated data | Brokered namespace; never ambient local storage shared with Studio |
| Denial-of-service containment | None | None in-process | Host validation limits | Time, message, queue, memory, and restart limits plus a terminable boundary |

The engine rows are already constrained by accepted ADRs: external callers use versioned commands, identity, permission, duplicate, and revision checks (`docs/adr/framework/0007-commands-as-mutation-boundary_H.md:18-60`); sessions own world authority (`docs/adr/framework/0008-engine-session-owns-worlds_H.md:22-51`); Studio and game modules do not receive BroMetal objects (`docs/adr/studio/0007-framework-first-allow-others_H.md:38-59`; `docs/adr/framework/0021-brometal-render-driver-ownership_H.md:29-80`).

## Lifecycle invariants

1. **Validate before evaluation.**
   **Inferred from established manifest behavior:** App identity, source tier, API version, contribution schema, requested capabilities, paths, sizes, and project revision must be accepted before executable code is imported or a realm is created. The current manifest parser rejects unknown/missing fields and incompatible versions (`packages/cli/src/project.ts:81-110,189-263`).

2. **Bind every project-scoped activation to immutable identity.**
   **Inferred:** Use at least app ID/version, host API version, canonical manifest path, manifest revision, development-session ID where applicable, and a monotonically increasing activation generation. Current project and development code already uses selection ID, path/revision, session ID, and generation fencing.

3. **Make activation transactional.**
   **Inferred:** An app contributes nothing visible until activation completes. Partial activation rolls back acquired listeners, timers, observers, message ports, frames, workers, canvases, GPU resources, and broker handles. Framework’s `DisposalScope` already performs idempotent reverse-order disposal, attempts every release after errors, and supports rollback (`packages/framework/src/resources/disposal-scope.ts:21-98`).

4. **Do not let one optional app replace or corrupt the core workspace on failure.**
   **Inferred from the objective constraint:** An app activation fault should leave that app unavailable with a bounded diagnostic while preserving the existing game-editor experience. Whether a future “required project app” may veto project opening needs owner input.

5. **Fence stale asynchronous work.**
   **Inferred from established coordinator behavior:** Every callback and message must be rejected after dispose, project change, revision change, session replacement, or activation-generation change. Checking only app ID is insufficient (`packages/studio/app/src/development/coordinator.ts:159-221,284-305,369-377`).

6. **Stop is idempotent and exhaustive.**
   **Established direction:** CLI lifecycle stop returns the same result on repeated calls and owns all cleanup (`docs/adr/cli/0002-supply-cli-project-services-through-a-library-api_H.md:27-46,58-66`). App cleanup should follow the same rule and continue releasing other resources when one cleanup fails.

7. **Project switching needs a commit boundary.**
   **Established/Inferred:** Candidate project validation must not run app code. Project-local apps activate only after the native project boundary is active. Old project capabilities must be revoked before stale callbacks can affect the new project. The exact ordering of old-app disposal, new-app activation, and rollback requires design because current project code closes the terminal before native activation but publishes the new workspace only after activation (`packages/studio/app/src/editor/projectManager.ts:111-139`; `packages/studio/app/src/editor/useEditorProject.ts:24-39`).

8. **A faulted authority is replaced, not silently resumed.**
   **Established for engine sessions:** A terminal game-code fault rejects later simulation and commands; recovery requires a new session (`docs/adr/framework/0017-stop-engine-session-after-game-code-fault_H.md:28-58`).
   **Inferred for apps:** A worker/frame/process that violates protocol, exceeds limits, or faults during activation should be terminated and recreated rather than reused with possibly corrupted state.

9. **Version skew fails closed.**
   **Established/Inferred:** Serialized boundaries need a versioned schema. Unknown incompatible versions must not partially activate. The current project manifest is exact schema version 1, and accepted ADRs require a new version and migration rules for field changes (`docs/adr/studio/0005-use-one-antiky-project-manifest_H.md:19-67`; `docs/adr/cli/0003-make-cli-project-services-the-development-authority_H.md:37-38,64-72`).

10. **JavaScript module replacement is not disposal.**
    **Established:** HTML module maps cache modules by module key within each `Document` or worker; loading the same resolved module again does not create a fresh instance ([HTML module map](https://html.spec.whatwg.org/multipage/webappapis.html#module-map)).
    **Inferred:** `dispose()` must clean application resources, but a reliable clean replacement requires a new realm, full document reload, or a new versioned URL. Query-string cache busting creates another module instance but does not unload the previous one.

11. **All boundary work is bounded.**
    **Inferred from repository practice and threat model:** Bound descriptor size, messages, contribution count, activation time, queued commands, output, frame work, retries, and shutdown time. Existing precedents include 64 KiB manifests, 8 KiB native worker messages, bounded HTTP bodies, three failed polls before stale state, and native startup/stop timeouts.

## Failure-isolation options

| Boundary | What it isolates | What it does not isolate | Loading and cleanup consequences | Appropriate tier |
| --- | --- | --- | --- | --- |
| **In-process ES module** | Module namespace and ordinary code organization. React error boundaries can contain some render exceptions. | DOM, globals, Tauri bridge exposure, storage, network policy, CPU loop, memory, prototype mutation, and module side effects. | Fast typed calls. No standard module unload; explicit disposal is mandatory. | Built-in and reviewed Studio-bundled only. |
| **Dedicated worker** | New realm/global and no DOM; structured-clone/transfer message boundary; host can terminate it. | Not an OS permission sandbox. Workers can consume CPU/memory and have network APIs; message floods can harm the host. | Good for compute/controller logic. UI remains trusted host UI. Termination discards the worker event loop and queued tasks ([Workers](https://html.spec.whatwg.org/multipage/workers.html#terminate-a-worker)). | Bundled compute; possibly project-local executable with a strict broker. |
| **Cross-origin sandboxed iframe** | Separate origin/realm and DOM tree; sandbox flags constrain navigation and browser features. Supports its own UI and canvas/WebGPU. | OS/process isolation is implementation-specific. A frame can still consume rendering, GPU, CPU, memory, and message capacity. Parent CSP does not become child CSP. | Remove/navigate frame to stop it; use exact-origin `postMessage`, strict schemas, correlation IDs, and rate limits. Host the child on a distinct origin and send its own CSP/Permissions-Policy. | Project-local executable UI. |
| **Separate Tauri webview** | Separate document plus Tauri capability targeting by webview/origin. | Still needs application-level message, resource, and denial-of-service limits. Process separation varies by platform. | More native lifecycle and layout complexity. Current capability uses `windows: ["main"]`; Tauri documents that all webviews in a matching window receive that capability, so a multiwebview design must use `webviews` targeting instead ([Tauri capability reference](https://v2.tauri.app/reference/acl/capability/)). | Only if iframe limitations are proven insufficient; likely requires an ADR. |
| **Sidecar/child process** | Independent crash/kill boundary and serialized IPC. | A normal child inherits the user’s OS permissions, environment, and resource access unless explicitly sandboxed. | Strongest termination boundary, highest packaging and protocol cost. Sanitize environment and add startup/stop limits. | Only for capabilities that truly need native or hard failure separation. |

A Shadow DOM, CSS module, React context, error boundary, TypeScript interface, or import map is not a malicious-code security boundary. **Inferred from browser execution semantics.**

The iframe standard specifically warns that combining `allow-scripts` and `allow-same-origin` is unsafe when the embedded content can be same-origin with its parent, because it may remove its sandbox. A distinct origin is therefore an invariant, not an implementation detail ([HTML iframe sandbox](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox)).

Cross-document messaging must validate the exact origin and payload, avoid `*` for confidential data, and rate-limit message handling because message traffic can amplify denial of service ([HTML cross-document messaging security](https://html.spec.whatwg.org/multipage/web-messaging.html#security-postmsg)).

## CSP and origin implications

- **Established:** Studio’s current CSP has no `worker-src`; CSP3 falls back through `child-src`, `script-src`, and `default-src`. Current same-origin bundled workers may be possible, but blob/data and project-origin workers are not currently authorized by the stated policy ([CSP `worker-src`](https://www.w3.org/TR/CSP3/#directive-worker-src)).
- **Established:** `connect-src` applies to the main document as a whole, not per imported module. Current main-realm code can attempt IPC, any loopback HTTP port, and the SSPS WebSocket permitted by `packages/studio/tauri/tauri.conf.json:27-30` ([CSP `connect-src`](https://www.w3.org/TR/CSP3/#directive-connect-src)).
- **Inferred:** In-process apps cannot receive distinct network permissions through CSP. Per-app network policy requires a broker or a separate document/worker policy.
- **Established:** `frame-src` restricts which child URL the Studio document may load, but does not set the child document’s own `connect-src` or `script-src` ([CSP `frame-src`](https://www.w3.org/TR/CSP3/#directive-frame-src)).
- **Unverifiable:** The degree to which macOS WKWebView places a project iframe or extra webview in a separate operating-system process must be measured on the pinned Tauri/WebKit runtime. Browser-origin isolation should not be described as hard process isolation without that evidence.

## Decisions already settled by accepted ADRs

- **Portable Studio boundary:** Tauri is an adapter for native capabilities; editor behavior remains in portable web code behind a small validated host contract (`docs/adr/studio/0002-tauri-portable-web-editor_H.md:24-44`).
- **Project schema:** One strict `.antiky` manifest uses schema version 1. Adding app discovery fields to it requires a new schema version and migration rules (`docs/adr/studio/0005-use-one-antiky-project-manifest_H.md:19-81`; `docs/adr/cli/0003-make-cli-project-services-the-development-authority_H.md:37-38,64-72`).
- **Project lifecycle authority:** CLI project services own validation, processes, build, game host, inspection, MCP, cleanup, and their idempotent lifecycle handle. Studio UI does not become a filesystem or process authority (`docs/adr/studio/0006-use-cli-project-services-directly_H.md:16-57`; `docs/adr/cli/0002-supply-cli-project-services-through-a-library-api_H.md:20-66`).
- **Engine authority:** `EngineSession` owns world lifecycle and state. External callers use versioned commands with identity, permission, duplicate, and revision checks (`docs/adr/framework/0007-commands-as-mutation-boundary_H.md:18-60`; `docs/adr/framework/0008-engine-session-owns-worlds_H.md:22-51`).
- **Boundary serialization:** Processes, workers, networks, trust boundaries, imports/exports, and durable storage use versioned serialized schemas; live objects, functions, GPU handles, and renderer objects do not cross (`docs/adr/framework/0010-serialize-at-boundaries_H.md:18-48`).
- **Sandbox promotion:** Isolated work does not itself grant permission; applying it rechecks current permissions and revision. Every sandbox needs limits and cleanup rules (`docs/adr/framework/0014-promote-sandbox-commands_H.md:18-41`).
- **Game/render ownership:** The game host owns canvas/platform lifecycle, the game module or render driver owns its renderer resources, and Studio does not inspect or receive renderer/BroMetal objects (`docs/adr/studio/0007-framework-first-allow-others_H.md:20-73`; `docs/adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md:24-76`; `docs/adr/framework/0021-brometal-render-driver-ownership_H.md:29-80`).
- **Terminal engine separation and secrets:** The in-progress Studio guide claims provider keys stay in protected host settings and terminal permission remains separate from engine permission (`docs/architecture/studio/overview_A.md:341-356,374-383`). This agrees with accepted direction but remains **Claimed** until implementation evidence covers app access.

## Decisions needing owner input or a new ADR

| Candidate decision | Needed authority |
| --- | --- |
| Are first-version apps only built-in/bundled, or may projects provide executable Studio app code? | **Owner input first.** This changes the threat model more than any loader choice. |
| Is a project-local first version declarative-only? | **Owner input.** This is the smallest way to support project configuration without adding a code sandbox. |
| What establishes “bundled” provenance: compiled package membership, signed desktop resources, or an allowlisted built-in ID? | **Owner input and likely ADR** if bundled modules load dynamically. No provenance mechanism currently exists. |
| Where is project-local app discovery declared? | **ADR required** if it changes the strict `.antiky` schema; schema v2 and migration rules are already mandatory. |
| Which capability vocabulary exists for panels, engine queries/commands, project files, processes, network, GPU surfaces, and persistence? | **New ADR.** Defaults should be deny-by-default and capability objects must be narrower than `EditorHost`, `DevelopmentClient`, or raw Tauri. |
| Which executable isolation boundary is supported: worker, iframe, separate Tauri webview, or process? | **New ADR** because it fixes serialization, origin, lifecycle, and native ACL boundaries. |
| Can app activation failure prevent a project from opening, or are all project apps optional/degradable? | **Owner input**, then lifecycle contract/ADR. |
| What host/app compatibility rule applies, and is hot replacement supported? | **Owner input/new ADR.** ESM caching means true same-realm replacement cannot be assumed. |
| May project-local apps access the network directly? Which origins and protocols? | **Owner/security decision.** It determines child CSP, broker behavior, and credential exposure. |
| Should project commands inherit the complete Studio/project-service environment? | **CLI security decision/new ADR.** Current behavior can expose any process environment secret to project code. |
| May remote runtime scripts execute in the privileged Studio realm? | **Owner/security decision.** The current SSPS integration is a precedent with supply-chain implications, not a safe plugin boundary. |
| If separate Tauri webviews are used, are capabilities targeted by `webviews` instead of `windows`? | **New native-security ADR/config decision.** Current window-level targeting would be too broad for untrusted webviews. |

## Gaps

- **Established gap:** There is no app identity, contribution schema, registry, compatibility version, capability vocabulary, activation contract, or app-state namespace in current code.
- **Established gap:** The game-host response does not provide CSP or Permissions-Policy headers, so project-origin executable content lacks an explicit outbound network policy.
- **Established gap:** Project commands inherit `...process.env` (`packages/cli/src/host/session.ts:619-633`). No allowlist or secret-stripping policy exists.
- **Established gap:** The main native document permits and loads a remote script. There is no inspected threat test proving which Tauri commands that script can invoke.
- **Established configuration mismatch:** The UI invokes `development_restart` and Rust registers it, but the generated command list and main capability omit `development_restart` / `allow-development-restart` (`packages/studio/app/src/development/native.ts:101-104`; `packages/studio/tauri/src/lib.rs:154-171`; `packages/studio/tauri/build.rs:3-19`; `packages/studio/tauri/capabilities/main.json:7-25`). **Inferred:** restart is likely rejected by the Tauri ACL; a packaged runtime test would confirm it.
- **Claimed/documentation gap:** `docs/architecture/studio/overview_A.md:58-77` still describes Studio attaching to `antiky dev`, while accepted Studio ADR 0006 and current code use a packaged project-service worker. The accepted ADR and implementation should be treated as authoritative.
- **Unverifiable:** No evidence establishes code-signing or integrity verification for future dynamically loaded bundled app modules.
- **Unverifiable:** No resource budgets exist for app activation, CPU, memory, messages, storage, GPU work, or restart storms.
- **Unverifiable:** WKWebView iframe/webview process isolation, crash propagation, worker termination behavior under GPU load, and CSP behavior should be tested on the pinned Tauri/macOS runtime.
- **Unverifiable:** No decision exists for project trust persistence, consent prompts, revocation, or whether trust is keyed by canonical path, revision, app identity, or signer.
- **Unverifiable:** No policy exists for app storage migration, cleanup on uninstall/removal, or whether project switching retains global bundled-app state.

## Planning implications

- Treat an in-process app API as a first-party composition boundary, not a security sandbox.
- Keep project-local contributions declarative unless the owner explicitly authorizes executable project apps and selects an isolation boundary.
- Give apps narrow capability façades and immutable projections. Do not hand them raw `EditorHost`, raw Tauri invocation, full `DevelopmentClient` credentials, world objects, or GPU/BroMetal objects.
- Reuse the repository’s existing lifecycle patterns: path/revision identity, activation generations, stale-result rejection, idempotent stop, reverse-order disposal, rollback, structured diagnostics, and bounded messages.
- Preserve the current two-phase project validation/activation rule: project app code must not run while merely parsing or validating a candidate project.
- Treat app activation and cleanup as project-scoped transactions; revocation must occur even when cleanup throws.
- Any `.antiky` app field implies schema v2 and migration work. It must not be added as an optional version-1 field.
- Add a child CSP/origin policy before treating the existing game-origin iframe shape as a general project-app host.
- Audit environment inheritance and the privileged remote SSPS script before broadening extension execution; both are existing security pressure points that an app system would amplify.
- Verification must include malicious/malformed contributions, stale messages after project switches, activation rollback, cleanup failure, repeated stop, protocol/version mismatch, message floods, infinite-loop recovery where possible, credential non-disclosure, and native ACL checks.
- Public distribution, marketplace policy, billing, and third-party publication remain outside this research.
