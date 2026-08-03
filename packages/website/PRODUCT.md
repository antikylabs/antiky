# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The initial audience has two primary groups:

1. People following Antiky Labs as the company builds in public. They want to understand what is
   being worked on, what is real today, and what comes next.
2. Prospective game builders interested in BroMetal, the public demos, and the emerging Antiky
   Framework. They want working examples, useful code, and a clear path to whatever is available now.

Players are a future audience. Until Emberwyrd has compelling player-facing material, the website
must not present itself as marketing a playable game.

## Product Purpose

The Antiky Labs website is the public home for the company, its work, and its journey. It introduces
Antiky Labs, presents deliberately released demos, explains the emerging Antiky Framework, gives a
high-level view of active research, and introduces Antiky Worlds and Emberwyrd without presenting
plans as shipped products.

Success means a visitor can quickly understand:

- what Antiky Labs is building;
- what exists today;
- what is available through the demos, Antiky Framework, and BroMetal;
- where BroMetal fits;
- what is planned for Antiky Worlds and Emberwyrd; and
- how to follow the work or try something real.

## Positioning

Antiky Labs is a game-technology company building playable experiments, an emerging open-source game
framework, active research, and future games through Antiky Worlds. The public site should introduce
that work directly instead of promoting an internal development philosophy.

BroMetal provides the GPU rendering and shader DSL beneath the framework and is available to game
builders today. Antiky Framework is emerging and must not be presented as complete before useful
public capabilities exist.

## Operating Context

Visitors encounter Antiky Labs through `antikylabs.com`, live browser demos, public source
repositories, and the founder's X and GitHub profiles. The final social profile URLs remain open.

The website, demos, and framework share an npm-workspaces monorepo:

```text
website → demos → framework
```

The website presents demos without owning their rendering implementation. Demos may depend on the
framework. The framework must not depend on either consumer.

## Capabilities and Constraints

### Current product state

- The website workspace is runnable and is being prepared for a complete marketing and editorial
  replacement.
- The existing live demo harness and backend controls have been preserved in the demos workspace.
- The initial public demo program is planned; its first demo and ordering remain open.
- The Antiky Framework workspace exists but is intentionally empty.
- BroMetal is available today and powers the current rendering work.
- AI model-adaptation and voxel-art research are active; public claims require documented evidence.
- Antiky Studio is planned but has not started.
- Emberwyrd is a planned Antiky Worlds title, not a playable product.

### Public product structure

- **Antiky Framework:** an emerging open-source game framework built on BroMetal.
- **Antiky Studio:** a future visual application built only as real production needs appear. It must
  remain optional; games must be buildable with the framework alone.
- **Antiky Worlds:** the planned commercial game studio for closed-source games.
- **Emberwyrd:** the planned flagship Antiky Worlds title.

The initial website has Home, Framework, Worlds, Research, and Demos surfaces. Studio and upstream
contributions do not receive standalone pages. BroMetal and generally useful upstream work belong in
the Framework story.

### Publishing constraints

- Publish only work deliberately approved for release.
- Keep Antiky Worlds' closed-source work out of public framework and demo packages.
- Clearly distinguish existing work, active experiments, and future plans.
- Do not expose internal technical debates as marketing content.
- Do not present a complete Antiky Framework before usable public capabilities exist.
- Do not make research claims that cannot be supported by a documented artifact or finding.

### Open product decisions

- Framework governance and license.
- First public demo and initial demo order.
- Public package and release strategy for framework capabilities.
- Homepage primary action before the first new demo is ready.
- Final X and GitHub profile URLs.
- Public depth and wording for active AI research.
- Website accessibility standard; do not claim conformance until one is chosen and verified.

## Brand Commitments

- The company name is **Antiky Labs** and the website is `antikylabs.com`.
- **Antiky Framework** is the preferred product name, not Antiky Engine.
- **Antiky Worlds** is the planned commercial studio and **Emberwyrd** is its planned flagship game.
- **Antiky Studio** is the name of the future optional visual tooling layer.
- The name Antiky comes from the Antikythera mechanism. No extended public origin story has been
  approved; do not invent one.
- Antiky uses **2.3D** to mean “2D characters and objects in a 3D world.”
- The public voice is direct, human, concise, welcoming to curious game builders, honest about
  maturity, and ambitious without inflation.
- Avoid generic AI-company language, implementation manifestos, and copy that reads like an
  engineering review.
- Do not elevate Antiky Labs' internal development process into the public value proposition. It is
  not a proven differentiator and should not occupy homepage hierarchy.
- The website uses a clean, modern dark visual system. Its craft bar should sit comfortably beside
  Unreal Engine, EVE Online, xAI, Defined, and Supercommon Systems without copying any one of them.
- Avoid metaphor-driven interface systems that need an explanation before the company or work makes
  sense.
- The old generated website's marketing copy, information architecture, status narrative, and visual
  system are salvage material and anti-reference, not authority for the replacement.

## Evidence on Hand

Confirmed source material and working evidence include:

- the reviewed Antiky Labs product documents under `../../docs/_internal/antikylabs/`;
- the runnable website workspace under this directory;
- the live demo harness, backend controls, demo registry, renderers, art helpers, and BroMetal shaders
  under `../demos/`;
- the scaffolded framework workspace under `../framework/`;
- active voxel-art research under `../../docs/_internal/lab-research/voxel-art/`;
- active engine-composition and physics research under `../../docs/_internal/lab-research/`; and
- documented BroMetal contributions under `../../docs/_internal/PRs-To-Brometal/`.

The existing technical demos are available as implementation evidence and salvage material. They are
not automatically the approved initial public demo program or the creative direction for the new
site.

There are currently no approved customer claims, testimonials, adoption figures, pricing, release
dates, shipped Antiky Framework capabilities, playable Emberwyrd build, or player-facing campaign.
Future work must not fabricate them.

## Product Principles

1. **Show working proof.** Let demos carry claims that prose cannot earn.
2. **Say what is real.** Separate working demos, active research, emerging tools, and future plans.
3. **Keep the framework sufficient.** Studio may improve workflows but must never be required.
4. **Publish deliberately.** Protect the boundary between open tools and Antiky Worlds products.
5. **Keep it simple and honest.** Prefer a small truthful release over a comprehensive plan presented
   as reality.
