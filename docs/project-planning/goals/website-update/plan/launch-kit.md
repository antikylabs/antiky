# Website launch image kit

Status: implementation set complete

These files are illustrative marketing material, not screenshots or evidence of shipped behavior.
Antiky Town is the website's primary product key art and opening proof. The generated set is limited
to Open Graph/Twitter metadata and external launch material.

## Deliveries

| Placement | Master | Delivery | Delivery dimensions | SHA-256 |
| --- | --- | --- | --- | --- |
| Open Graph, Twitter, landscape announcement | `packages/website/media-masters/marketing/launch-key-art.png` | `packages/website/public/media/marketing/launch-key-art.webp` | 1600 × 900 | `95774e749f9b796fe51e4656b22ca276c378dcc219fabe455b45c8f51166cfbc` |
| Square announcement | `packages/website/media-masters/marketing/launch-announcement-square.png` | `packages/website/public/media/marketing/launch-announcement-square.webp` | 1200 × 1200 | `67ea3b79ad9caf52b7c975f949fac3cb026d3cc83cba47b4a3b176b981542e2d` |
| Portrait announcement | `packages/website/media-masters/marketing/launch-announcement-portrait.png` | `packages/website/public/media/marketing/launch-announcement-portrait.webp` | 1080 × 1350 | `938b26856a90dd8aaa5bed533d9428b816382913305880d246ffaf93a3ff7f5b` |

The three crops were generated as separate ImageGen requests. They are not automatic crops of one
master. Each final delivery was reviewed at the dimensions above.

## Required label and alt text

Visible caption when the image appears in editorial material:

> Illustrative launch artwork

Landscape alt text:

> Illustrative Antiky Labs launch artwork showing a physical modular maquette under restrained amber and violet studio light.

Square and portrait alt text:

> Illustrative Antiky Labs artwork showing an abstract modular physical maquette under restrained amber and violet light.

## Typography and claims

The image files contain no text, logo, UI, gameplay, chart, or technical claim. Add all launch copy,
status, product names, and calls to action as accessible external typography. Do not call the
maquette a game world, Studio view, research result, or architecture diagram.

## Provenance

Every master has a same-name `.prompt.md` sidecar. The sidecars record the full final prompt,
generation date, reference roles, exact reference digests, and selection basis. All three calls
received the same four exact files through `referenced_image_paths`:

1. `packages/website/design/references/home-media-first.png`
2. `packages/website/media-masters/marketing/reference-snapshots/antiky-town.png`
3. `packages/website/media-masters/demos/combat-arena.png`
4. `packages/website/media-masters/demos/point-light-expo.png`

The Antiky Town snapshot preserves the generation-time bytes because its live evidence master was
recaptured later. Combat Arena remains in this historical media input record only; a text-only Games
listing is approved, but the image is not approved for public website presentation. The
authoritative structured record is `packages/website/media-publication.json`.
