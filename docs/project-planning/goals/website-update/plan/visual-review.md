# Website launch visual review

Review date: 2026-08-22 UTC

Result: pass; no unresolved visual blocker

## Scope and record

The production build was reviewed at a 1440 × 960 desktop viewport and a 390 × 844 mobile viewport.
Every screenshot is full-page and retains the exact reviewed viewport width.

Reviewed routes:

- Home (`/`)
- Framework (`/framework`)
- Studio (`/studio`)
- Games (`/games`)
- Demos index (`/demos`)
- Antiky Town detail (`/demos/antiky-town`)
- Research (`/research`)
- Resources (`/resources`)
- Shader library (`/resources/shaders`)
- Project library (`/resources/projects`)
- Skills library (`/resources/skills`)
- Roadmap (`/roadmap`)
- Docs home (`/docs`)
- Skills guide (`/docs/skills/overview`)

The first-round captures are under `visual-review/first-round/{desktop,mobile}/`. The confirmation
captures are under `visual-review/confirmation/{desktop,mobile}/`.

## First-round findings and batch fix

1. `/resources/projects` still said four technical studies after Combat Arena was withheld. A
   failing production-copy assertion was added, then the page was changed to “three published
   technical studies.”
2. The 390px Antiky Town detail page placed its complete 16:9 poster inside a 68svh interactive
   stage, producing excessive black letterboxing before activation. A failing responsive CSS
   assertion was added, then the poster phase was changed to use a 16:9 container. Selecting Play
   still expands the stage for interaction.

Some first-round long-page screenshots showed blank lazy-image placeholders on Studio, Demos, and
Research. Browser inspection showed those images had not received a `currentSrc`; direct asset and
manifest checks passed. This was a capture-method artifact, not a site defect. The confirmation
pass scrolled every image into view, waited for non-zero natural dimensions, returned to the top,
and then captured the page. All evidence images appear in the confirmation set.

## Confirmation

- Antiky Town is the opening homepage image, first Games study, first Demos study, Framework proof,
  and first demo action at both widths.
- Combat Arena has a text-only, in-development listing on Games. It has no poster, demo link, staged
  artifact, public media file, or static demo entry. A direct `/demos/combat-arena` request returned
  HTTP 404.
- All new Studio and Research evidence is visible, uncropped, and legible at both widths.
- Header, mobile menu, footer, status labels, calls to action, docs navigation, and library maturity
  boundaries remain readable without horizontal overflow.
- The Antiky Town mobile poster now occupies its 16:9 frame without the first-round empty bands.
- No screenshot contains unrelated desktop content, credentials, personal browser state, or painted
  redaction.

## Click-to-play check

On a fresh production navigation to `/demos/antiky-town`, the Browser network filter for
`antiky.game.js` returned no request. After selecting **Play Antiky Town**, the browser requested
`/demo-builds/antiky-town/antiky.game.js` and received HTTP 304 from the local production server.
The running frame is saved as
`visual-review/confirmation/desktop/demo-antiky-town-running.png`.

## Generated delivery review

The generated launch deliveries were opened at their actual output sizes, not only as masters:

- landscape: 1600 × 900;
- square: 1200 × 1200;
- portrait: 1080 × 1350.

The subject remains inside each safe area. All three stay text-free and contain no UI, gameplay,
research result, technical diagram, logo, signature, or watermark. Their use remains explicitly
Illustrative. Antiky Town, not generated artwork, is the website's primary product key art.

## Tooling note

The in-app Browser client initially reported no available browser instances. A clean Chrome window
was opened as a fallback, and no screenshot from the unrelated pre-existing browser window was
saved. An isolated Playwright Browser session then became available and completed the exact-width
captures, accessibility snapshots, network inspection, and Play activation check recorded here.
