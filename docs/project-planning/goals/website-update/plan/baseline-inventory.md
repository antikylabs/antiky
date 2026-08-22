# Website launch baseline inventory

Audit date: 2026-08-21

Baseline revision: `4f676ec326dd50dac1c5eb3020a550258a6cdc74` (`Plan launch media production`)

Implementation anchor: `8e20c7ad167ed0522fb2314cf487df9aa24cbb87`. Demo and media
capture provenance uses this anchor plus content digests because the final handoff commits necessarily
postdate the captures.

## Package and renderer state

| Surface | Version or state |
| --- | --- |
| `@antiky/framework` | `0.0.0` |
| `@antiky/cli` | `0.0.0` |
| `@antiky/website` | `0.0.0` |
| `@antiky/studio-app` | `0.0.0` |
| `@antiky/studio-tauri` | `0.0.0` |
| BroMetal | `0.18.0` in Framework and all four demo workspaces; website copy still said `0.14.0` |
| Studio release gate | `NEXT_PUBLIC_STUDIO_RELEASES_READY` defaulted to false |
| Packaged Studio release | No checked-in `.dmg`, `.pkg`, `.zip`, or release directory was present |

## Public route state

The baseline had Home, Thesis, Studio, Framework, Games, Demos, Research, Assets, Docs, Labs, and
Upstream routes. It did not have a Resources hub, Shader library, Project library, Skills library,
or a public Roadmap route. The header contained seven destinations, including both Studio and
Assets, rather than the approved six-link information architecture and separate Studio action.

## Demo state

The baseline catalog and publication manifest exposed four studies: Combat Arena, Traversal Study,
Antiky Town, and Point Light Expo. Demo projects were nested under `packages/demos/antiky/`.

The launch decision is now three public studies, ordered Antiky Town, Traversal Study, and Point
Light Expo. Combat Arena remains runnable source and internal capture evidence, but it is absent
from the public catalog, static route parameters, staged artifacts, website copy, sitemap, and public
media directory.

## Media and claim state

- The baseline had no publication manifest tying source, capture state, digests, dimensions,
  delivery limits, page use, and generated-image provenance together.
- Several old media families coexisted: `town-study`, `depth-study`, `worlds/`, and `machinery/`,
  plus duplicate PNG and WebP demo deliveries.
- Studio proof used old `machinery/` media and a single general workspace image.
- Research had no checked publication set for its completed AOT report or active voxel gym.
- Open Graph and Twitter metadata declared no image.
- No ImageGen masters, prompt sidecars, reference archive, or bounded social derivatives existed.
- Public copy contained stale counts and a BroMetal `0.14.0` label despite the installed `0.18.0`
  dependency.

This inventory is the comparison point for the implementation summary and the acceptance map in
`goal-plan.md`.
