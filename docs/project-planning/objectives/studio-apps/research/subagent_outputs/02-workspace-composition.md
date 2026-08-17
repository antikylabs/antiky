# Workspace composition, design coherence, and accessibility

**Research date:** 2026-08-14
**Scope:** Research line 02 only. No external layout package was installed or run.

- **Established** means verified in repository code/tests, a directly inspected artifact, or a primary standard/source.
- **Claimed** means stated by project documentation or an upstream maintainer but not independently exercised here.
- **Inferred** means reasoning from established or claimed evidence.

## Findings

### 1. Current workspace behavior

- **Established:** The workspace is one fixed React component tree with four known surfaces: Live game, Terminal, Inspection, and Activity. `PanelProps.workspaceArea` is a closed four-value union, and `StudioShell` mounts the panels directly rather than through a registry or data model. Evidence: `packages/studio/app/src/components/primitives.tsx:3-24`; `packages/studio/app/src/components/StudioShell.tsx:283-360`.

- **Established:** The wide layout is a two-by-two CSS Grid:

  ```text
  Live game   Inspection
  Terminal    Activity
  ```

  The grid uses one shared column split and one shared row split rather than independent pane geometry. Evidence: `packages/studio/app/src/styles.css:245-258`, `packages/studio/app/src/styles.css:420-434`.

- **Established:** Split state is two percentages held in `StudioShell` React state. Defaults are 69% column and 64% row; both axes clamp to 25–80% or 25–75%. Pointer dragging, arrow-key stepping, and reset are implemented. Evidence: `packages/studio/app/src/components/StudioShell.tsx:89-95`, `packages/studio/app/src/components/StudioShell.tsx:162-204`, `packages/studio/app/src/components/workspaceLayout.ts:10-49`.

- **Established:** No layout persistence is present in the inspected Studio path. `workspaceSplits` is initialized with `useState`, and neither the split module nor `StudioShell` reads or writes storage. The only browser-local preference wired at startup is SSPS presence. Evidence: `packages/studio/app/src/components/StudioShell.tsx:89-95`; `packages/studio/app/src/main.tsx:31-45`; `packages/studio/app/src/sspsPresence.ts:1-34`.

- **Inferred:** Split changes survive Settings opening and a same-window project prop change because `StudioShell` remains mounted, but they reset on a Studio reload or any remount. There is no per-app, per-project, or per-device layout identity.

- **Established:** At 760 CSS px or narrower, the workspace becomes a single vertical sequence—Game, Terminal, Inspection, Activity—with fixed heights. Resizers disappear and the page becomes vertically scrollable. Evidence: `packages/studio/app/src/responsive.css:1-59`. This matches the documented behavior at narrow width or high zoom: `docs/user-facing-docs/studio/getting-started.md:80-87`.

- **Established:** Responsive presentation does not mutate the two stored split values; it only stops using their CSS variables while the single-column media query applies. This is a useful precedent for treating responsive layout as an ephemeral projection, not as saved user intent.

- **Established:** Settings deliberately overlays a still-mounted workspace. The workspace and simulation navigation become `inert` and `aria-hidden`, and the native terminal is hidden without being unmounted. Evidence: `packages/studio/app/src/components/StudioShell.tsx:206-217`, `packages/studio/app/src/components/StudioShell.tsx:283-288`, `packages/studio/app/src/components/StudioShell.tsx:339-352`, `packages/studio/app/src/components/StudioShell.tsx:404-409`; `packages/studio/app/tests/components/StudioShell.test.tsx:258-282`; `packages/studio/app/tests/NativeTerminal.test.ts:67-73`.

- **Established:** The live game is one sandboxed iframe with WebGPU, fullscreen, gamepad, autoplay, same-origin scripts, and pointer-lock permissions. Current tests preserve one stable iframe mount for fullscreen and Settings. Evidence: `packages/studio/app/src/components/LiveGameFrame.tsx:6-20`; `packages/studio/app/tests/components/StudioShell.test.tsx:258-282`, `packages/studio/app/tests/components/StudioShell.test.tsx:380-400`.

- **Established:** The native terminal is not ordinary DOM content. React measures a placeholder, clips it to the visible viewport, and sends geometry or `null` to the Tauri host. The host uses `null` to hide the AppKit view. Its minimum usable measured geometry is 80 by 40 CSS px. Evidence: `packages/studio/app/src/NativeTerminal.tsx:23-89`, `packages/studio/app/src/NativeTerminal.tsx:111-216`; `packages/studio/tauri/src/commands.rs:292-307`; `packages/studio/tauri/src/native/terminal_bridge.m:430-459`.

- **Established:** While the terminal has focus, its native surface owns Control-key equivalents; unhandled Command shortcuts continue through AppKit. Evidence: `packages/studio/tauri/tests/terminal-bridge.test.mjs:130-180`. Any generalized layout must therefore coordinate native focus and geometry rather than treating Terminal as a normal movable `<div>`.

### 2. Current visual coherence

- **Established:** Workspace, launcher, Settings, inspection, activity, and terminal styles share one root palette and the same Space Grotesk, Inter, and IBM Plex Mono font families. Evidence: `packages/studio/app/src/main.tsx:1-26`; `packages/studio/app/src/styles.css:1-23`.

- **Established:** The common `Panel` primitive owns a semantic `<section>`, accessible panel name, heading, and action area. Evidence: `packages/studio/app/src/components/primitives.tsx:3-24`.

- **Established:** Launcher and Settings reuse the global tokens but add their own card, gradient, radius, spacing, and type treatments. Evidence: `packages/studio/app/src/launcher.css:1-70`; `packages/studio/app/src/settings.css:1-74`.

- **Claimed:** The owner considers the project page visually inconsistent with the main and Settings pages and explicitly wants to prevent generic-looking apps. Evidence: `docs/objectives/studio-apps/objective.md:36-46`.

- **Claimed:** The archived Studio objective says the current workspace was aligned to the website's
  compact, game-first language. Evidence:
  `docs/project-planning/objectives/_archives/2026-08-10-studio-summary.md`.

- **Established:** Repository images `packages/website/public/media/antiky-studio-workspace.jpeg` and `packages/website/public/media/machinery/studio-workspace-wide-v1.webp` visibly show the current four-area, dark, compact workspace. Git records them as 2026-08-08 and 2026-08-09 artifacts. They are useful visual references, but they are static images rather than proof of the current runtime at different viewport sizes or states.

- **Established:** Current Studio tests protect selected CSS dimensions and literal grid arrangements with source/SSR assertions. They do not perform rendered visual comparison. Evidence: `packages/studio/app/tests/components/StudioShell.test.tsx:181-225`, `packages/studio/app/tests/components/StudioShell.test.tsx:284-293`.

- **Inferred:** A panel contribution should supply identity, title, content, actions, and capability metadata while Studio renders panel chrome and focus treatment. Allowing each app to supply unrestricted outer chrome or global CSS would bypass the only existing design-coherence boundary.

- **Inferred:** The current `Panel` and token set are a useful starting boundary, not yet a complete design system. They do not define panel states such as closable, selected, hidden, docked, narrow, missing, failed, or input-owning.

### 3. Accessibility baseline and defects

#### Splitters

- **Established:** Both current splitters are focusable `separator` widgets with accessible names, orientations, current/minimum/maximum values, pointer capture, visible focus treatment, and orientation-correct arrow-key behavior. Evidence: `packages/studio/app/src/components/StudioShell.tsx:362-401`; `packages/studio/app/src/styles.css:290-344`; `packages/studio/app/tests/components/workspaceLayout.test.ts:11-34`.

- **Established:** The WAI-ARIA Window Splitter pattern expects a focusable `separator`, `aria-valuenow/min/max`, a name matching its primary pane, `aria-controls` for that pane, orientation-correct arrows, optional Home/End bounds, and optional F6 pane cycling. The APG itself notes that this pattern still lacks a completed functional example, so it supplies semantics and conventions rather than implementation proof. Primary source: [WAI-ARIA APG Window Splitter pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/).

- **Established:** Current splitters omit `aria-controls`. Their names describe pairs or rows rather than one identified primary pane. Evidence: `packages/studio/app/src/components/StudioShell.tsx:362-400`.

- **Established:** Current `Home` behavior resets to the product default, while APG’s optional Home convention moves to the smallest allowed primary-pane size. `End` is not implemented. Evidence: `packages/studio/app/src/components/workspaceLayout.ts:38-49`.

- **Inferred:** If Studio retains `Home` as reset, it should not present the control as an APG-conventional splitter without consciously documenting that difference. A generalized splitter can instead distinguish “reset layout” from “move to bound.”

- **Established:** WCAG 2.2 requires a non-dragging single-pointer alternative for dragging functionality, independently of keyboard support. Primary source: [WCAG 2.2 Understanding 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements).

- **Inferred:** The current arrow-key path satisfies keyboard access to resizing, but double-click only resets; it does not provide a single-click/tap way to achieve other sizes. The current resize interaction therefore appears not to satisfy WCAG 2.5.7 at AA. This needs a rendered interaction audit before recording a conformance result.

#### Tabs

- **Established:** The shared `Tabs` primitive uses `tablist`, `tab`, `aria-selected`, and roving `tabIndex`, but selection is wired only through `onClick`. It has no arrow-key handler, no `aria-controls`, and no tab/tabpanel IDs. Evidence: `packages/studio/app/src/components/primitives.tsx:37-65`.

- **Established:** Inspection and Activity tabpanels have `role="tabpanel"` but no `aria-labelledby`, and none is programmatically associated with its tab. Evidence: `packages/studio/app/src/components/InspectionPanel.tsx:145-171`; `packages/studio/app/src/components/ActivityPanel.tsx:153-180`.

- **Established:** WAI-ARIA’s Tabs pattern requires arrow navigation among tabs, Enter/Space activation for manual tabs, `aria-controls` from tab to panel, and `aria-labelledby` from panel to tab. Primary source: [WAI-ARIA APG Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

- **Inferred:** Because inactive tabs have `tabIndex=-1` and no arrow-key path, keyboard users can reach only the initially active Hierarchy and Events tabs. Stores, Snapshot, MCP calls, and Diagnostics are pointer-only in the current primitive. This conflicts with WCAG 2.1.1’s keyboard requirement. Primary source: [WCAG 2.2 Understanding 2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard).

- **Established:** Existing tests verify tab labels and broad DOM order but do not exercise focus movement or selection behavior. Evidence: `packages/studio/app/tests/App.test.tsx:14-30`; `packages/studio/app/tests/components/StudioShell.test.tsx:512-535`.

#### Modal Settings focus

- **Established:** `SettingsPage` declares `role="dialog"` and `aria-modal="true"`. Evidence: `packages/studio/app/src/components/SettingsPage.tsx:27-33`.

- **Established:** Opening Settings does not move focus into the dialog, trap Tab/Shift+Tab within it, handle Escape, or return focus on close. Its only close control is the title-bar “Workspace” button outside the dialog subtree. Evidence: `packages/studio/app/src/components/SettingsPage.tsx:1-84`; `packages/studio/app/src/components/StudioShell.tsx:263-280`, `packages/studio/app/src/components/StudioShell.tsx:404-409`.

- **Established:** WAI-ARIA’s modal dialog pattern requires focus to move inside on open, a contained tab sequence, Escape close, and focus return; it strongly recommends a visible close button inside the dialog. Primary source: [WAI-ARIA APG Modal Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

- **Inferred:** Current Settings behaves visually like an overlay page but exposes modal-dialog semantics it does not implement. Before apps add overlays, floating panes, or maximized panels, Studio needs one explicit choice: make Settings a real modal dialog, or make it a non-modal/page-level surface and remove the modal contract.

#### Focus order and competing input surfaces

- **Established:** Wide visual order is row-major—Game, Inspection, Terminal, Activity—but DOM and sequential focus order are Game, Terminal, Inspection, Activity. Tests intentionally enforce that source order. Evidence: `packages/studio/app/src/components/StudioShell.tsx:283-360`; `packages/studio/app/src/styles.css:245-252`; `packages/studio/app/tests/components/StudioShell.test.tsx:181-205`, `packages/studio/app/tests/components/StudioShell.test.tsx:512-535`.

- **Established:** WCAG allows focus order to differ from visual order when meaning and operation remain understandable, while recommending that focus reinforce implied visual order. Primary sources: [WCAG 2.2 Understanding 2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), [W3C C27 DOM order technique](https://www.w3.org/WAI/WCAG22/Techniques/css/C27).

- **Inferred:** The current column-grouped order is not automatically a WCAG failure, but arbitrary docking makes this substantially harder. Saving visual geometry without a logical navigation order can make focus appear to jump between distant regions.

- **Established:** Architecture requires the canvas, terminal, text field, and controller not to receive the same key, and says Studio should expose the current input owner. Evidence: `docs/architecture/studio/overview_A.md:217-225`.

- **Established:** The implementation gives the terminal a focusable `role="application"` mount and forwards focus to the native surface. The game is a separately focusable iframe. Evidence: `packages/studio/app/src/NativeTerminal.tsx:218-244`; `packages/studio/app/src/components/LiveGameFrame.tsx:10-19`.

- **Established:** WAI-ARIA defines `application` as a region with a custom interaction model that can cause assistive technology to pass standard input through to the application. Primary source: [WAI-ARIA 1.2 application role](https://www.w3.org/TR/wai-aria-1.2/#application).

- **Inferred:** Layout shortcuts must run only when Studio chrome owns input. Global arrow, F6, Escape, or modifier handlers could otherwise steal keys from Ghostty, a game iframe, a text editor, or a future viewport. Native-terminal and iframe escape behavior needs real keyboard and screen-reader verification; static markup cannot prove no keyboard trap. Primary source: [WCAG 2.2 Understanding 2.1.2 No Keyboard Trap](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html).

#### Reflow, focus, and contrast

- **Established:** WCAG 2.2 AA expects non-exempt content to reflow to 320 CSS px without two-dimensional scrolling. Games, maps, and interfaces that must keep toolbars visible can qualify for bounded exceptions, but text inside surrounding panels still needs reflow. Primary source: [WCAG 2.2 Understanding 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow).

- **Established:** The current single-column fallback is structurally aligned with reflow, but repository tests inspect CSS strings rather than rendering at 320 CSS px, 400% zoom, text zoom, or inside independently narrow docked panes. Evidence: `packages/studio/app/src/responsive.css:1-90`; `packages/studio/app/tests/components/StudioShell.test.tsx:181-225`.

- **Inferred:** Viewport media queries are insufficient once a panel can be docked into a narrow region of a wide window. Panel content must tolerate its container width, or the layout host must expose a narrow state without destructively changing saved layout.

- **Established:** The shell supplies visible focus styles for buttons, summaries, the game iframe, terminal mount, and splitters. Evidence: `packages/studio/app/src/styles.css:44-57`, `packages/studio/app/src/styles.css:300-311`; `packages/studio/app/src/terminal.css:10-13`. Primary requirement: [WCAG 2.2 Understanding 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible).

- **Established:** Focused controls must not become entirely hidden by author-created overlays; configurable interfaces are tested from their initial positions. Primary source: [WCAG 2.2 Understanding 2.4.11 Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum).

- **Established:** `--text-faint` is `#74757e`, `--surface-raised` is `#121317`, and the status bar renders 8 px faint text on that raised surface. Evidence: `packages/studio/app/src/styles.css:5-12`, `packages/studio/app/src/styles.css:590-600`.

- **Established:** Applying W3C’s relative-luminance formula gives that pair approximately **4.06:1**, below WCAG 2.2 AA’s 4.5:1 requirement for normal-sized text. Primary sources: [WCAG 2.2 SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum), [W3C G18 calculation technique](https://www.w3.org/WAI/WCAG22/Techniques/general/G18).

- **Inferred:** The current palette should be audited and corrected before it becomes a frozen app-design contract. Shared tokens improve coherence only if the shared values meet the accessibility baseline.

## Layout state and ownership model

The following is an **inferred research model**, not an accepted design.

| State | Proposed authority | Lifetime | Constraint |
| --- | --- | --- | --- |
| Layout schema, valid node kinds, panel IDs, bounds, responsive rules, safe fallback | Studio | Versioned product contract | Apps and saved data cannot create arbitrary DOM, native host access, or unbounded trees |
| App workspace preset | App supplies; Studio validates and renders | Versioned with app | A suggestion for first use or explicit reset, not a command that overwrites later user changes |
| User arrangement | User | Scope still undecided | User placement, sizes, active tabs, and hidden panels win after initial activation |
| Responsive projection | Studio | Ephemeral per available space/zoom | Must not rewrite the saved wide arrangement |
| Current focus, input owner, drag session, maximized state | Studio shell | Ephemeral | Must recover to a logical visible control when a panel moves, hides, closes, or fails |
| Panel-internal content state | Panel/app | Separate from layout state | Layout persistence should store placement and identity, not silently serialize app internals |
| Native geometry and visibility | Studio host bridge | Ephemeral | Must track every move, resize, hide, tab switch, Settings overlay, and teardown |

### Preset versus user precedence

- **Inferred:** The least surprising precedence is: Studio safe base → app preset on first activation or explicit reset → user arrangement thereafter → ephemeral responsive projection at render time.

- **Inferred:** Reapplying an app preset on every activation would erase user intent. Treating a saved whole-tree snapshot as authoritative is simpler, but later app preset additions would not appear automatically.

- **Inferred:** Storing a delta against the app preset lets preset updates flow through, but adds migration and conflict semantics. That complexity is not justified until an actual app update proves it necessary.

- **Owner decision:** When an app adds a new panel, should Studio surface it as available, insert it automatically, or ask the user to reset/update the workspace?

### Persistence and recovery constraints

- **Inferred:** Any persisted layout becomes durable untrusted input. Before rendering, Studio must bound and validate version, node depth/count, panel identifiers, sizes, selected indices, duplicates, and required surfaces.

- **Inferred:** Recovery needs a user-visible reset path that does not require the broken layout to render successfully. A malformed or incompatible user layout should fall back to the app preset; a malformed app preset should fall back to a Studio-owned safe workspace.

- **Inferred:** Missing or disabled app panels need an explicit policy: placeholder with removal action, silent removal, or preset reset. Silent layout corruption is the worst option.

- **Inferred:** Responsive fallback must be reversible. A narrow window must not save its forced single-column ordering over the user’s wide layout.

- **Inferred:** Persistence scope should follow ownership. Device-local UI state is consistent with current Settings and recent-project precedent, while putting layout into the tracked `.antiky` manifest would turn personal arrangement into shared project input. Evidence: `docs/user-facing-docs/studio/getting-started.md:27-31`, `docs/user-facing-docs/studio/getting-started.md:60-61`, `packages/studio/app/src/components/SettingsPage.tsx:35-39`.

- **Owner decision:** Is arrangement device-global, per app, per project, or per app-and-project? Research found no existing decision.

## Bounded comparison of implementation shapes

No library is selected here.

| Shape | What it provides | Fit with current Studio | Main pressure |
| --- | --- | --- | --- |
| Bounded named slots and presets | Extend the present CSS Grid with known areas, tab groups, a few split values, and app-specific templates | Preserves the shipped workspace and stable game/terminal mounts; smallest state and recovery surface | Limited free docking; template count can grow if apps are highly different |
| Studio-owned split/tab tree | A small recursive row/column/tab model rendered through Studio `Panel`, `Tabs`, and splitter primitives | Can expose only capabilities real apps require and preserve Studio chrome | Studio owns ARIA, drag/touch alternatives, focus order, responsive projection, serialization, migration, iframe/native-terminal handling, and tests |
| FlexLayout model-driven docking | React factory over a JSON row/tabset/tab tree, actions, resize/dock/tab movement, model serialization | Direct React shape and customizable theming; upstream source includes tab and splitter semantics | Much larger feature surface than current needs; saved model becomes a durable upstream-shaped contract; popouts and floating panels complicate native terminal and game/GPU ownership |
| Golden Layout content-item tree | Rows, columns, stacks, components, load/save, component focus, virtual or embedded binding, browser popouts | Virtual binding acknowledges iframe/socket stability concerns and can leave application components under app control | Current official tab source is pointer-oriented and lacks inspected ARIA/tab keyboard semantics; loading layouts can destroy content items; integration and accessibility ownership remain with Studio |

### FlexLayout evidence

- **Claimed, as of 2026-08-14:** The official README describes a React layout model created from JSON and serialized with `toJson`, moved/resized through actions, with preservation of component state during tab moves. It also claims built-in ARIA roles, keyboard operation, visible focus, and customizable theme variables. Primary source: [caplin/FlexLayout README](https://github.com/caplin/FlexLayout#readme).

- **Established from upstream source inspection:** Its current `TabButton` implements roving tab focus, arrow navigation, Enter/Space activation, `aria-selected`, `aria-controls`, and an explicit label. Its splitter source implements orientation-specific arrow resizing and iframe-pointer suppression during drag. Primary sources: [FlexLayout `TabButton.tsx`](https://github.com/caplin/FlexLayout/blob/master/src/view/TabButton.tsx), [FlexLayout `Splitter.tsx`](https://github.com/caplin/FlexLayout/blob/master/src/view/Splitter.tsx).

- **Claimed:** The README documents popout limitations involving different `window`/`document` objects, component remount needs, popup blockers, CSP, cross-origin isolation, browser zoom, and restoration. These are directly relevant to Studio’s native terminal and WebGPU/game surfaces. Primary source: [FlexLayout popout documentation in README](https://github.com/caplin/FlexLayout#popout-windows).

- **Gap:** No independent Antiky prototype, screen-reader audit, 400% zoom test, native-terminal integration, or game-iframe lifecycle test was run. The upstream package is fast-moving; re-check its version and source before any decision. Primary metadata: [flexlayout-react on npm](https://www.npmjs.com/package/flexlayout-react).

### Golden Layout evidence

- **Claimed, as of 2026-08-14:** Official documentation describes a `LayoutManager` plus a row/column/stack/component tree, load/save, drag-and-drop, virtual components, themeability, focus, responsiveness, and popouts. Primary sources: [Golden Layout official site](https://golden-layout.github.io/golden-layout/), [Golden Layout structure](https://golden-layout.github.io/golden-layout/structure/).

- **Established from upstream source/document inspection:** Embedded binding reparents ancestors as layouts change, while virtual binding leaves component construction, destruction, and positioning to the application. The structure documentation says content items are destroyed when a layout is closed or a new layout is loaded. Primary sources: [Golden Layout component binding](https://golden-layout.github.io/golden-layout/binding-components/), [Golden Layout structure](https://golden-layout.github.io/golden-layout/structure/).

- **Established from current upstream source inspection:** The official `Tab` implementation creates `div` elements and registers click/touch listeners; the inspected file contains no ARIA attributes, `tabIndex`, or keydown handling. Primary source: [Golden Layout `tab.ts`](https://github.com/golden-layout/golden-layout/blob/master/src/ts/controls/tab.ts).

- **Claimed:** The official repository says its development branch targets an unstable, incompatible version 3, and its main documentation warns that old version-1 material is outdated. Primary sources: [Golden Layout repository](https://github.com/golden-layout/golden-layout), [current Golden Layout documentation](https://golden-layout.github.io/golden-layout/).

- **Gap:** No runtime or assistive-technology audit was performed. Absence of semantics in the inspected tab source does not prove every application built with Golden Layout is inaccessible; it means Studio would own that adaptation and proof.

## Failure cases

1. **Preset overwrite:** An app reapplies its preset and silently removes or relocates the user’s arrangement.

2. **Saved-model lock-in:** Persistence stores a library’s full internal JSON, making an upstream upgrade or library replacement a migration of user data.

3. **Corrupt or stale state:** Unknown panel IDs, duplicate required panels, invalid selected indices, zero-sized regions, or an excessive tree prevents the workspace from rendering and also hides the reset control.

4. **Destructive responsive conversion:** Narrow mode rewrites the wide layout and permanently stacks or closes panels.

5. **Hidden native terminal remains visible:** A tab becomes inactive or moves to a popout, but the AppKit terminal keeps its old geometry, paints over another panel, or retains keyboard focus.

6. **Panel movement remounts a resource owner:** Reparenting or loading a new layout destroys the stable game iframe, terminal session, viewport, editor state, or future GPU resources.

7. **Iframe consumes layout drag:** Drag crosses the live game iframe and loses pointer events. Current split resizing explicitly disables iframe pointer events during resize; generalized tab docking needs equivalent cleanup for completion and cancellation. Evidence: `packages/studio/app/src/styles.css:346-349`.

8. **Focus disappears after close/move:** The active tab or panel is removed without moving focus to a logical neighbor or trigger.

9. **Visual order and focus diverge:** A user docks a visually first panel late in the DOM order, making sequential focus jump unpredictably.

10. **Shortcut collision:** Global layout commands consume arrows, Escape, F6, Control, or Command keys while the game, terminal, text field, or editor owns input.

11. **Drag-only docking:** Users can rearrange by dragging but have no keyboard and no single-pointer non-drag alternative.

12. **False modal surface:** An app overlay advertises `aria-modal` while focus remains in the title bar, terminal, game iframe, or underlying workspace.

13. **Design escape hatch becomes the norm:** Apps replace shared chrome, introduce global CSS, incompatible typography, low-contrast text, or custom interaction semantics.

14. **Required game-editor surface is closable:** Customization removes the current Live game, Terminal, Inspection, or Activity behavior despite the objective’s explicit preservation constraint. Evidence: `docs/objectives/studio-apps/objective.md:48-53`.

15. **Collapsed content is unrecoverable:** A pane can reach a size below its app’s usable minimum, and the user cannot locate or restore it.

## Gaps

- The owner has not chosen the customization ceiling: resize only, tab grouping, show/hide, arbitrary docking, close, maximize, floating panels, or native/browser popouts.

- The owner has not identified which game-editor panels are required, locked, merely default, or replaceable.

- Persistence scope—device, app, project, or app-and-project—is undecided.

- Behavior when an app preset changes after users customize it is undecided.

- No current runtime capture was made at narrow width, 320 CSS px, 200% text size, or 400% zoom. Static repository images do not answer this.

- No screen-reader or keyboard traversal was run across the WebView/native Ghostty boundary or into and out of the game iframe.

- The current `Tabs` and Settings modal defects have not been tested in a browser accessibility tree.

- No automated accessibility runner, behavioral tab/splitter focus suite, or Studio visual-regression suite was found. Current tests mainly inspect SSR strings and CSS source.

- The desired accessibility target is not explicitly recorded. WCAG 2.2 AA is used here as the research baseline, not as an accepted project decision.

- No formal design token/component contract says what apps may customize, what Studio must render, or what visual evidence must be owner-reviewed.

- Neither external docking system was integrated with the native terminal, stable game iframe, WebGPU viewport, Settings overlay, project switching, or Tauri fullscreen.

## Planning implications

- **Inferred:** Preserve the current game workspace as the first canonical app preset and as a non-regression acceptance surface. The objective explicitly forbids changing its current experience. Evidence: `docs/objectives/studio-apps/objective.md:31-33`, `docs/objectives/studio-apps/objective.md:48-53`.

- **Inferred:** Decide the required customization ceiling before selecting a layout implementation. A splitter-and-tabs need does not justify a popout-capable docking framework by itself.

- **Inferred:** Studio should own panel chrome, layout validation, focus movement, input arbitration, responsive projection, persistence recovery, and accessible semantics. Apps should contribute bounded metadata and content.

- **Inferred:** Do not freeze the current `Tabs`, splitter Home behavior, Settings modal behavior, or faint palette as the app contract. They need accessibility correction or an explicit replacement first.

- **Inferred:** Keep layout identity separate from panel instance lifetime. Moving, hiding, or restoring a panel must not implicitly recreate the terminal, game iframe, or a future GPU viewport.

- **Inferred:** Any layout host must expose explicit geometry, visibility, activation, focus, and disposal changes. The native terminal already proves that mounting alone is not enough.

- **Inferred:** Save user intent, not responsive output. Narrow and zoomed layouts should be reversible projections of the same arrangement.

- **Inferred:** If persistence ships, the schema and recovery behavior are part of Studio’s durable compatibility surface and need versioning, bounds, migration/fallback tests, and an always-available reset path.

- **Inferred:** Add rendered evidence alongside structural tests: keyboard traversal, tab behavior, splitter alternatives, modal focus, 320 px/400% reflow, native terminal visibility, iframe drag boundaries, contrast, and selected visual-regression states.

- **Owner decisions required before planning:** customization ceiling; locked game-editor panels; persistence scope; preset-update policy; whether Settings remains modal; and whether WCAG 2.2 AA is the explicit baseline.
