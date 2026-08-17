# Agent discovery, retrieval, installation, adaptation, and proof

Research date: 2026-08-12. This report is read-only.

## Headline direction

**Established.** Antiky already has the correct authority split:

- Public catalog records are static, versioned JSON with exact item documents
  ([`packages/asset-catalog/scripts/build-static-api.mjs:32`](packages/asset-catalog/scripts/build-static-api.mjs:32)).
- Typed package APIs own in-process search and installation
  ([`packages/asset-catalog/src/index.ts:75`](packages/asset-catalog/src/index.ts:75),
  [`packages/asset-catalog/src/node/install.ts:65`](packages/asset-catalog/src/node/install.ts:65)).
- The local CLI and Studio share the `.antiky` project trust boundary
  ([`docs/adr/studio/0005-use-one-antiky-project-manifest_H.md:55`](docs/adr/studio/0005-use-one-antiky-project-manifest_H.md:55)).
- MCP is an adapter over the same services, not a second authority
  ([`docs/adr/framework/0003-agent-native_H.md:17`](docs/adr/framework/0003-agent-native_H.md:17),
  [`docs/adr/cli/0001-use-mcp-tools-for-development_H.md:41`](docs/adr/cli/0001-use-mcp-tools-for-development_H.md:41)).
- Skills teach workflow but do not establish facts. The current asset and shader skills are explicitly work in progress
  ([`docs/objectives/skill-research/skills/AGENTS.md:1`](docs/objectives/skill-research/skills/AGENTS.md:1)).

**Inference.** Keep that split and add one small, task-oriented retrieval contract shared by the package, Studio, CLI, and—only if measured client demand warrants it—an optional local MCP adapter. Do not create a hosted catalog MCP server merely to wrap public JSON. This matches the archived catalog decision
([archived asset-catalog objective](../../../_archives/2026-08-10-asset-catalog-summary.md)).

The leading workflow should be:

```text
bounded search
  -> exact item inspection
  -> compatibility and rights gate
  -> project-local install or adaptation
  -> deterministic build/compile validation
  -> fenced runtime inspection
  -> visual review tied to that same runtime revision
```

Neither a catalog description nor a preview is proof that an asset integrates or a shader renders correctly.

## Current retrieval problem

**Established.** The catalog now has 1,466 records in its built output, and the complete JSON is approximately 2.48 MB. The package exposes only linear in-memory filtering and exact provider/slug lookup; it has no limit, cursor, match count, revision fence, or compact result projection
([`packages/asset-catalog/src/index.ts:75`](packages/asset-catalog/src/index.ts:75),
[`packages/asset-catalog/tests/static-output.test.mjs:27`](packages/asset-catalog/tests/static-output.test.mjs:27)).

The website limits the visible page to 48 results, but it imports the complete package catalog into the client-side search
([`packages/website/src/components/assets/AssetCatalog.tsx:9`](packages/website/src/components/assets/AssetCatalog.tsx:9),
[`packages/website/src/lib/assets.ts:81`](packages/website/src/lib/assets.ts:81)). `/llms.txt` enumerates every asset, while `/llms-full.txt` embeds every full summary
([`packages/website/src/lib/docs.ts:254`](packages/website/src/lib/docs.ts:254),
[`packages/website/src/lib/docs.ts:302`](packages/website/src/lib/docs.ts:302)).

**Inference.** `/llms.txt` is no longer a genuinely concise discovery surface. Agents should not be told to attach `/llms-full.txt` or download `catalog.json` for normal retrieval. Those remain bulk/export surfaces. Normal discovery needs a bounded result set and exact detail references.

**Established inconsistency.** Maintained user documentation says 1,453 records while the current static-output test asserts 1,466
([`docs/user-facing-docs/assets/catalog.md:11`](docs/user-facing-docs/assets/catalog.md:11),
[`packages/asset-catalog/tests/static-output.test.mjs:27`](packages/asset-catalog/tests/static-output.test.mjs:27)). This demonstrates why every result needs a catalog revision/generated time and why prose totals must not act as freshness proof.

## Recommended task flows

### 1. Find candidates

1. Convert the user’s need into hard constraints and soft terms. Hard constraints include asset or shader kind, formats, dimensions/stages, BroMetal compatibility, required features, license lane, and installability.
2. Call one bounded search with an explicit limit.
3. Receive compact summaries only. Each summary links to one exact record and states why it matched.
4. If `complete` is false, refine the filters or request the next cursor. Do not attach the complete library.
5. Report “no match within this catalog revision and query” when empty. Do not silently expand to the open web.

The draft `source-game-assets` skill already says to report the catalog gap before widening the boundary
([`docs/objectives/skill-research/skills/source-game-assets/SKILL.md:8`](docs/objectives/skill-research/skills/source-game-assets/SKILL.md:8)).

### 2. Inspect one candidate

Fetch one record by opaque catalog identity, not by display name. The response should separate:

- semantic claims: description, tags, intended use;
- deterministic facts: formats, dimensions, counts, shader stages, declared inputs;
- provenance and rights evidence;
- install or source references;
- compatibility and dependency contract;
- validation evidence and its scope;
- unknown fields and incomplete state.

For packs, return a bounded pack inventory or inventory reference. A pack description and published file count are not an inventory.

**Identity gap.** Current records use `provider:slug` as `CatalogAsset.id`
([`packages/asset-catalog/src/index.ts:37`](packages/asset-catalog/src/index.ts:37)), while accepted ADR 0011 requires UUIDv7 for durable Antiky assets
([`docs/adr/framework/0011-stable-ids-and-runtime-aliases_H.md:21`](docs/adr/framework/0011-stable-ids-and-runtime-aliases_H.md:21)). Until the owner settles the mapping, call the existing value a `catalogId`, not a Framework `AssetId`.

### 3. Install or adapt

For media assets:

1. Require `install-verified`.
2. Resolve exactly one `.antiky` project.
3. Pin the catalog revision and expected download hashes.
4. Download within path, file, total-byte, and count limits.
5. Verify bytes before replacement.
6. write a project receipt containing catalog ID, catalog revision, source hashes, local SHA-256 hashes, license, attribution, and transformations.
7. Build the project and inspect the accepted build revision.

The current installer already rejects unsafe relative paths, requires one manifest, verifies size/hash, and writes provenance
([`packages/asset-catalog/src/node/install.ts:16`](packages/asset-catalog/src/node/install.ts:16),
[`packages/asset-catalog/src/node/install.ts:33`](packages/asset-catalog/src/node/install.ts:33),
[`packages/asset-catalog/src/node/install.ts:45`](packages/asset-catalog/src/node/install.ts:45),
[`packages/asset-catalog/src/node/install.ts:127`](packages/asset-catalog/src/node/install.ts:127)).

For shaders:

1. Install or copy an immutable source artifact plus its license and dependency closure; do not execute arbitrary catalog-supplied setup scripts.
2. Create a project-owned adaptation derived from that artifact. Record `derivedFrom`, source hash, BroMetal version/range, changed files, parameter mapping, and transformation history.
3. Follow the nearest working renderer and installed BroMetal types.
4. Keep BroMetal programs and handles inside the render-driver or explicit game-owned exception boundary.
5. Compile and validate the candidate before replacing the last-good program.

These steps align with the draft shader skill
([`docs/objectives/skill-research/skills/write-brometal-shaders/SKILL.md:8`](docs/objectives/skill-research/skills/write-brometal-shaders/SKILL.md:8)) and accepted render ownership
([`docs/adr/framework/0021-brometal-render-driver-ownership_H.md:31`](docs/adr/framework/0021-brometal-render-driver-ownership_H.md:31)).

### 4. Prove the result

A useful proof ladder is cumulative:

1. **Catalog gate:** authoritative item/pack rights and provenance evidence exists.
2. **Acquisition gate:** received bytes match expected hashes and size/count limits.
3. **Static integration gate:** dependencies resolve; schemas, formats, typed bindings, and shader compilation pass.
4. **Runtime gate:** the accepted build is running; structured diagnostics and semantic inspection show the intended item, material, pipeline, pass, and dependencies.
5. **Visual evaluation gate:** a capture from that exact build/runtime/step is reviewed against an explicit scene, lighting, camera, state, and acceptance rubric.

Antiky already distinguishes measurements from pixels, fences captures with build/runtime observations, and marks evidence `private-unreviewed`
([`docs/user-facing-docs/mcp/tools.md:78`](docs/user-facing-docs/mcp/tools.md:78),
[`docs/user-facing-docs/mcp/tools.md:278`](docs/user-facing-docs/mcp/tools.md:278),
[`packages/cli/src/host/evidence-store.ts:137`](packages/cli/src/host/evidence-store.ts:137)).

A successful image capture proves which pixels Antiky captured at a fenced observation. It does not prove aesthetic correctness, gameplay suitability, accessibility, publication safety, or that an unseen state works. Conversely, structured data and compile success do not prove visual correctness. ADR 0003 explicitly requires both semantic data and, where useful, visual evidence
([`docs/adr/framework/0003-agent-native_H.md:31`](docs/adr/framework/0003-agent-native_H.md:31)).

For shaders, WGSL/WebGPU compilation is a real gate: shader-creation and pipeline-creation errors prevent use in a pipeline, and diagnostics carry severity and source location. It is still not a visual-quality gate. See the W3C [WGSL diagnostics model](https://www.w3.org/TR/WGSL/#diagnostics) and [WebGPU shader-module compilation information](https://www.w3.org/TR/webgpu/#dom-gpushadermodule-getcompilationinfo).

## Minimal query and result contract

One semantic contract should back package, Studio, CLI, and optional MCP projections.

### Search input

```json
{
  "schemaVersion": 1,
  "library": "media",
  "text": "stylized forest rocks",
  "filters": {
    "kinds": ["model"],
    "formats": ["glb"],
    "verification": ["install-verified"],
    "compatibility": {
      "runtime": "antiky",
      "renderer": "brometal"
    }
  },
  "limit": 10,
  "cursor": null,
  "catalogRevision": null
}
```

`library` should initially be `media` or `shader`; do not force both into one undifferentiated record schema. `filters` is a strict library-specific object. Limits, string lengths, array lengths, enum values, and `additionalProperties: false` must be enforced.

`catalogRevision` is absent for the first page and required from the first result for continuations or install preparation. Cursor values are opaque.

### Search result

```json
{
  "schemaVersion": 1,
  "catalogRevision": "sha256:…",
  "generatedAt": "2026-08-12T00:00:00Z",
  "availableCount": 34,
  "returnedCount": 10,
  "complete": false,
  "nextCursor": "opaque",
  "items": [
    {
      "catalogId": "provider:item",
      "name": "Example",
      "kind": "model",
      "summary": "Bounded plain-text summary.",
      "matchedFields": ["tags", "formats"],
      "verification": "install-verified",
      "compatibility": "declared",
      "licenseId": "cc0-1.0",
      "detailRef": "https://catalog-api.antikylabs.com/v1/assets/provider/item.json",
      "previewRef": "https://…"
    }
  ]
}
```

Important semantics:

- `complete: false` means the result is not evidence that no other match exists.
- `compatibility` needs at least `verified`, `declared`, `unknown`, and `incompatible`; absence must not mean compatible.
- `matchedFields` reports deterministic retrieval evidence. A generated rationale may be added separately, clearly labeled as a model inference.
- Summaries never include shader source, pack inventories, binary data, complete dependency graphs, or screenshots.
- Exact lookup returns the complete record for one `catalogId` and revision.
- Large source, inventory, evidence, or binary artifacts move by reference, as required by ADR 0010
  ([`docs/adr/framework/0010-serialize-at-boundaries_H.md:30`](docs/adr/framework/0010-serialize-at-boundaries_H.md:30)).

## Delivery-surface comparison

| Surface | Best use | Strengths | Limits and hazards | Direction |
| --- | --- | --- | --- | --- |
| Static JSON | Public canonical records, exact lookup, bulk export | Cacheable, cheap, auditable, universal | Current complete file loads the whole catalog; no bounded query | Keep as public authority. Add compact indexes/shards only if measured; retain one exact document per item. |
| Package API | Typed local search, lookup, install planning, receipts | One implementation shared by CLI/Studio/MCP; offline/cacheable; testable | Package version can drift from public revision; importing `catalog` currently embeds all records | Lead local implementation. Make revision explicit and return compact projections. |
| Studio | Human search, comparison, compatibility/rights review, approval, evidence browsing | Strong project context and visual review | UI is not a second catalog or engine authority | Project the shared package/service; do not reimplement ranking or proof rules. |
| MCP | Model-controlled bounded search, exact lookup, project-local install/proof orchestration | Strict schemas, compact structured results, safe next steps | Adds protocol/client/security burden; annotations are only hints | No hosted public MCP now. If needed, add optional local tools over shared services. Do not duplicate the same results as Resources. |
| Skill | Teaches call order, constraints, adaptation, and recovery | Very low runtime complexity; useful across agents | Stales quickly; cannot prove facts, compatibility, install, or rendering | Keep policy and workflow only. Point to current tools/docs and installed types. |

MCP supports paginated tool discovery, structured tool results with output schemas, and resource links for large or separately fetched data. Resource links need not appear in `resources/list`. See the official [MCP Tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) and [Resources specification](https://modelcontextprotocol.io/specification/2025-11-25/server/resources).

Antiky’s accepted MCP ADR requires Tools for local development operations and allows Resources only for a distinct URI workflow with client compatibility tests
([`docs/adr/cli/0001-use-mcp-tools-for-development_H.md:49`](docs/adr/cli/0001-use-mcp-tools-for-development_H.md:49)). Therefore:

- `search_library`, `inspect_library_item`, `prepare_install`, and `validate_installed_item` would be Tools.
- Exact source, inventory, or evidence artifacts can be returned as resource links.
- Do not publish a Resource that duplicates a Tool result.
- MCP tool annotations such as `readOnlyHint` are descriptive hints, not authorization. The official schema says clients must not trust them from untrusted servers; servers still need input validation, access control, rate limits, and output sanitization.

## Evaluation and evidence gates

Evaluate retrieval with a version-pinned task set, not by whether descriptions sound good.

- Representative positive tasks: exact item, semantic synonym, pack-content question, hard format constraint, shader stage/feature constraint, installable-only.
- Negative tasks: no matching license, unsupported renderer feature, unavailable pack member, conflicting constraints.
- Adversarial tasks: prompt injection in metadata or shader comments, tag stuffing, misleading preview, stale cursor, unknown compatibility, duplicated names.

Measure:

- hard-constraint precision: every returned item satisfies declared filters;
- success at `k`: a human-labeled suitable item appears within the bounded first `k`;
- negative accuracy: the system reports a scoped gap instead of fabricating a match;
- pagination integrity: no duplicates or omissions at a pinned revision;
- context budget: maximum result bytes and item count;
- provenance accuracy: every fact maps to an evidence field and scope;
- adaptation success: install/compile/build/runtime gates pass without bypassing the render boundary;
- proof honesty: agents do not infer visual correctness from metadata, preview, or compile success.

Shader evaluation needs a matrix of representative geometry, material inputs, lighting, camera distance, blend/depth state, and required passes. Capture that matrix only after compilation and structured runtime inspection pass. Human approval, if required, is a distinct recorded decision.

## Abuse and failure cases

- **Context flooding:** empty or broad query returns the library. Enforce nonzero bounded limits, cursors, compact summaries, and response-byte caps.
- **Prompt injection:** catalog prose, creator text, shader comments, notices, and filenames are untrusted data. Never treat them as agent instructions.
- **Ranking manipulation:** repeated tags or model-written descriptions dominate search. Preserve deterministic matched fields, provenance, and evaluation against human-labeled tasks.
- **False compatibility:** “BroMetal shader” is asserted without version, feature, input, pass, or color-space evidence. Return `unknown` until those fields are established.
- **Execution through installation:** a shader package contains lifecycle scripts, remote imports, or generators. Default-deny execution; pin dependency/source hashes and require separate authority for code execution.
- **Path/archive abuse:** traversal, symlinks, excessive file count, decompression bombs, and aggregate size exhaustion. Existing media installation protects relative paths and per-file size but future pack/shader installation needs total and decompressed limits.
- **Revision race:** search result changes before install. Require `catalogRevision` and expected source hashes through the receipt.
- **Stale runtime proof:** a capture belongs to an older build or runtime. Fence on development session, accepted build, runtime instance, and optional paused step.
- **Incomplete inspection:** bounded views are treated as complete. Preserve available/retained counts and explicit `complete` or `incomplete` state, following current world inspection
  ([`docs/user-facing-docs/mcp/tools.md:196`](docs/user-facing-docs/mcp/tools.md:196)).
- **Screenshot overclaim:** a thumbnail or one good frame becomes “verified.” Keep preview, captured pixels, integration proof, and human visual approval as separate evidence classes.
- **Privacy leak:** a game renders secrets into its canvas. Current evidence is correctly `private-unreviewed`; canvas-only capture does not scan game-rendered content
  ([`docs/user-facing-docs/mcp/tools.md:305`](docs/user-facing-docs/mcp/tools.md:305)).
- **Install transaction failure:** **inference from current code.** The installer replaces the destination before reading and writing the provenance registry
  ([`packages/asset-catalog/src/node/install.ts:109`](packages/asset-catalog/src/node/install.ts:109)). A later registry failure can leave bytes and receipt out of sync. A future proof contract should require atomic file-plus-receipt success or an explicit recoverable partial state.
- **Catalog key confusion:** current `provider:slug` is silently treated as a durable Framework asset identity. Keep `catalogId` distinct until the UUIDv7 mapping is decided.

## Unknowns and owner decisions

1. Is semantic retrieval a measured agent problem that justifies a local MCP adapter, or are a bounded package/CLI query and exact static documents sufficient?
2. Should `/llms.txt` stop enumerating every item and instead link to bounded discovery surfaces?
3. What maps a public `catalogId` to the UUIDv7 `AssetId` required inside Antiky projects and runtime inspection?
4. Does a shader library install immutable source, a package dependency, a copied recipe, generated typed modules, or more than one deliberately distinct artifact?
5. Which BroMetal version/feature compatibility claims can be deterministically verified, and which remain maintainer declarations?
6. What exact pack-inventory representation is small enough for lookup but rich enough to answer “what is in this pack?”
7. Which visual claims require human approval, and which can use deterministic thresholds or image comparisons?
8. What publication and retention rules apply to shader preview captures, especially when third-party assets or game-rendered text are present?
9. Should public media and software/shader records share only search envelopes, or also a catalog package? The archived objective requires distinct licenses, dependencies, versions, notices, and build/render evidence
   ([archived asset-catalog objective](../../../_archives/2026-08-10-asset-catalog-summary.md)).
