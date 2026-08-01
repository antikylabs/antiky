---
name: Antiky Labs
description: A clean, media-first dark system that lets working demos and documented artifacts carry the claim.
colors:
  page-black: "#050506"
  media-black: "#08090B"
  surface: "#0B0C0E"
  surface-raised: "#121317"
  surface-soft: "#18191E"
  line: "#292A31"
  line-strong: "#3A3B44"
  text: "#F4F4F1"
  text-muted: "#A6A6AE"
  text-faint: "#74757E"
  action-ink: "#0A0815"
  accent: "#8B7CFF"
  accent-hover: "#A69BFF"
  success: "#48C78E"
  warning: "#E9B64F"
  error: "#FF6B6B"
typography:
  display:
    fontFamily: "Space Grotesk Variable, sans-serif"
    fontSize: "clamp(3.5rem, 7.7vw, 7rem)"
    fontWeight: 560
    lineHeight: 0.93
    letterSpacing: "-0.032em"
  hero:
    fontFamily: "Space Grotesk Variable, sans-serif"
    fontSize: "clamp(3.4rem, 6vw, 5.8rem)"
    fontWeight: 560
    lineHeight: 0.92
    letterSpacing: "-0.032em"
  section:
    fontFamily: "Space Grotesk Variable, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 4.8rem)"
    fontWeight: 560
    lineHeight: 0.98
    letterSpacing: "-0.032em"
  lead:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "clamp(1.08rem, 1.6vw, 1.3rem)"
    fontWeight: 400
    lineHeight: 1.52
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  technical:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.08em"
rounded:
  nested: "5px"
  compact: "6px"
  control: "8px"
  media: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
  gutter: "clamp(24px, 4vw, 64px)"
  gutter-mobile: "18px"
  section: "clamp(96px, 10vw, 150px)"
  section-home: "clamp(104px, 10vw, 160px)"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control}"
  media-activation:
    backgroundColor: "{colors.text}"
    textColor: "{colors.page-black}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "50px"
  live-media-stage:
    backgroundColor: "{colors.media-black}"
    rounded: "{rounded.media}"
    width: "100%"
  directional-control:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    size: "44px"
---

# Design System: Antiky Labs

## Overview

**Creative North Star: "Media First"**

Antiky Labs is an evidence-led, near-black editorial system. The interface recedes so a working
browser study, verified poster, source pane, or documented artifact can carry the visual claim.
Large Space Grotesk headlines and quiet Inter copy provide confidence without turning the site into
a themed developer portfolio.

The signature composition is one dominant media field with a compact, opaque copy or control layer.
It should feel technically credible and immediately legible: restrained chrome, hairline structure,
explicit states, and a single violet action family around imagery that supplies its own color.

Product maturity is written plainly. Live work, emerging tools, active research, and planned worlds
must not be made equivalent through visual hype.

**The Process Is Not the Pitch Rule.** Internal development process, debates, and implementation
method belong in supporting documentation; public hierarchy begins with working output, evidence, or
a clearly labeled plan.

**Key Characteristics:**

- One dominant evidence-bearing media region per viewport.
- Near-black editorial surfaces with fine structural rules.
- Large, blunt headlines paired with concise, human copy.
- One scarce violet action family; imagery carries the broader color range.
- Explicit product state and explicit still-to-live transitions.
- Asymmetric splits and editorial rows instead of repeated feature-card grids.

## Colors

The interface is almost neutral so live rendering and research artifacts remain visually primary.

### Primary

- **Antiky Violet:** the sole brand accent family, used for the strongest action, selected technical
  state, text selection, and keyboard focus. Its lighter companion is a hover state, not a second
  accent.

### Neutral

- **Page Black and Media Black:** the document ground and the fallback behind live rendering.
- **Editorial Surfaces:** primary, raised, and soft near-black planes distinguish contained regions,
  menus, selected controls, and quiet hover states without decorative lighting.
- **Structural Lines:** low-contrast rules separate rows, frames, and major bands; stronger lines are
  reserved for active boundaries and compact controls.
- **Text, Muted Text, and Faint Text:** primary reading, supporting explanation, and technical metadata.
  Faint text is never the only carrier of important state.
- **Action Ink:** the dark foreground used on violet primary actions.

### State

- **Live Green:** confirms running or presently available work.
- **Research Amber:** identifies active investigation and the WebGL2 technical state.
- **Error Red:** belongs only to failure and recovery states.

**The Scarce Accent Rule.** Violet identifies the next meaningful action or a selected technical
state; it does not tint whole sections, headings, borders, shadows, or decorative effects.

## Typography

**Display Font:** Space Grotesk Variable (sans-serif fallback)  
**Body Font:** Inter Variable (sans-serif fallback)  
**Technical Font:** IBM Plex Mono (monospace fallback)

Space Grotesk gives headlines a broad, blunt silhouette. Inter keeps editorial prose and controls
quiet. IBM Plex Mono makes measurements and renderer state feel precise without turning ordinary
marketing copy into a terminal.

### Hierarchy

- **Display:** fluid page titles, weight 560, tight line-height and tracking; keep them to a compact
  phrase before forcing additional wraps.
- **Hero:** the home statement, slightly smaller than the largest internal-page title so the live
  media remains dominant.
- **Section:** fluid editorial headings with near-solid leading and a practical maximum line length.
- **Lead:** larger Inter copy used once to establish the section's central idea.
- **Body:** regular Inter at the browser default size, generally kept near 64–68 characters per line.
- **Technical:** compact mono for backend, frame rate, draw calls, source tabs, status, and attribution.
  Use the smallest 9–10px labels only for secondary non-reading metadata; interactive labels should
  remain at least 11px.

Headings use sentence case. Tight tracking stays near the documented display values and never goes
below `-0.04em` except the single oversized world wordmark. Do not add decorative uppercase eyebrow
labels above every heading.

**The Functional Mono Rule.** Mono type must communicate status, measurement, source, attribution,
or a real section function; it is not decorative futurism.

## Layout

The desktop shell is capped at 1440px with fluid horizontal gutters. The sticky header is 68px tall;
the home stage fills the remaining small viewport height and places a deliberately opaque copy block
over its lower-left region. Internal pages alternate full-width media, unequal editorial splits, and
hairline-separated rows.

Major sections use the documented fluid section rhythm. Copy columns stay narrow while media is
allowed to expand. A page should normally have one dominant media stage; supporting evidence follows
as rows, prose, or source panes rather than a competing wall of tiles.

At 900px and below, desktop navigation becomes a disclosure menu and multi-column regions stack. At
620px and below, gutters become 18px, the header becomes 62px, the hierarchy becomes a direct vertical
sequence, and large media may bleed to the viewport edge with square side edges. Mobile live-media
control rows and pause actions are at least 44px high; directional controls are 44px square. Preserve
the same hit-area floor for new interactive stage controls even when their visible glyphs are smaller.

**The One Stage Rule.** Give each viewport one obvious evidence-bearing media field and let everything
else establish context, state, or the next action.

## Elevation & Depth

The editorial system is flat by default. Near-black tonal layers and one-pixel rules establish most
hierarchy. Diffuse black shadows are reserved for true overlays: the hero copy field, disclosure menu,
media activation, and directional pad. Shadows always have a visible downward offset and never become
colored halos; ordinary content containers do not combine border and shadow.

Depth of field belongs to the rendered evidence, not the site chrome. Use restrained renderer-owned
DOF to separate spatial layers while keeping the playable subject, route through the scene, and UI
controls readable. The full study should reveal more spatial information than the atmospheric home
crop; do not blur working proof into a cinematic beauty shot.

**The Proof Stays in Focus Rule.** Depth may establish world scale and foreground-to-background
separation, but it must never hide the interaction, result, or evidence the frame exists to show.

## Shapes

The form language is planar and lightly softened. Nested segmented-control selections use the smallest
corners; compact tags and menu rows use 6px; ordinary controls use 8px; media and code frames use 12px.
The home copy field remains square because it is a compositional plane, not a floating card. Full media
frames lose their side radius at the mobile edge.

Status dots are the only recurring circular state mark. Pills are not a general container language.
Prefer straight hairlines, clipped media, and large planes over decorative grids, textured chrome, or
arbitrary rounded cards.

## Components

### Navigation

The desktop header keeps the brand left, the current public destinations right, and one bordered demo
action. Default links are muted; hover and current-page states become primary text without animated
underlines. The mobile semantic disclosure uses a raised surface, 48px rows, and a visible active state.
Navigation reflects the current information architecture; removed or internal destinations do not
remain as disabled placeholders.

### Buttons and Links

The primary action is a 46px-high violet rectangle with dark ink, 8px corners, and an authored 18px
SVG arrow. Hover raises it by 2px and moves to the lighter violet state. Text links use the same arrow
vocabulary without a container. Focus is always a 2px violet outline with a 3px offset. Media activation
is visually distinct: a near-white 50px control over the poster, because it changes the frame from
passive evidence to live interaction.

### Live-Media Stage

The live-media stage is the signature pattern. It owns the poster or fixed preview, canvas, phase,
fallback, backend choice, measurements, pause/resume state, and interaction controls inside one clipped
frame. Hero, full-study, and thumbnail variants share this state model while exposing only the controls
appropriate to their context.

Where a verified poster exists, show it immediately and build the renderer behind it. The full study
holds that poster until the visitor chooses **Enter the town**; the home hero may autoplay only after it
is near the viewport. With reduced motion, the hero stays on the poster until explicit activation,
transitions collapse, and the ready/paused canvas does not scale. Running stages pause when they leave
the viewport; the ambient hero may resume when it returns only when reduced motion is not requested.

Full-study HUDs may expose backend, running state, frame rate, instances, draw calls, pause, and either
pointer orbit or movement controls. On narrow screens, remove explanatory labels and lower-priority
measurements before shrinking actions. The backend group, pause control, and four-way pad remain easy to
hit. Loading, ready, running, paused, and error states are always understandable in text; retry remains
available after failure. Thumbnails are visually representative and non-interactive.

### Editorial Rows

Rows combine plain-text maturity, a strong title, a short description, and one authored SVG action mark.
Hover adds a quiet surface while the arrow moves diagonally; row geometry does not jump. On mobile, state
moves above the title and description, preserving a direct reading sequence.

### Status Language

Use direct state labels such as **Live now**, **Live demo**, **Emerging**, **Active research**, and
**Planned**. State is written as text and may be reinforced—never replaced—by green, violet, amber, or
gray. A planned product must not receive the same visual treatment as a running study.

### Technical Controls and Source Panes

Backend choices behave as a compact segmented control with the selected option reversed to light. HUD
chips are informational, not decorative badges. Source panes use a 12px frame, a quiet surface tab bar,
compact mono type, and backend-aware selected text; the currently running backend may guide the initial
tab but never overrides an explicit visitor choice.

## Do's and Don'ts

### Do

- **Do** lead with a verified poster, live demo, or documented artifact.
- **Do** distinguish running work, emerging tools, active research, and future intent in text.
- **Do** preserve poster-first loading, explicit activation, pause/resume, and reduced-motion behavior.
- **Do** keep mobile live-media actions at least 44px high and directional controls 44px square.
- **Do** use one dominant media frame, restrained depth of field, and varied editorial pacing.
- **Do** use the authored SVG icon family for directional actions.

### Don't

- **Don't** treat internal development process as marketing copy or homepage hierarchy.
- **Don't** present generated direction art as Emberwyrd footage or research evidence.
- **Don't** use depth of field to obscure the subject, controls, or proof of a working study.
- **Don't** use feature-card walls, decorative section numbers, or generic icon grids.
- **Don't** use gradient text, glassmorphism, neon halos, starfields, or ambient WebGL decoration.
- **Don't** invent packages, maturity, dates, metrics, model results, customers, or playable releases.
