# 0002: Host a portable web editor in Tauri

## Status

Accepted

## Context

Studio needs a native desktop shell for windows, local processes, files, menus, secure IPC, and
packaging. Its editor UI is web-based and should also remain usable in a browser or a different host.
Spreading desktop-specific APIs through the UI would turn a future host change into an application
rewrite.

## Decision

We will prove the editor core in a browser-hosted development path and use Tauri as Studio's initial
desktop shell. The web editor will call a narrow `EditorHost` abstraction instead of importing Tauri
APIs throughout the application.

Tauri will remain a thin native host for operating-system integration and local process boundaries.
The choice of UI framework, engine-process placement, and transport will remain open until a
vertical slice establishes their requirements.

## Consequences

- Browser development can validate editor behavior before desktop packaging is introduced.
- The editor can later run in another desktop shell, a browser, or a remote environment.
- Host capabilities and IPC payloads need explicit, validated contracts.
- Tauri and Rust integration add a focused native build surface.
- The host abstraction must remain deep enough to hide platform details without predicting every
  future host feature.
