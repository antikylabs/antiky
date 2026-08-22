# Launch key art prompt record

- Generation method: built-in ImageGen with `referenced_image_paths`
- Generation date: 2026-08-21
- Output role: Illustrative
- Implementation approval: selected under the owner's 2026-08-21 instruction to complete
  `docs/project-planning/goals/website-update/plan/goal-plan.md`
- Generated source retained at:
  `/Users/josephduncan/.codex/generated_images/01a022d2-3a98-77c3-833f-eb663d107c13/exec-bcc0243c-202f-451c-a550-210569e9b7b4.png`

## References passed to ImageGen

ImageGen received the four files at the paths below through `referenced_image_paths`. The digests
preserve the exact bytes used. Antiky Town was refreshed after generation, so its generation-time
bytes are also retained at
`packages/website/media-masters/marketing/reference-snapshots/antiky-town.png`.

1. `packages/website/design/references/home-media-first.png` — composition and brand restraint only;
   SHA-256 `8fa5b479388cc13930ff8b9d7d80653973a7fac1710a7eab6f8296f137888f57`.
2. `packages/website/media-masters/demos/antiky-town.png` — current-product palette, voxel scale,
   and warm material only; generation-time SHA-256
   `819b3a319f5b57242ebae41d4a8ece04a8726282135d18ed61e8a0afe78b9ddd`.
3. `packages/website/media-masters/demos/combat-arena.png` — planar geometry, hard-surface material,
   and cool values only; SHA-256
   `f8589e5f99f96ef4d74503ae3dfc63dca185375e638d451c2c184afde3f39b78`.
4. `packages/website/media-masters/demos/point-light-expo.png` — practical colored-light falloff and
   material response only; SHA-256
   `04b4ba42d185e8e34e7951b1e28bc183ba559fdef8996db5ebf1b91c7f06f55f`.

## Final prompt

```text
Use case: ads-marketing
Asset type: text-free launch key art, landscape 16:9

Input images:
Image 1: composition and brand-restraint reference only. Preserve its near-black editorial confidence, amber/cool-violet balance, large quiet regions, and disciplined contrast. Do not reproduce its website interface, copy, or exact game scene.
Image 2: current-product palette, voxel-scale, and warm material reference only. Use its tactile block construction and warm natural material cues, but do not copy or alter the town or its characters.
Image 3: planar geometry, hard-surface material, and cool-value reference only. Use its clear constructed shapes and restrained dark-to-light separation, but do not copy or alter the arena, vehicles, or HUD.
Image 4: practical colored-light falloff and material-response reference only. Use the way separate light sources reveal a rough surface, but do not copy or alter the scene, rings, characters, or instructions.

Primary request: Create a polished editorial campaign still life for Antiky Labs: a small, visibly physical tabletop maquette assembled from modular world fragments. It should suggest authored spatial building through block forms, a few stepped paths, and layered elevations, while remaining unmistakably an illustrative photographed studio object—not a renderer capture, concept screenshot, or fictional game.
Scene/backdrop: near-black studio ground and backdrop using #050506, #08090B, and #121317 values; no visible room and no horizon gradient.
Subject: one compact, incomplete physical maquette with tactile matte stone, dark wood, and painted block materials; visible miniature-scale seams and slightly imperfect handcrafted edges. No people, characters, vehicles, creatures, screens, or controls.
Style/medium: premium editorial still-life photography of a real physical maquette; restrained, believable material texture; not concept art and not a 3D game screenshot.
Composition/framing: wide front-on 16:9 composition. Keep the complete maquette in the right-center 55% of the frame. Preserve calm near-black negative space on the left for external HTML or campaign typography. Keep all important material inside the middle 70% safe area.
Lighting/mood: one controlled warm amber practical light and one restrained cool-violet light close to #8B7CFF, with natural falloff across the maquette. Deep blacks retain material detail. Immersive, precise, direct, ambitious without inflation.
Color palette: neutral near-black field; warm amber material highlights; scarce violet accent; no broad colored fog.
Output intent: launch/Open Graph key art. The pixels carry mood only and will be labeled Illustrative.

Constraints: no text, letters, numerals, logos, signatures, or watermarks; no website, app, window chrome, terminal, source code, chart, diagram, HUD, button, cursor, control, or fake interface; no gameplay, combat, finished world, invented feature, research output, performance claim, or copied demo geometry; no decorative grid, starfield, glowing cube, neon halo, glassmorphism, cyberpunk styling, or generic AI imagery. Do not reproduce any input scene. Use every input only for the labeled reference role.
```
