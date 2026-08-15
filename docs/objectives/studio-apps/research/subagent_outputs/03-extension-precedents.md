# 03 — Extension-system precedents

**Research date:** 2026-08-14
**Scope:** VS Code, Eclipse Theia extensions, JupyterLab, and Godot editor plugins. No fifth browser shell was included because Theia and JupyterLab already supply distinct browser-first models.
**Method:** Primary official documentation and repositories only. The systems were not installed or run. Popularity was not used as evidence.

Evidence labels:

- **Established** — specified by an official API, document, or repository.
- **Claimed** — a benefit or rationale asserted by maintainers but not independently tested here.
- **Inferred** — a lesson derived for Antiky from established behavior.

## Findings

### Headline conclusion

**Inferred:** The useful common core is small: stable app and contribution IDs, a central UI-command registry, host-supplied services, host-owned panel placement, defaults that never overwrite restored user layout, explicitly scoped state, and deterministic disposal.

**Inferred:** For initially first-party Antiky apps, the closest useful combination is JupyterLab’s compact plugin object, VS Code’s constrained host context and disposable registrations, Theia’s “initialize layout only when no saved layout exists” rule, and Godot’s explicit dock defaults and symmetric removal.

**Inferred:** Marketplace packaging, arbitrary runtime loading, service replacement, extension-host placement, dependency federation, and broad editor-singleton access solve problems outside this objective and would add premature complexity.

## Comparison

All factual entries in these tables are **Established** unless marked otherwise.

### Contributions, activation, commands, and services

| System | Contribution model | Activation | Commands | Services |
| --- | --- | --- | --- | --- |
| VS Code | An extension has a `package.json` manifest with a stable `publisher.name` identity, static `contributes` declarations, and a code entry point. [Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy), [Contribution Points](https://code.visualstudio.com/api/references/contribution-points) | Code exports `activate` and optional `deactivate`. Activation events permit lazy loading. As of 2026-08-14, commands declared in the manifest automatically activate their extension when invoked for hosts from VS Code 1.74 onward. [Activation Events](https://code.visualstudio.com/api/references/activation-events) | A manifest declares the command ID and label; `registerCommand` binds behavior. Menus, keybindings, and views refer to the same ID. [Commands](https://code.visualstudio.com/api/extension-guides/command) | Extensions consume a bounded VS Code API rather than the workbench’s internal service graph. An extension can return a public API from `activate`, with dependencies named explicitly in `extensionDependencies`. [VS Code API](https://code.visualstudio.com/api/references/vscode-api) |
| Eclipse Theia extension | A compile-time npm package exposes frontend/backend InversifyJS `ContainerModule`s. Implementations bind to service or contribution interfaces. The application includes the package as a dependency. [Extensions](https://theia-ide.org/docs/extensions/), [Authoring an Extension](https://theia-ide.org/docs/authoring_extensions/) | DI modules form global frontend and backend containers at application startup. `FrontendApplicationContribution` supplies ordered hooks including `initialize`, `configure`, `onStart`, `initializeLayout`, `onWillStop`, and `onStop`. [Frontend lifecycle API](https://eclipse-theia.github.io/theia/docs/next/interfaces/_theia_core.browser_frontend-application-contribution.FrontendApplicationContribution.html) | `CommandContribution` registers ID/handler pairs with the central `CommandRegistry`; menus and keybindings reference commands. [Commands, Menus and Keybindings](https://theia-ide.org/docs/commands_keybindings/) | Any extension can provide or consume services and define new contribution points through global DI. Default services can be rebound. [Services and Contributions](https://theia-ide.org/docs/services_and_contributions/) |
| JupyterLab 4.6.3 | An extension package exports one or more plugin objects. A plugin minimally has a unique `id` and `activate`; it can also declare `provides`, `requires`, `optional`, `autoStart`, and `deactivate`. [Develop Extensions](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html) | `autoStart` activates at startup; a non-autostart provider activates when another plugin requests its service. Required providers activate before consumers. Deferred activation also exists in the current API. [Plugin API](https://jupyterlab.readthedocs.io/en/stable/api/interfaces/application.JupyterLab.IPluginInfo.html) | `app.commands` is the shared Lumino registry. Commands have stable IDs and can drive palettes, menus, toolbars, and keybindings. Registration returns a disposable that removes the command. [JupyterLab Commands](https://jupyterlab.readthedocs.io/en/stable/user/commands.html), [Lumino CommandRegistry](https://lumino.readthedocs.io/en/stable/api/classes/commands.CommandRegistry-1.html) | Typed token values identify required, optional, and provided services. Missing required services prevent activation; missing optional services arrive as `null`. [Develop Extensions](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html#plugins-interacting-with-each-other) |
| Godot editor plugin | A project-local `addons/<name>/plugin.cfg` identifies an `@tool` script that extends `EditorPlugin`. The standard manifest contains descriptive metadata, plugin version, and the script path. [Making plugins](https://docs.godotengine.org/en/stable/tutorials/plugins/editor/making_plugins.html) | Enabling the plugin adds it to the editor scene tree. `_enter_tree()` initializes it and `_exit_tree()` cleans it up. Plugins can be enabled and disabled without restarting the editor. [Making plugins](https://docs.godotengine.org/en/stable/tutorials/plugins/editor/making_plugins.html), [Installing plugins](https://docs.godotengine.org/en/stable/tutorials/plugins/editor/installing_plugins.html) | Plugins can add/remove command-palette commands and tool-menu items. The command-palette registry uses unique slash-delimited keys. [EditorCommandPalette](https://docs.godotengine.org/en/stable/classes/class_editorcommandpalette.html) | `EditorInterface` is a broad singleton exposing editor settings, files, scenes, resources, viewports, and other facilities. `EditorPlugin` also exposes the editor undo/redo manager. [EditorInterface](https://docs.godotengine.org/en/stable/classes/class_editorinterface.html), [EditorPlugin](https://docs.godotengine.org/en/stable/classes/class_editorplugin.html) |

### Panels, defaults, state, compatibility, and disposal

| System | Panels and workspace defaults | State | Compatibility | Disposal |
| --- | --- | --- | --- | --- |
| VS Code | Static contributions place views in a default container. Users can rearrange views and move them between containers. Tree views use a constrained host API; arbitrary HTML uses webviews. [Views contribution](https://code.visualstudio.com/api/references/contribution-points#contributesviews), [Views UX](https://code.visualstudio.com/api/ux-guidelines/views) | `workspaceState` and workspace storage are workspace-scoped; `globalState` and global storage are installation-scoped; secrets have a separate store. Webviews can save JSON state and register a serializer for restart restoration. [Data Storage](https://code.visualstudio.com/api/extension-capabilities/common-capabilities#data-storage), [Webview persistence](https://code.visualstudio.com/api/extension-guides/webview#persistence) | `engines.vscode` declares the compatible API range and is required by the manifest. [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest) | `ExtensionContext.subscriptions` disposes registrations on deactivation. An optional `deactivate` handles remaining shutdown work. Asynchronous disposable functions in `subscriptions` are not awaited. [ExtensionContext](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext) |
| Eclipse Theia extension | Widgets are created through widget factories and wired into the workbench through view contributions. `initializeLayout` is called only when no prior workbench layout exists, so an extension can propose a first layout without replacing user changes. [Widgets](https://theia-ide.org/docs/widgets/), [Frontend Application Contributions](https://theia-ide.org/docs/frontend_application_contribution/) | `StorageService` supports application data; `WorkspaceStorageService` prefixes keys by the current workspace. Layout restoration is owned by the workbench. [WorkspaceStorageService](https://eclipse-theia.github.io/theia/docs/next/classes/_theia_workspace.browser_workspace-storage-service.WorkspaceStorageService.html) | The extension is an npm dependency of the product. Official guidance says its `@theia/core` dependency must match the product, and generated apps run `theia check:theia-version`. [Composing applications](https://theia-ide.org/docs/composing_applications/), [Extending Theia IDE](https://theia-ide.org/docs/blueprint_documentation/) | Theia supplies `DisposableCollection`. Application contributions have synchronous `onStop`/`onWillStop` browser-shutdown hooks; asynchronous cleanup cannot be deferred until `beforeunload`. [DisposableCollection](https://eclipse-theia.github.io/theia/docs/next/classes/_theia_core.common_disposable.DisposableCollection.html), [Frontend lifecycle API](https://eclipse-theia.github.io/theia/docs/next/interfaces/_theia_core.browser_frontend-application-contribution.FrontendApplicationContribution.html) |
| JupyterLab 4.6.3 | Plugins add widgets to named shell areas such as `main`, `left`, `right`, and `down`. `WidgetTracker` plus `ILayoutRestorer` restores instances. A workspace JSON document supplies the initial `IStateDB` data and records open panels and layout. [Common Extension Points](https://jupyterlab.readthedocs.io/en/stable/extension/extension_points.html#jupyter-front-end-shell), [Workspaces](https://jupyterlab.readthedocs.io/en/stable/user/workspaces.html), [Extension tutorial](https://jupyterlab.readthedocs.io/en/stable/extension/extension_tutorial.html#restore-panel-state-when-the-browser-refreshes) | `IStateDB` stores JSON-compatible values by ID. Plugin settings have separate schemas/defaults and user overrides. [IStateDB](https://jupyterlab.readthedocs.io/en/stable/api/interfaces/statedb.IStateDB.html), [Develop Extensions](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html#plugin-settings) | Official 4.6.3 guidance warns that extensions can break on new JupyterLab releases, recommends semantic dependency ranges or an upper bound, and has `sharedPackages` rules for federated dependency compatibility. [Develop Extensions](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html) | Plugin `deactivate` is optional. The application can deactivate a plugin and downstream consumers only when all support deactivation. Widgets and command registrations are independently disposable. [JupyterLab application API](https://jupyterlab.readthedocs.io/en/stable/api/classes/application.JupyterLab-1.html#deactivatePlugin) |
| Godot editor plugin | `add_dock()` accepts an `EditorDock` with a default slot and allowed layouts. The user can move the dock and save the result. A plugin can instead expose a top-level main screen beside 2D, 3D, Script, and Game. [Making plugins](https://docs.godotengine.org/en/stable/tutorials/plugins/editor/making_plugins.html), [EditorPlugin](https://docs.godotengine.org/en/stable/classes/class_editorplugin.html) | `_get_state`/`_set_state` preserve scene- or tab-specific editor state. `_get_window_layout`/`_set_window_layout` preserve global plugin UI layout. The docs explicitly say scene edit state is not a store for important project settings. [EditorPlugin state API](https://docs.godotengine.org/en/stable/classes/class_editorplugin.html) | The standard `plugin.cfg` exposes a plugin version. The Asset Library records a Godot-version compatibility dimension, but this research did not establish a loader-enforced engine range in `plugin.cfg`. [Using the Asset Library](https://docs.godotengine.org/en/stable/community/asset_library/using_assetlib.html) | The official examples explicitly pair every dock/control/command registration with removal and freeing in `_exit_tree()`. `remove_dock()` does not free the dock automatically. [Making plugins](https://docs.godotengine.org/en/stable/tutorials/plugins/editor/making_plugins.html), [EditorPlugin](https://docs.godotengine.org/en/stable/classes/class_editorplugin.html) |

## Transferable practices

1. **Separate description from runtime work.**
   **Inferred:** App identity, panel metadata, command IDs, and an initial workspace suggestion should be visible before app activation. Runtime setup should happen only when the app is selected or one of its contributions is used. VS Code makes this distinction most explicit.

2. **Keep one command registry, but distinguish command kinds.**
   **Inferred:** Menus, buttons, shortcuts, and agents can refer to stable Studio UI-command IDs. A UI command that changes authoritative world state must call the existing versioned Framework command service. It must not become a second mutation boundary.

3. **Inject narrow capabilities.**
   **Inferred:** JupyterLab’s required/optional distinction is useful, but Antiky does not need a replaceable global provider graph. An app should receive a small host context containing only approved Studio, project, engine, storage, and panel operations.

4. **Treat workspace defaults as suggestions, not ownership.**
   **Inferred:** Theia supplies the strongest rule: initialize the app layout only when no stored layout exists. Godot and VS Code reinforce that the host records subsequent user movement. App activation must not repeatedly reset the workspace.

5. **Separate state by meaning and lifetime.**
   **Inferred:** At minimum, distinguish transient panel state, user layout, per-app/per-project preferences, durable authoring data, and authoritative runtime state. Only the latter two should use Antiky’s existing project or engine services. A generic app state blob must not become a shadow project model.

6. **Make every registration disposable.**
   **Inferred:** Command, panel, listener, timer, input, and service subscriptions should return or automatically enter a per-app disposable scope. Failed activation, app replacement, project close, and normal shutdown should all drain the same scope.

7. **Perform cleanup before browser shutdown.**
   **Inferred:** Theia and VS Code both expose limits on asynchronous teardown at final shutdown. Antiky should dispose an app during controlled project/app transitions, not rely on `beforeunload` to release meaningful resources.

8. **Prefer shell-native panel primitives.**
   **Inferred:** VS Code’s UX guidance recommends limiting arbitrary webviews. Antiky should provide shared panel chrome, focus behavior, empty/error/loading states, typography, and tokens so each app does not recreate the Studio visual language.

9. **Start compatibility explicitly but narrowly.**
   **Inferred:** Even built-in apps benefit from an `apiVersion` checked before activation. Package publication ranges, host placement, dependency federation, migrations, and marketplace negotiation are unnecessary until an actual distribution boundary exists.

## Complexity traps

- **Theia’s global DI container is too powerful for this objective.**
  **Established:** Compile-time extensions have almost unrestricted access and can replace core services.
  **Inferred:** Copying this would obscure ownership and conflict with the narrow `EditorHost`, shared project-service authority, and renderer boundaries.

- **VS Code’s complete contribution taxonomy is marketplace-scale machinery.**
  **Established:** The manifest supports dozens of contribution types, activation events, remote host locations, dependencies, workspace-trust declarations, and compatibility ranges.
  **Inferred:** Antiky should not build a schema for hypothetical contribution types.

- **JupyterLab’s service graph creates activation and teardown coupling.**
  **Established:** Resolving a service can activate its provider, providers activate before consumers, and deactivation can cascade through downstream dependents.
  **Inferred:** This is useful for a large ecosystem but makes app switching harder to reason about.

- **JupyterLab dependency federation is a separate product.**
  **Established:** Prebuilt extensions have dependency sharing, singleton, strict-version, and bundling controls.
  **Inferred:** None is justified for statically compiled first-party apps.

- **Godot exposes broad authority and relies on paired manual cleanup.**
  **Established:** Plugins can reach a large editor singleton and many APIs require explicit `add_*`/`remove_*` pairs plus manual freeing.
  **Inferred:** Antiky should borrow the lifecycle symmetry, not the broad access.

- **Persisting the whole workspace as an opaque snapshot can freeze implementation details.**
  **Inferred:** A versioned host-owned layout record should reference stable panel IDs. It should not serialize React objects, GPU resources, renderer state, or arbitrary service instances.

- **“Command” is dangerously overloaded in Antiky.**
  **Inferred:** A shell command such as `studio.panel.toggle` is not equivalent to a versioned Framework command that mutates world state. The contracts and diagnostics should make that distinction visible.

- **Runtime installation expands the trust model.**
  **Inferred:** Project-local or downloaded executable apps would require capability enforcement, validation, isolation, compatibility, and failure containment. That is separate from a first-party composition seam.

## Terminology mapping to Antiky

| Precedent term | Antiky term | Mapping notes |
| --- | --- | --- |
| VS Code extension / Theia extension / JupyterLab extension / Godot plugin | **Studio app definition** | Initially a statically imported first-party module, not an installable marketplace package. |
| JupyterLab plugin | **App contribution bundle or runtime** | JupyterLab allows several plugins per extension. Antiky does not need this extra package/plugin level initially. |
| Contribution point | **Contribution type** | A host-owned registry for a real seam such as commands or panels. Do not create a generic contribution meta-framework. |
| Activation event | **App activation trigger** | Likely app selection or first command/panel use. The owner must decide whether multiple apps remain active. |
| Command | **Studio UI command** | A stable shell action. Authoritative edits still cross the Framework command boundary. |
| Service / token / API namespace | **Studio capability or service client** | Supplied by the host. No app may replace the project lifecycle authority, `EditorHost`, renderer, or engine services. |
| View / widget / dock | **Panel instance** | Mountable UI with host-owned chrome, placement, focus, and teardown. |
| View container / shell area | **Workspace region** | A host-defined placement target, not an app-owned DOM location. |
| Main screen | **Studio app workspace** | Godot’s main-screen model is the closest match for switching between game-editor, voxel, or other focused tools. |
| Workspace | **Studio workspace layout** | This term is overloaded in the precedents. In Antiky it should mean UI composition for a Studio app/project, not project identity or engine state. |
| Memento / `IStateDB` / editor layout config | **Scoped app state and layout state** | Store them separately from `.antiky`, authoring state, runtime state, and GPU state. |
| `Disposable`, `deactivate`, `_exit_tree` | **App lifetime/disposal scope** | One host-owned cleanup path for activation failure, replacement, project close, and shutdown. |

## Bounded contract shapes

These are research alternatives, not a selected plan.

### Option A — Minimal imperative activation

```ts
interface StudioAppDefinition {
  readonly id: string;
  readonly title: string;
  readonly apiVersion: 1;
  activate(context: StudioAppContext): void | Promise<void>;
}

interface StudioAppContext {
  readonly commands: StudioUiCommandRegistry;
  readonly panels: StudioPanelRegistry;
  readonly workspace: StudioWorkspaceDefaults;
  readonly storage: StudioAppStorage;
  readonly services: StudioAppServices;
  readonly lifetime: StudioDisposableScope;
  readonly signal: AbortSignal;
}
```

Each `registerCommand`, `registerPanel`, listener, or resource registration enters `lifetime` automatically. If activation throws, the host disposes the partial lifetime. `workspace.applyDefaultOnce(...)` can only act when no compatible saved app layout exists.

**Boundaries:**

- Built-in static registry only.
- No manifest discovery or dynamic module loading.
- No app dependency graph or replaceable service providers.
- No direct Tauri, CLI process, renderer, GPU, or authoritative world access.
- Compatibility is an exact `apiVersion` check.

**Tradeoff:** This is the smallest surface and keeps app code cohesive. Contribution metadata is unavailable until activation, and an imperative activation path needs strong rollback behavior.

### Option B — Validated contributions plus optional runtime

```ts
interface StudioAppDefinition {
  readonly id: string;
  readonly title: string;
  readonly apiVersion: 1;
  readonly requires?: readonly StudioServiceKey[];
  readonly optional?: readonly StudioServiceKey[];
  readonly contributes: {
    readonly commands?: readonly StudioCommandContribution[];
    readonly panels?: readonly StudioPanelContribution[];
    readonly workspacePreset?: StudioWorkspacePreset;
  };
  activate?(context: StudioAppContext): StudioAppRuntime | Promise<StudioAppRuntime>;
}

interface StudioAppRuntime {
  dispose(): void | Promise<void>;
}
```

The host validates IDs, collisions, service availability, panel placement, and preset version before activation. The shell can display commands and panels before loading app runtime code. The workspace preset has fixed “apply only when uninitialized” semantics.

**Boundaries:**

- Compiled TypeScript objects rather than an external JSON manifest.
- Only commands, panels, one workspace preset, and a small fixed service-key set.
- No contribution filters, provider replacement, activation-event language, or package compatibility ranges.
- Runtime disposal remains mandatory even when activation is optional.

**Tradeoff:** Prevalidation and diagnostics are stronger, but the descriptor/runtime split adds types, ordering rules, and more host machinery before multiple apps prove that it is needed.

| Concern | Option A | Option B |
| --- | --- | --- |
| Initial complexity | Lower | Higher |
| Contributions visible before activation | No | Yes |
| Partial activation risk | Managed by one disposable scope | Reduced by prevalidation; runtime can still fail |
| Lazy command/panel activation | Manual | Natural |
| Schema growth pressure | Lower | Higher |
| Fit for one or two first-party apps | Strong | Plausible if the first apps already need diagnostics or lazy loading |

## Claimed benefits that were not independently verified

- **Claimed:** VS Code says the extension-host boundary and lack of workbench DOM access protect editor stability, performance, and UI evolution. The process/API boundary is established, but this research did not benchmark the claimed benefit. [Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host), [Extension restrictions](https://code.visualstudio.com/api/extension-capabilities/overview#restrictions)
- **Claimed:** Theia says DI makes services replaceable without changing consumers. The mechanism is established; its net complexity benefit was not measured here. [Services and Contributions](https://theia-ide.org/docs/services_and_contributions/)
- **Claimed:** JupyterLab describes provider/consumer tokens as a type-safe decoupling mechanism. TypeScript typing is established, but maintainability at Antiky’s scale was not tested.
- **Claimed:** Godot describes editor plugins as reload-free and less powerful than engine modules. Immediate enable/disable is documented, but operational reliability was not tested. [Making plugins](https://docs.godotengine.org/en/stable/tutorials/plugins/editor/making_plugins.html)

## Gaps

1. JupyterLab 4.6.3 documentation is internally inconsistent about duplicate service providers. The developer guide says a token can be registered only once, while the generated application API and current Lumino source say a later provider overrides the previous provider. [Developer guide](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html#plugins-interacting-with-each-other), [Lumino source](https://github.com/jupyterlab/lumino/blob/main/packages/application/src/index.ts#L1520-L1544). This does not affect the Antiky options because neither permits provider replacement.

2. The reviewed VS Code API documents default view locations and user rearrangement but did not establish a supported extension contribution for a complete first-run workspace layout.

3. Theia compile-time extension hot-disable behavior was not established. Its lifecycle shutdown hooks do not imply runtime removal of DI bindings.

4. JupyterLab documents imported workspace state and restoration, but the exact merge behavior between shipped initial state, plugin defaults, and an existing user workspace needs a source or prototype if Antiky considers importing whole layouts.

5. Godot’s standard `plugin.cfg` documents plugin version metadata, while the Asset Library tracks Godot versions separately. Loader-level engine compatibility enforcement was not established.

6. None of the systems was run. Startup-failure recovery, leaked registrations, layout corruption, and disposal quality remain documentation-level evidence.

7. Antiky-specific answers still depend on the other research lines: current panel seams, first proving apps, layout ownership, trust tiers, WebGPU viewport ownership, and verification.

8. Owner decisions remain open:

   - Whether selecting an app replaces the active app or whether several apps remain active.
   - Whether user layout is stored per app, per project, globally, or in a layered combination.
   - Which first-party services apps actually require.
   - Whether initial activation may be eager or must be lazy.
   - Whether an app can be disabled independently in the first release.
   - Whether project-local executable apps are explicitly deferred.

## Planning implications

- **Inferred:** A first version can remain a statically compiled first-party registry. Nothing in the proving cases yet requires package discovery, remote installation, or a marketplace.
- **Inferred:** The minimum credible vocabulary is app definition, panel contribution, Studio UI command, workspace preset, scoped storage, host service client, activation, and disposal.
- **Inferred:** The host should reject duplicate IDs and incompatible API versions before mounting any app UI.
- **Inferred:** Restored user layout must take precedence over app defaults. A reset-to-app-default command can be explicit rather than implicit on activation.
- **Inferred:** Every app-facing service must preserve accepted Antiky ownership: CLI project services remain the local lifecycle authority; the portable UI stays behind `EditorHost`; Framework commands remain the mutation boundary; renderer selection stays in the game module; GPU resources remain with the owning game module or render driver.
- **Inferred:** Theia-style unrestricted service rebinding and Godot-style broad singleton access would conflict with those accepted boundaries if copied directly.
- **Inferred:** Project-local or untrusted app loading would materially change the trust boundary and likely require separate owner direction and architecture work. It should not enter the initial plan accidentally.
- **Inferred:** Planning should retain both bounded contract shapes until the current composition and proving-app research shows whether pre-activation metadata and lazy contribution loading provide real value.
