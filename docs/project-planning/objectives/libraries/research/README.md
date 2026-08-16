# Libraries research

Research date: 2026-08-12

This research answers the questions in [`00-research-plan.md`](00-research-plan.md) against the
owner's [`idea.md`](../idea.md). It does not choose an implementation plan.

## Headline conclusions

1. **Improve the current asset catalog rather than start another asset library.** The current
   worktree has 1,466 described records. The decisive gap is visibility inside packs and unclear
   field authority, not missing descriptions everywhere.
2. **Keep each pack whole and add subordinate inventory.** Exact members, logical content items,
   and semantic groups answer different questions. Do not inflate the top-level catalog with every
   frame, map, recolor, or file.
3. **Put deterministic evidence before model enrichment.** Parse archives and formats, retain
   provider claims, validate, and generate canonical evidence first. Models can then propose
   descriptions, vocabulary, synonyms, likely uses, and grouping corrections. Their output remains
   a sourced suggestion until evaluation and review policy promote it.
4. **Treat BroMetal's 30 shaders as a seed, not the intended scale.** Mature engines usually ship
   tens of broad built-in models, then reach hundreds or thousands through functions, examples,
   packages, and community catalogs. Build the large renderer-general catalog in BroMetal while
   keeping its supported core and bulk catalog content separate.
5. **Give Antiky the semantic integration layer, not a duplicate shader-code library.** Antiky's
   role is bounded discovery, material/effect meaning, dependencies, adaptation, compatibility,
   rights, and proof over correctly owned BroMetal catalog entries.
6. **Use a promotion path, not a universal abstraction.** Renderer-general math and effects belong
   in BroMetal. Repeated game render capabilities belong in the Antiky driver. Semantic recipes
   belong in Antiky. Art-directed implementations remain game-local until a genuine second consumer
   exposes a stable interface.
7. **Share discovery, not one record schema.** Media and shader records can use the same bounded
   search envelope. Code, materials, multipass recipes, examples, and media need distinct detail,
   rights, adaptation, compatibility, and evidence contracts.
8. **Stay static-first.** Public exact records remain static JSON. A typed local service should own
   bounded queries and installation/adaptation planning. Studio and optional local MCP project the
   same behavior. Current evidence does not justify a hosted catalog MCP service.
9. **Track provenance per claim, component, and action.** Metadata indexing, remote display,
   preview mirroring, redistribution, adaptation, and notice fulfillment are distinct permissions.
   Generated descriptions do not clear underlying code or media.

## Research documents

| Document | What it answers |
| --- | --- |
| [`00-research-plan.md`](00-research-plan.md) | Questions, constraints, scope, and evidence lines |
| [`01-current-state-and-gaps.md`](01-current-state-and-gaps.md) | What exists today and where pack/shader semantics actually fail |
| [`02-asset-semantic-enrichment.md`](02-asset-semantic-enrichment.md) | Pack/member/group model, deterministic extraction, model role, evidence, and evaluation |
| [`03-shader-library-and-ownership.md`](03-shader-library-and-ownership.md) | Artifact classes, ownership, external precedents, promotion, agent use, and proof |
| [`04-discovery-delivery-and-provenance.md`](04-discovery-delivery-and-provenance.md) | Bounded retrieval, delivery surfaces, proof ladder, rights, contribution, and failure cases |
| [`05-shader-ecosystem-scale-research-plan.md`](05-shader-ecosystem-scale-research-plan.md) | Corrected scale question, comparison layers, and focused inquiry plan |
| [`06-shader-ecosystem-scale.md`](06-shader-ecosystem-scale.md) | Current Three.js, Unreal, Unity, Godot, and Phaser counts and corrected BroMetal direction |
| [`subagent_outputs/`](subagent_outputs/) | Raw read-only research reports retained as evidence |

## Research-question status

| Question | Status | Answer location |
| --- | --- | --- |
| Missing asset semantics | Answered | Current-state gap matrix and asset-enrichment model |
| Deterministic versus model-assisted work | Answered in principle | Asset enrichment; candidate models remain unmeasured |
| Smallest reusable shader artifact | Answered as multiple explicit classes | Shader library and ownership |
| BroMetal/Framework/Studio/game/skill ownership | Answered within accepted direction | Shader library and ownership |
| Agent-usable shader metadata and evidence | Answered in principle | Shader library; discovery and proof |
| Delivery surfaces | Answered in principle | Discovery, delivery, and provenance |
| External practices to reuse or avoid | Answered | Asset enrichment, shader precedents, and raw reports |
| Mature-platform shader ecosystem scale | Answered | Shader ecosystem scale supplement and raw platform reports |
| Owner decisions before planning | Open by design | Listed below |

## Decisions needed from the owner

Planning should not silently choose these product and policy decisions:

1. **Objective shape:** Should the next plan cover both asset enrichment and shader semantics, or
   split them into two objectives that share search/provenance foundations?
2. **Asset inventory:** Does the first useful result need exact members, logical content items,
   semantic groups, or all three?
3. **Model publication:** Which generated fields can publish automatically, which need sampled
   review, and which need per-item approval? What measured error threshold is acceptable?
4. **Shader scale unit:** Which complete implementations, recipes, presets, functions, examples,
   and packs count toward the hundreds-to-thousands public goal?
5. **Shader outcome:** Should the first result prove the large BroMetal catalog system, add a large
   first-party content seed, create an Antiky reference-only recipe, add a driver-backed effect, or
   separate these into deliberate deliverables?
6. **First proving case:** Which asset packs and which genuinely independent shader consumers should
   prove the contracts?
7. **Distribution rights:** Is distributable shader code limited to permissive,
   commercial-compatible licenses? Can reciprocal or NonCommercial items appear in discovery-only
   or isolated lanes?
8. **Agent surface:** Is bounded package/CLI search sufficient initially, or is an optional local
   MCP adapter already a real need?
9. **Architecture records:** Should planning first record catalog-to-UUID asset identity,
   source-to-derived provenance, and the material/render-recipe contract as ADRs?

## Important unresolved evidence

- No candidate fast model has been tested on an Antiky gold set.
- No provider archive-retrieval permission was established by this research.
- No representative corpus was compiled and rendered across a pinned browser/GPU matrix.
- ShaderToy's current default rights could not be verified.
- The private permission for BroMetal's Water Pro-derived examples was unavailable and needs review
  before redistribution or adaptation.
- Final driver, render graph, material, compatibility, and program-replacement interfaces remain
  open architecture work.

## Direction and ADR alignment

The findings do not contradict accepted ADRs. They strengthen the BroMetal driver boundary, the
agent-native shared-service rule, stable identity, boundary serialization, and static-first asset
catalog posture. A future implementation plan may reveal new decisions about asset derivation,
catalog identity, materials, or render recipes. Those decisions should be ADRs rather than being
buried in an execution plan.
