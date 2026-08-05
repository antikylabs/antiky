# ADRs Under Review

These entries describe architecture decisions that Antiky may need. They are discussion drafts, not accepted Architecture Decision Records (ADRs), and they do not control implementation.

Artificial intelligence (AI) produced the suggested directions from architecture review and technical research. Core Contributors must review, change, reject, or approve each direction.

This document can grow faster than the accepted ADR set. An entry stays here until project owners reject it or make and record a decision.

## Draft candidates

### 1. Authoritative physics

**Why this is here:** Antiky has not defined authoritative physics behavior across browsers, runtimes without graphics, saves, replays, and online profiles. **What it helps:** A decision prevents solver details, temporary handles, and inconsistent results from leaking into world semantics. **Summary:** Each applicable world would use one private physics adapter. Runtime world state would receive calculated results, while durable state would retain semantic data only. **AI-suggested direction:** Test Rapier privately for one real 2D or 3D case and authority model. Keep central processing unit results authoritative and graphics processing unit simulation presentational.

### 2. Runtime schema

**Why this is here:** Components, commands, events, tools, and persisted data need compatible runtime definitions before Antiky exposes a public schema. **What it helps:** One contract supports validation, Studio controls, agent tools, storage, compatibility checks, and later migrations. **Summary:** Antiky would own semantic definitions, a restricted JSON Schema subset, an immutable catalog, and unchangeable schema views for each running session. Validator libraries would remain private. **AI-suggested direction:** Prove one real component-and-command path first. Add migrations, plugins, and broader schema types only when a concrete boundary requires them.

### 3. Entity-component-system storage and queries

**Why this is here:** The accepted entity-component-system model does not select a physical storage layout or permanent query implementation. **What it helps:** A boundary preserves stable game meaning while allowing measured performance changes without breaking tools, saves, networking, or rendering. **Summary:** Storage would remain private and map-based. Stable identifiers would map to temporary handles that reject stale references, while physics and rendering retain separate projections. **AI-suggested direction:** Move only measured hot components into specialized typed storage. Keep public queries semantic and keep physical layout replaceable.

### 4. 2.3D depth policy

**Why this is here:** Games that mix 2D and 3D content need consistent depth, transparency, pass order, and selection behavior. **What it helps:** A shared policy prevents visual errors and selection mismatches across browser capabilities and future render backends. **Summary:** Render orchestration would own semantic policy. Render preparation would create stable selection mappings, while the render driver owns graphics resources and backend operations. **AI-suggested direction:** Use cutout surfaces by default and sort transparent objects when blending is necessary. Add more complex transparency methods only after a measured need.

### 5. Studio process and connection

**Why this is here:** Antiky has not selected where Studio engine authority should run as browser, desktop, local, and remote workflows grow. **What it helps:** The decision controls trust, latency, crash isolation, reconnection, and the boundary between editor code and engine authority. **Summary:** Trusted local work can keep authority embedded behind a narrow host. Move authoritative engine state to a separate process when content or workload requires isolation. **AI-suggested direction:** Start embedded for browser and desktop development. Add an authenticated connection when containment, remote access, or workload evidence requires separation.

### 6. Principals and permissions

**Why this is here:** Humans, agents, and future remote clients can share one mutation interface, but caller data cannot grant its own authority. **What it helps:** One authorization model prevents privilege spoofing, limits damage, and produces useful audit evidence. **Summary:** The authority boundary would use default-deny typed grants, scoped roles, typed conditions, permission ceilings, and a trusted actor chain. **AI-suggested direction:** Reauthorize every mutation at the authority boundary. Keep durable audit evidence for durable commands and privileged changes. Bound high-volume security telemetry.

### 7. Sandbox isolation

**Why this is here:** Preview and agent workflows need isolated worlds that cannot mutate the primary world or share temporary runtime identities. **What it helps:** A sandbox contract supports safe experiments, review, conflict detection, and controlled promotion. **Summary:** A sandbox would begin as a complete semantic world clone. It would preserve stable identifiers, rebuild temporary aliases, and share only immutable assets. **AI-suggested direction:** Apply approved sandbox commands through primary authorization. Add shared bases, smaller sandbox copies, or process isolation only after real limits appear.

### 8. Event store and snapshots

**Why this is here:** Durable authoring and recovery need a storage boundary before browser data, hosted data, or online event history becomes important. **What it helps:** The boundary supports export, restore, conformance tests, and backend changes without changing game semantics. **Summary:** A backend-neutral durable store would commit outcomes atomically. Durable snapshots, runtime checkpoints, physics checkpoints, and network snapshots would remain separate contracts. **AI-suggested direction:** Use IndexedDB provisionally for embedded local browser and Tauri profiles, with explicit export and an optional narrow SQLite host adapter. Use PostgreSQL when remote scale requires it.

### 9. Online replication and cross-session handoff

**Why this is here:** Online play leaves replication, prediction, rollback, session placement, and player handoff as separate unresolved decisions. **What it helps:** Clear boundaries protect server authority, reduce correction errors, and make cross-session movement recoverable. **Summary:** Clients would predict only local controlled movement at first. Connections would use temporary connection identifiers, update baselines, and explicit authority generations. **AI-suggested direction:** Create separate decisions for replication, rollback, and placement. Disable old session authority before a new session can accept authoritative input.

### 10. Authoritative server runtime

**Why this is here:** Antiky has not selected the language, process model, or deployment artifact for online authoritative sessions. **What it helps:** The choice affects simulation parity, fault isolation, recovery, operations, and future scale. **Summary:** A pinned Node.js Long-Term Support release would run compiled TypeScript and a WebAssembly physics artifact qualified by the future physics decision. Each session would begin in one process and container. **AI-suggested direction:** Give background jobs explicit time and resource limits, and stop new work before server replacement. Adopt native runtimes or larger deployment platforms only after measured needs.

### 11. Voxel authoring and runtime-asset boundary

**Why this is here:** Voxel source files and AI-generated voxel data should not become permanent runtime or provider contracts. **What it helps:** An owned boundary supports deterministic builds, stable part identity, validation, provenance, licensing, and provider changes. **Summary:** The VOX voxel file format would remain an authoring and interchange source. Antiky would normalize it into a versioned scene and compile deterministic target artifacts. **AI-suggested direction:** Ship a static surface target first. Add editable chunks, sparse volumes, and levels of detail only after a real game proves the need.

### 12. Feedback data governance

**Why this is here:** Feedback can contain sensitive context and untrusted instructions, so it should not live in world state or source control. **What it helps:** A separate store supports authorization, precise targets, retention, deletion, and safe agent use. **Summary:** The first version would use local text records, stable targets, source revisions, connector-verified caller authority, and bounded retention. Keep workflow history separate from deletable payloads. **AI-suggested direction:** Add attachments, notifications, multi-user hosting, legal holds, search, exports, and agent access only when concrete requirements activate them.

### 14. Player-presentation ownership

**Why this is here:** Reusable audio, player interfaces, haptics, and presentation cues need ownership before they blur gameplay authority or renderer responsibilities. **What it helps:** A boundary supports accessibility, localization, device failure, pause policy, replay, duplicate suppression, and gameplay without graphics. **Summary:** Game-owned presentation code would derive persistent views from gameplay state and consume typed cues. Device-specific adapters would own devices, recovery, preferences, and disposal. **AI-suggested direction:** Prove one private audio, interface, or haptic feature first. Extract shared services only after a second consumer or reusable runtime proves the boundary.

### 15. Game-logic extension, scripting, and mods

**Why this is here:** Public system registration, hot reload, embedded languages, or mods would create new trust, state, compatibility, and failure boundaries. **What it helps:** A decision protects world ownership while defining package identity, capabilities, isolation, migration, resource limits, and recovery. **Summary:** Ordinary game logic would remain build-time TypeScript. A future boundary would freeze each session's approved extensions, capabilities, package versions, and isolation rules. **AI-suggested direction:** Do not publish an extension or scripting interface yet. Keep Model Context Protocol access external and activate this decision only for a real extension need.

### 16. Shipped-game artifact and asset package

**Why this is here:** A successful website build does not prove that a player artifact is portable, complete, compatible, or launchable outside the source checkout. **What it helps:** An artifact boundary exposes runtime dependencies, missing files, cache skew, compatibility rules, rollback limits, and release evidence. **Summary:** The first proof would stage one browser package, record its files and runtime, and launch it outside the source checkout. Future release records would separate base releases, extension packages, and selected extension sets. **AI-suggested direction:** Run a time-boxed static-export trial and use Next.js standalone as fallback. Design long-lived release manifests only after proof or another compatibility trigger.
