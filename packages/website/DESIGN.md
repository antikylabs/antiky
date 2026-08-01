---
name: Antiky Labs
description: A clean, media-first dark system for playable work, an emerging framework, research, and future worlds.
colors:
  page-black: "#050506"
  surface: "#0B0C0E"
  surface-raised: "#121317"
  surface-soft: "#18191E"
  line: "#292A31"
  line-strong: "#3A3B44"
  text: "#F4F4F1"
  text-muted: "#A6A6AE"
  text-faint: "#74757E"
  accent: "#8B7CFF"
  accent-hover: "#A69BFF"
  success: "#48C78E"
  warning: "#E9B64F"
  error: "#FF6B6B"
typography:
  display:
    fontFamily: "Space Grotesk Variable, sans-serif"
    fontSize: "clamp(3.4rem, 6vw, 5.8rem)"
    fontWeight: 560
    lineHeight: 0.92
    letterSpacing: "-0.032em"
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  measurement:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.08em"
rounded:
  control: "8px"
  media: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
  section: "clamp(96px, 10vw, 150px)"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.page-black}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.page-black}"
    rounded: "{rounded.control}"
  media-frame:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.media}"
---

# Design System: Antiky Labs

## Overview

**Creative North Star: Media First**

Antiky Labs uses a clean, near-black interface that gives playable work and real artifacts most of
the visual weight. The system is quiet around the subject: large Space Grotesk headlines, restrained
navigation, hairline structure, and one violet action color. It should feel direct and contemporary,
not like a themed developer portfolio.

Product state is part of the design. Live demos, emerging framework work, active research, and
planned worlds are named in text rather than implied through visual hype. The current hero uses a
real still from Depth Study, then turns that same frame into the live study after explicit action.

**Key characteristics:**

- One dominant media region per viewport.
- Editorial rows and asymmetric splits instead of same-size feature cards.
- Large type with concise copy and generous section separation.
- Neutral surfaces with violet reserved for primary action.
- Real work as imagery; no invented product footage.

## Colors

The palette is almost neutral so game imagery and research artifacts can carry their own color.

- **Page Black** (`#050506`): document background and darkest media fallback.
- **Surface** (`#0B0C0E`): footer, statement bands, and primary contained surfaces.
- **Raised Surface** (`#121317`): disclosed navigation and elevated utility UI.
- **Soft Surface** (`#18191E`): hover and selected-control fill.
- **Line / Strong Line** (`#292A31` / `#3A3B44`): structural rules and active boundaries.
- **Text / Muted / Faint** (`#F4F4F1` / `#A6A6AE` / `#74757E`): primary copy, support copy,
  and metadata.
- **Antiky Violet** (`#8B7CFF`, hover `#A69BFF`): primary action and keyboard focus only.
- **State colors:** success `#48C78E`, active research `#E9B64F`, error `#FF6B6B`.

**The scarce accent rule.** Violet identifies the next meaningful action; it does not tint whole
sections, borders, headings, or decorative effects.

## Typography

**Display Font:** Space Grotesk Variable
**Body Font:** Inter Variable
**Measurement Font:** IBM Plex Mono

Space Grotesk provides broad, blunt headlines. Inter keeps editorial copy and controls quiet. IBM
Plex Mono appears only for measurements, backend state, compact status, and source code.

- **Home hero:** `clamp(3.4rem, 6vw, 5.8rem)`, weight 560, line-height `0.92`.
- **Page title:** `clamp(3.5rem, 7.7vw, 7rem)`, line-height `0.93`; reduce before reflow on mobile.
- **Section title:** `clamp(2.5rem, 4.6vw, 4.8rem)`, line-height `0.98`.
- **Lead:** `clamp(1.08rem, 1.6vw, 1.3rem)`, line-height about `1.52`.
- **Body:** `1rem`, line-height `1.6`, with prose kept near 68 characters.
- **Metadata:** `9px`–`11px` mono only when the content is genuinely status or measurement.

Headings use sentence case, tracking near `-0.032em`, and no eyebrow heading labels. Tracking never
goes below `-0.04em`.

## Layout

The content shell is 1440px with responsive horizontal gutters of `clamp(24px, 4vw, 64px)` and 18px
on small screens. The sticky header is 68px desktop and 62px mobile. The home hero fills the remaining
viewport and places a controlled dark copy block over the lower-left of a full-bleed study.

Major sections use `clamp(96px, 10vw, 150px)` vertical space. Editorial indexes are full-width rows
with status, title, description, and one authored arrow. Two-column regions use unequal fractions and
stack at 900px. At 620px the hierarchy becomes a direct sequence and every interactive target remains
at least 44px high. Horizontal overflow is not permitted.

## Elevation & Depth

The system is flat by default. Hairline rules and tonal surfaces establish most hierarchy. The only
general elevation is `0 16px 44px rgba(0, 0, 0, 0.34)`, used for the hero copy block, mobile menu, and
the demo activation control. It always has a visible downward offset and never becomes a colored halo.

Media frames may use a 1px structural edge. Do not pair a border and shadow on ordinary content
containers.

## Shapes

Controls use an 8px radius. Media and code frames use 12px. The hero copy block remains square because
it is a compositional field rather than a floating card. Status dots are the only circular state mark;
pills are not a general component language. Structure comes from straight hairlines and large planar
regions, not decorative grids or textured chrome.

## Components

### Navigation

The desktop header keeps the brand left, four quiet routes right, and one bordered action. Active and
hover states change text or surface tone without animated underlines. Mobile uses a semantic `details`
disclosure with 48px rows and a visible current-page state.

### Buttons and links

Primary buttons are 46px-high violet rectangles with dark text, 8px corners, and an authored 18px SVG
arrow. Hover lifts by 2px and shifts to `#A69BFF`. Text links use the same arrow vocabulary without a
container. Focus is always a 2px violet outline with 3px offset.

### Media and demo stage

A stage shows an honest poster or fixed real render first. “Run live” explicitly starts animation;
running, paused, loading, and error states remain labeled. Full study pages expose backend selection,
frame rate, instances, pause, retry, pointer/touch orbit, and keyboard orbit. The homepage removes
technical HUD clutter but preserves activation and pause.

### Editorial rows

Rows carry plain-text status, a strong title, a one- or two-sentence description, and one SVG action
mark. Hover adds a quiet surface and horizontal inset. Rows replace card matrices across the public
information architecture.

### Status language

Use **Live demo**, **Emerging**, **Active research**, and **Planned** exactly. State is written as text
and may be reinforced—never replaced—by green, violet, amber, or gray.

## Do's and Don'ts

### Do

- **Do** lead with a real demo, still, or documented artifact.
- **Do** distinguish what runs now from emerging work and future intent.
- **Do** use one dominant media frame and varied editorial pacing.
- **Do** preserve the explicit still-to-live transition and reduced-motion behavior.
- **Do** use the authored SVG icon family for directional actions.

### Don't

- **Don't** market the internal development process or turn it into homepage hierarchy.
- **Don't** present generated direction art as Emberwyrd footage or research evidence.
- **Don't** use feature-card walls, eyebrow headings, decorative section numbers, or generic icon grids.
- **Don't** use gradient text, glassmorphism, neon halos, starfields, or ambient WebGL decoration.
- **Don't** invent packages, maturity, dates, metrics, model results, customers, or playable releases.
