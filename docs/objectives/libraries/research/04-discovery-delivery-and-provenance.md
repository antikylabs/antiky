# Discovery, delivery, proof, and provenance

Research date: 2026-08-12

## Recommended direction

Let the media and shader libraries share a bounded search envelope and human discovery surface,
but keep separate detail schemas, rights gates, installation/adaptation flows, and validation.

Keep the existing authority split:

- static, versioned JSON for public canonical records and exact lookup;
- a typed package/service for local search, installation planning, and receipts;
- Studio as a project-aware human search, review, and evidence surface;
- CLI as the local project and development authority;
- optional local MCP tools only when measured agent demand needs them; and
- skills as workflow guidance that points to current types and services.

Do not build a hosted MCP service just because agents are a target user. Public read-only data does
not become more semantic by adding a protocol server. The archived asset objective already chose a
static-first catalog, and current evidence does not overturn that decision.

## Task-oriented retrieval

The current catalog package linearly searches all records and returns full `CatalogAsset` objects.
The website paginates visually but imports the full data. The complete JSON is about 2.48 MB and
`/llms.txt` now enumerates every asset. Those bulk surfaces remain useful for export, but they are
not a bounded agent workflow.

A common discovery flow should be:

```text
bounded search at catalog revision R
  -> compact candidates and deterministic match fields
  -> exact record at R
  -> rights and compatibility gate
  -> media installation or shader adaptation receipt
  -> build/compile validation
  -> fenced runtime inspection
  -> visual evidence and explicit review when the claim is visual
```

### Search

The request names:

- schema version and library class (`media` or `shader`);
- text or semantic query;
- strict library-specific filters;
- result and response-byte limit;
- an opaque cursor; and
- a catalog revision for continuation or reproducible reuse.

The result names:

- catalog revision and generation time;
- total matching, returned, and retained counts;
- whether the result is complete and the next cursor;
- compact candidates with catalog ID, name, artifact class, summary, deterministic matched fields,
  verification and compatibility states, rights lane, detail reference, and preview reference.

`complete: false` cannot prove no other match exists. A generated relevance rationale, if useful,
is separate from deterministic matched fields. `unknown` compatibility is not compatible.

### Inspect

Fetch one record by catalog identity and pinned revision, not a display name. Separate:

- reviewed semantic claims;
- exact technical observations;
- provider and embedded assertions;
- rights/provenance evidence;
- dependencies, compatibility, and source/install references;
- validation receipts and their exact scope; and
- incomplete or unknown fields.

Large inventories, source, dependency graphs, and evidence move by reference, consistent with ADR
0010. They do not inflate search results.

### Install media

Require install verification for automatic project installation. Resolve one `.antiky` project,
pin revision and expected hashes, enforce member and byte limits, verify before replacement, and
write a project receipt with source/catalog identity, rights, hashes, and transformations.

The current installer already validates project paths and selected download size/hash. Future pack
installation also needs total compressed/decompressed bytes, member counts, nesting, symlinks, and
transaction semantics. Current code replaces the destination before it updates the provenance
registry; **inference:** a later registry failure can leave bytes and receipts out of sync. A future
contract needs atomic success or a recoverable partial state.

### Adapt shader code

Acquire immutable source and its dependency/notice closure without automatically executing setup
scripts. Create a project-owned derived artifact that records source hash, `derivedFrom`, BroMetal
range, changed files, parameter mapping, transforms, and rights. Compile and validate before
replacing last-good output. Keep GPU objects inside the driver or the game's explicit exception
boundary.

Copying source is adaptation, not installation in the media sense. The result belongs to the
project until a separate promotion decision moves a generic part upstream.

## Proof ladder

Proof is cumulative and claim-specific:

1. **Catalog gate:** authoritative source and rights evidence supports the intended action.
2. **Acquisition gate:** received bytes match expected identity and safety limits.
3. **Static gate:** parsers, schemas, dependencies, generated output, typed bindings, and compiler
   checks pass.
4. **Runtime gate:** the accepted build is running and structured inspection identifies the intended
   asset, program, material, pass, and dependency state.
5. **Visual gate:** a capture from that exact build/runtime/state is judged against a reference
   scene and explicit rubric.

Antiky already fences capture evidence by development-session and runtime observations and keeps it
private-unreviewed. A capture proves pixels at that observation. It does not prove aesthetic
quality, accessibility, gameplay suitability, publication safety, or unseen states. Structured
inspection and compilation do not prove the pixels. Both forms are necessary for different claims.

## Delivery-surface tradeoffs

| Surface | Best use | Direction |
| --- | --- | --- |
| Static JSON | Public exact records, durable URLs, caching, bulk export | Keep as canonical public authority; add compact indexes or shards only when measured |
| Package/service | Typed bounded search, exact lookup, install/adaptation planning, receipts | Lead implementation so CLI, Studio, and optional MCP share one behavior |
| Studio | Human comparison, project compatibility, review, approval, and evidence | Project the shared service; never create a second catalog or engine authority |
| CLI | Local project boundary, mutations, builds, runtime, and evidence | Keep as execution authority |
| MCP | Model-driven bounded query and local orchestration | Optional local tools over shared services; no hosted JSON wrapper or duplicated resource results |
| Skill | Policy, current workflow, authoring idioms, and recovery | Never treat it as catalog, compiler, compatibility, or evidence authority |

The official MCP model treats Tools as schema-defined operations and Resources as read-only context.
If the need appears, likely tools are `search_library`, `inspect_library_item`, `prepare_install`,
and `validate_installed_item`; exact large artifacts can be resource links. Tool annotations are
hints, not authorization.

## Rights are per component and action

Metadata indexing, remote preview display, preview mirroring, code redistribution, adaptation, and
notice fulfillment are separate decisions. A public repository or URL is not a reuse license, and
a repository root license does not reliably cover every example asset, dependency, or imported
fragment.

### Proposed rights record

For each component—metadata, description, source, generated output, preview, dependency, and sample
asset—record:

- intended actions: index, remote display, mirror, redistribute, adapt;
- declared and concluded license, using `NOASSERTION` when evidence is incomplete;
- immutable evidence URL/revision/hash and retrieval time;
- copyright, attribution, notices, change-notice, ShareAlike, NonCommercial, patent, and trademark
  terms where relevant;
- direct-permission reference, scope, expiry, and sublicensing scope;
- reviewer, status, decision, and history; and
- derivation relationship, source hashes, transformation, contributor, and human review.

Missing or conflicting evidence defaults to quarantine for redistribution. Do not infer a
permissive license from source availability, provider reputation, or GitHub's license detection.

### Generated descriptions

A generated description does not clear the underlying artifact or alter its rights. Record whether
text is upstream verbatim, human-authored, machine-generated, machine-assisted, or deterministically
extracted. Retain inputs/evidence, model and provider/version, terms evidence, prompt/pipeline
revision, output hash, factual citations, similarity screening, editor, and review status.

This information serves audit, correction, and model replacement. It does not claim that prompts or
model output settle copyright ownership.

### Preview rights

Code rights do not automatically grant rights to upstream screenshots or video. Prefer an
Antiky-rendered preview when source rights support execution/adaptation, and record the source
artifact revision, renderer/runtime, reference scene, output hash, and rights basis. The rendered
preview is still distinct from reusable source and from private validation evidence.

## Ingestion lanes

| Lane | Permitted result |
| --- | --- |
| Discovery/reference-only | Source URL, ID, title, minimal facts; no copied code/prose/media |
| Factual metadata | Normalized cited facts and hashes |
| Remote preview | Link/embed only under terms supporting that delivery method |
| Mirrored or Antiky-rendered preview | Separate media or derived-preview rights record |
| Permissive code | Immutable version, exact license, notices, and dependency review |
| Conditional code | GPL, ShareAlike, NonCommercial, or other conditions in a deliberately separate lane |
| Direct permission | Exact retained grant and scope; incomplete scope remains quarantined |
| Antiky-origin contribution | Rights attestation, third-party manifest, inbound terms, AI disclosure, human and technical review |
| Generated semantic text | Authorized inputs, factual evidence, generation record, similarity check, and review |
| Quarantine | Missing/conflicting rights, unclear media, stale terms, unknown revision, or insufficient permission |

The owner needs to decide whether public distributable code is permissive and commercial-compatible
only. Discovery can remain broader as long as search results do not imply redistribution or
compatibility.

## Contribution and correction lifecycle

```text
discover
  -> immutable capture
  -> component rights classification
  -> automated evidence and notice checks
  -> human rights review
  -> compile/render review
  -> admit
  -> periodic refresh
  -> correction or takedown that supersedes the prior record
```

Contributors should attest that they can submit the material, identify employer/third-party
interests, enumerate dependencies and assets, disclose model assistance and source inputs, and
accept the chosen inbound terms. Corrections and takedowns should preserve immutable history and
make the current state clear.

## Threat and failure cases

- broad queries flood context;
- metadata, file names, descriptions, shader comments, or embedded text inject instructions;
- tag repetition manipulates ranking;
- compatibility is claimed without versions, features, inputs, passes, or color policy;
- shader installation executes lifecycle scripts or remote imports;
- archives traverse paths, expand without bound, use symlinks, or exhaust file counts;
- search and installation cross catalog revisions;
- a capture describes an older build or runtime;
- a bounded view is mistaken for a complete inventory;
- one thumbnail is mistaken for compatibility or visual verification; and
- the game canvas itself renders secrets into otherwise canvas-only evidence.

Default to strict schemas, bounded outputs, revision fences, source sanitization, no execution from
catalog prose/code by default, and explicit incomplete states.

## Evaluation

Use a revision-pinned set of positive, negative, and adversarial user tasks. Measure hard-constraint
precision, suitable result at k, scoped negative accuracy, pagination integrity, context bytes,
provenance accuracy, installation/adaptation gate success, and proof honesty. A result that sounds
relevant but violates a format, rights, or compatibility constraint is a retrieval failure.

For shader recipes, add representative geometry, textures, lighting, camera, blend/depth state,
and pass conditions. Human approval is a separate recorded judgment after mechanical gates pass.

## Decisions needed before planning

- Is bounded package/CLI search sufficient initially, or is local MCP already a measured need?
- Should `/llms.txt` become a compact discovery guide rather than enumerating every asset?
- What maps public `catalogId` to project/runtime UUIDv7 `AssetId`?
- Which rights lanes may appear in public discovery and which may distribute source?
- What inbound contribution mechanism and model-assistance disclosure are required?
- What correction/takedown and rights-refresh policy is acceptable?
- Which visual evidence is public, private, or retained, and under which rights basis?

## Raw evidence and primary sources

- [`subagent_outputs/04-agent-retrieval-and-proof.md`](subagent_outputs/04-agent-retrieval-and-proof.md)
- [`subagent_outputs/05-rights-provenance-lifecycle.md`](subagent_outputs/05-rights-provenance-lifecycle.md)
- [MCP server concepts](https://modelcontextprotocol.io/docs/learn/server-concepts)
- [W3C PROV-O](https://www.w3.org/TR/prov-o/)
- [SPDX licensing model](https://spdx.github.io/spdx-spec/v3.0.1/model/Licensing/Licensing/)
- [GitHub repository licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
- [US Copyright Office AI copyrightability report](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf)
