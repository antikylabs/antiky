# Studio apps objective

**Phase:** Research complete; awaiting owner direction before planning.

The owner's intent is preserved in [`objective.md`](objective.md): Studio should support composable
mini apps without losing the current game-editor experience, visual quality, or room to extend.

Research found that the current four-panel workspace is a compatibility baseline rather than an
app API. The smallest credible direction is a first-party contribution seam built around stable
identity, bounded Studio-owned capabilities, app workspace presets that do not overwrite user
arrangement, explicit lifecycle/disposal, and a canvas-host boundary that keeps renderer and GPU
ownership private. The exact first apps, customization ceiling, trust model, and WebGPU device
policy remain owner decisions.

Read the [`research summary`](research/README.md) for the conclusions, evidence map, unresolved
questions, and decisions needed before `create-plan`.

## Current records

| Record | Purpose |
| --- | --- |
| [`objective.md`](objective.md) | Owner intent; preserved as supplied |
| [`research/00-research-plan.md`](research/00-research-plan.md) | Research questions, constraints, and fan-out |
| [`research/README.md`](research/README.md) | Conclusions, document map, open evidence, and owner decisions |
| [`research/01-current-state-and-proving-cases.md`](research/01-current-state-and-proving-cases.md) | Current Studio seams and proving cases |
| [`research/02-app-contract-and-workspace.md`](research/02-app-contract-and-workspace.md) | App-contract and workspace choices |
| [`research/03-loading-authority-and-lifecycle.md`](research/03-loading-authority-and-lifecycle.md) | Trust, capability, lifecycle, and isolation boundaries |
| [`research/04-webgpu-viewport-and-voxel-pressure.md`](research/04-webgpu-viewport-and-voxel-pressure.md) | Reusable viewport and voxel pressure test |
| [`research/05-verification-and-open-decisions.md`](research/05-verification-and-open-decisions.md) | Evidence requirements and owner decisions |

No implementation plan or executable goal exists yet. The next lifecycle phase is `create-plan`
after the owner responds to the decisions in the research summary.
