# Libraries objective

**Phase:** Research complete; awaiting owner direction before planning.

The owner's original thinking is in [`idea.md`](idea.md). It explores richer semantic understanding
for the asset catalog and a reusable BroMetal shader library that humans and agents can discover and
use correctly.

Research found that both foundations already exist in partial form: Antiky has a substantial static
asset catalog, and BroMetal already ships typed shader functions and 30 complete shaders. The owner
clarified that the shader goal is a catalog with hundreds or thousands of entries. The strongest
directions are therefore pack-level semantic enrichment, a large renderer-general BroMetal catalog
with a smaller supported core, and an Antiky semantic integration/evidence layer over correctly
owned catalog and game artifacts.

Read the [`research summary`](research/README.md) for the conclusions, evidence map, unresolved
questions, and decisions needed before `create-plan`.

## Current records

| Record | Purpose |
| --- | --- |
| [`idea.md`](idea.md) | Owner intent; preserve as supplied |
| [`research/00-research-plan.md`](research/00-research-plan.md) | Research questions and constraints |
| [`research/README.md`](research/README.md) | Conclusions, document map, open evidence, and owner decisions |
| [`research/01-current-state-and-gaps.md`](research/01-current-state-and-gaps.md) | Current asset and shader reality |
| [`research/02-asset-semantic-enrichment.md`](research/02-asset-semantic-enrichment.md) | Asset-library direction |
| [`research/03-shader-library-and-ownership.md`](research/03-shader-library-and-ownership.md) | Shader-library direction |
| [`research/04-discovery-delivery-and-provenance.md`](research/04-discovery-delivery-and-provenance.md) | Shared retrieval, evidence, and rights direction |
| [`research/05-shader-ecosystem-scale-research-plan.md`](research/05-shader-ecosystem-scale-research-plan.md) | Focused cross-platform shader-scale research plan |
| [`research/06-shader-ecosystem-scale.md`](research/06-shader-ecosystem-scale.md) | Cross-platform counts and corrected large-catalog direction |

No implementation plan or executable goal exists yet. The next lifecycle phase is `create-plan`
after the owner responds to the decisions in the research summary.
