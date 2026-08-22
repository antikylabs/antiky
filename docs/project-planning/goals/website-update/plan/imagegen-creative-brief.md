# ImageGen launch creative brief

Status: approved direction for the 2026-08-21 implementation

Approval basis: the owner delegated completion of `goal-plan.md`, including its required ImageGen
launch set. The selected direction below is bounded by the approved media matrix. A change to subject,
role, placement, or constraints requires another review.

## Audience and placements

The audience is a technically skeptical game builder encountering Antiky Labs for the first time.
The assets are launch identity material for the home Open Graph image and external landscape, square,
and portrait announcements. They establish a consistent mood around the launch; they do not prove a
Framework, Studio, demo, research, or game capability.

## Direction: physical world fragments

Create a restrained editorial still life of a small, visibly physical maquette assembled from
modular world fragments. The object can suggest game-world building through block forms, paths, and
spatial layers, but it must remain an illustrative studio object rather than a screenshot or a
fictional game scene. Visible joins between modules, imperfect matte surfaces, and practical
lighting should make the physical construction legible.

The scene uses the Antiky near-black editorial ground (`#050506`, `#08090B`, and `#121317`) with one
controlled violet light close to `#8B7CFF` and a restrained warm amber light borrowed from the real
demo palette. Rich color stays on the subject. There is no violet fog, glow halo, gradient text,
glassmorphism, decorative grid, starfield, cyberpunk heads-up display, or glowing cube.

The result supports the Antiky thesis by showing authored spatial material that is precise enough to
inspect yet open enough to keep building. It does not visualize agents, automation, architecture,
performance, or a feature workflow.

## Input-reference roles

Every ImageGen call must receive these exact local references through `referenced_image_paths` and
name their roles in the prompt:

1. `packages/website/design/references/home-media-first.png` — composition and brand-restraint
   reference only; do not reproduce its interface or text.
2. `packages/website/media-masters/demos/antiky-town.png` — current-product palette, world scale, and
   warm-light reference only; do not copy or alter the scene.
3. `packages/website/media-masters/demos/combat-arena.png` — cool-violet contrast and dark-value
   reference only; do not copy or alter the scene.
4. `packages/website/media-masters/demos/point-light-expo.png` — practical point-light falloff and
   material-response reference only; do not copy or alter the scene.

These are generation references, not edit targets. No output may be called product evidence.
Combat Arena was withheld from the public website after generation; its master remains here only to
preserve the exact input record for the completed calls. It is not approved public key art or proof.

## Shared constraints

- Generate each aspect ratio as a separate request: 16:9, 1:1, and 4:5.
- Render no text, letters, numerals, logos, signatures, or watermarks.
- Do not render a website, app, terminal, source code, chart, diagram, heads-up display, control,
  window chrome, or fake interface.
- Do not render characters, gameplay, combat, a finished world, a fictional feature, or research
  output.
- Do not reproduce an input scene. Use references only for restraint, palette, scale, lighting, and
  material response.
- Keep the proof/illustration boundary obvious: this is polished editorial still-life photography of
  a physical maquette, not a renderer capture or concept screenshot.
- Preserve dark negative space for real external typography, but place no typography in the pixels.

## Crop-specific composition

- **Landscape 16:9:** wide front-on studio composition. Keep the maquette in the right-center 55% and
  quiet near-black negative space on the left. Avoid an empty background that reads as a gradient.
- **Square 1:1:** place the maquette near center with breathing room on all sides. Keep its entire
  silhouette intact at small social-preview sizes.
- **Portrait 4:5:** place the maquette in the middle/lower portion, keep the top quiet, and preserve
  enough side space to avoid a cramped mobile crop.

## Review and rejection test

Inspect the generated master and its final derivative independently. Reject any asset with accidental
text, a recognizable third-party mark, a product-like interface, copied demo geometry, implausible
neon treatment, clipped focal material, muddy black values, or a composition that could reasonably be
mistaken for current Antiky output. Record the final prompt, reference roles, method, date, master
digest, delivery digest, and implementation approval beside each selected master.
