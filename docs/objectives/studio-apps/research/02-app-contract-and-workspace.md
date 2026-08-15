# App contract and workspace composition

This document combines extension-system precedents with workspace, design, and accessibility
research. It narrows the choices but does not select an app API or layout implementation.

Evidence labels are **Established**, **Claimed**, **Inferred**, and **Gap** as defined in
[`01-current-state-and-proving-cases.md`](01-current-state-and-proving-cases.md). Raw evidence and
primary links are retained in
[`02-workspace-composition.md`](subagent_outputs/02-workspace-composition.md) and
[`03-extension-precedents.md`](subagent_outputs/03-extension-precedents.md).

## Transferable practices from prior art

The research compared VS Code, Eclipse Theia, JupyterLab, and Godot using their primary
documentation and source. Their scale and terminology differ, but several practices recur.

| Practice | Evidence status | Antiky implication |
| --- | --- | --- |
| Stable extension, command, view, and state identities | **Established in the compared systems** | Identity must not depend on React position or current layout |
| Commands registered separately from UI placement | **Established** | Studio UI commands and Framework mutation commands need distinct names and authority |
| Host-owned services passed through a bounded context | **Established** | Apps request capabilities; they do not import shell internals |
| Host-owned placement and restoration | **Established** | Apps describe panels/presets; Studio validates and realizes them |
| Scoped registrations with deterministic removal | **Established** | Activation must return or populate an exhaustive disposable scope |
| Defaults applied only when no user state is restored | **Established** | An app preset cannot overwrite later user arrangement |

**Inferred:** The useful first-party mix is JupyterLab's compact plugin-object shape, VS Code's
constrained context and disposables, Theia's default-layout precedence, and Godot's symmetric
removal discipline. Copying any platform's full dependency, marketplace, or packaging system would
solve requirements the objective has not established.

## Minimum vocabulary under investigation

The evidence supports keeping six concepts separate:

| Concept | Minimum responsibility | Must not imply |
| --- | --- | --- |
| App | Stable identity, metadata, compatibility declaration, activation and disposal | Marketplace package or security boundary |
| Panel | Stable content identity and Studio-rendered placement metadata | Arbitrary native/GPU/process authority |
| Workspace preset | Validated initial arrangement and required/default panel set | Ownership of the user's later arrangement |
| UI command | Discoverable Studio action with enablement and handler lifetime | Direct mutation of engine state |
| Capability/service | Narrow host-owned query or operation interface | A global service locator or raw shell object |
| App state | App-ID/version-scoped serializable state | Layout state, engine state, or ambient browser storage |

**Inferred:** Panel, terminal, viewport, commands, project data, development data, persistence, and
diagnostics are not peers in one bag of callbacks. The app context should make requested authority
visible and keep optional services optional.

## Two bounded contract shapes

No shape is selected during research.

### Shape A — imperative first-party activation

```ts
{
  id,
  title,
  apiVersion,
  activate(context) // registers bounded contributions and returns disposal
}
```

**Inferred fit:** This is the smallest shape for compiled, trusted first-party apps. It makes
lifecycle and scoped services explicit and avoids designing a contribution schema before real apps
exist.

**Pressure:** Contribution validation, introspection, deterministic workspace assembly, and future
isolation become conventions unless the registration methods themselves are narrow and validated.

### Shape B — validated descriptor plus optional runtime

```ts
{
  id,
  apiVersion,
  contributes: { panels, commands, workspacePreset },
  activate?: runtime
}
```

**Inferred fit:** Static contributions can be inspected before activation and can later cross a
serialized boundary. This better separates declarative project input from executable code.

**Pressure:** It creates a durable schema, compatibility rules, and more up-front vocabulary. It is
premature if the first apps cannot yet name their contributions precisely.

**Inferred:** A statically compiled first-party registry is sufficient for the first proof unless
the owner requires project-local or independently shipped executable apps now. Static discovery
does not prevent a later versioned descriptor; it simply does not pretend to isolate trusted code.

## Workspace ownership model

The following is a research model, not an accepted design.

| State | Proposed authority | Lifetime and rule |
| --- | --- | --- |
| Layout schema and safe fallback | Studio | Versioned and bounded; invalid input cannot prevent reset |
| App workspace preset | App supplies, Studio validates | First activation or explicit reset only |
| User arrangement | User | Wins after initialization; persistence scope is undecided |
| Responsive projection | Studio | Ephemeral; never overwrites the saved wide arrangement |
| Focus, input owner, drag, maximized state | Studio | Ephemeral and recoverable after move, hide, or failure |
| Panel-internal state | App/panel | Stored separately from placement |
| Native surface geometry and visibility | Host adapter | Ephemeral; updated for every layout and visibility transition |

**Inferred precedence:** Studio safe base → app preset on first use/reset → saved user arrangement →
ephemeral responsive projection. This prevents app activation and narrow windows from erasing user
intent.

**Inferred:** Persisted layout is untrusted durable input. It needs a version, bounded tree depth
and node count, known panel identities, legal dimensions, duplicate checks, migration/fallback
behavior, and a reset path that remains reachable when restoration fails.

## Layout implementation shapes

| Shape | Strength | Main cost or limit |
| --- | --- | --- |
| Bounded named slots and presets | Smallest change; preserves stable current mounts | Limited arbitrary docking; templates can multiply |
| Studio-owned split/tab tree | Can expose only proven needs and retain Studio chrome | Studio owns semantics, persistence, migration, focus, drag, touch, and tests |
| FlexLayout | Model-driven React docking with substantial keyboard/ARIA work in current source | Much larger surface; upstream JSON can become an accidental durable contract |
| Golden Layout | Mature tree, save/load, focus, virtual binding, and popouts | Current inspected tab source lacks built-in keyboard/ARIA behavior; v3 direction is unstable |

**Gap:** Neither external layout system was integrated with the native terminal, stable game
iframe, WebGPU viewport, project switching, Settings, or Tauri fullscreen. Feature lists are not
evidence that either one fits Antiky.

**Inferred:** The owner must choose the customization ceiling before the project chooses a layout
shape. Resize and tab grouping do not justify arbitrary docking, floating windows, or browser
popouts by themselves.

## Design and accessibility constraints

**Established:** The current shell has shared colors, spacing, borders, typography, buttons,
panels, and focus styles, but these are not yet a documented app design contract.

**Established:** Current code has several accessibility gaps that must not be frozen into an app
API:

- Tabs expose basic roles but no arrow-key navigation or programmatic tab/tabpanel relationships.
- Settings advertises a modal dialog without moving/trapping/restoring focus or handling Escape.
- Splitters support keyboard arrows, but the current drag interaction lacks a general non-dragging
  pointer alternative.
- Wide visual order and DOM focus order differ; arbitrary docking would increase that pressure.
- `--text-faint` on the raised surface measures about 4.06:1, below WCAG 2.2 AA for normal text.
- Current responsive tests inspect markup and CSS source; they do not prove 320 CSS px reflow,
  400% zoom, text enlargement, native-terminal focus, or iframe keyboard escape.

**Inferred:** Studio should own panel chrome, focus movement, input arbitration, accessible tabs and
splitters, responsive projection, layout recovery, and shared tokens. Apps should supply bounded
content and metadata. Global CSS, arbitrary panel chrome, and unscoped shortcuts would make visual
and interaction drift inevitable.

**Inferred:** Layout identity must be separate from component instance lifetime. Moving, hiding,
tabbing, or restoring a surface must not implicitly recreate its terminal, iframe, editor, worker,
or GPU resources.

## Complexity traps to avoid

- A marketplace, remote catalog, signing system, or publication workflow before a distribution
  requirement exists.
- Global dependency injection or a provider graph that makes every internal service an extension
  API.
- A second command system that bypasses existing engine commands and project services.
- Saving a layout library's complete internal model as Antiky's unchangeable user-data format.
- Treating TypeScript, React context, Shadow DOM, or dynamic imports as a security boundary.
- Reapplying app presets on every activation.
- Letting apps own global CSS, arbitrary shortcuts, raw Tauri imports, or shell-wide state.
- Making every possible future capability part of version 1.

## Owner decisions before planning

1. What is the initial customization ceiling: resize only, tab grouping, show/hide, closing,
   arbitrary docking, maximize, floating panes, or popouts?
2. Which current game-editor surfaces are required and locked, default but removable, or
   replaceable?
3. Is user arrangement device-global, per app, per project, or per app and project?
4. When an app version adds a panel, should Studio merely make it available, insert it, or ask the
   user to update/reset the workspace?
5. Should WCAG 2.2 AA be the explicit baseline, and should Settings remain a real modal?
6. Are the first apps compiled and trusted only, or must project-local discovery shape version 1?
7. Is activation eager, selected-app-only, or contribution-triggered, and may users disable a
   built-in app?

## Planning implications

- Start from stable identity, bounded registrations, host-owned capabilities, and deterministic
  disposal; defer ecosystem machinery.
- Keep app presets and user layout as distinct authorities.
- Preserve mounted resource owners while changing layout presentation.
- Correct or replace the current shared accessibility primitives before making them the app
  contract.
- Compare at least the bounded-slot and Studio-owned-tree designs against the owner-selected
  customization ceiling before choosing a dependency.
