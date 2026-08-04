# 0002: Keep the Studio web editor independent from Tauri

## Status

Accepted

## Context

Studio needs a desktop application for:

- Application windows
- Local processes
- Files
- Menus
- Secure communication between processes
- Installation packages.

The editor user interface uses web technology. It must also work in a browser or a different desktop
application.

The editor code must not use Tauri APIs throughout the user interface. Otherwise, a future change
from Tauri would require a rewrite of the application.

## Decision

We will first prove the core editor in a browser. Studio will use Tauri as its first desktop
application.

The web editor will use a small `EditorHost` interface for desktop features. Only the Tauri adapter
will use Tauri APIs directly.

Tauri will connect Studio to operating-system features and local processes. It will not contain
editor behavior.

The project has not yet selected the UI framework, the engine process location, or the connection
method. A complete working feature will show what these parts need.

## Consequences

- Browser development can test editor behavior before the project adds installation packages.
- The editor can later run in another desktop application, a browser, or a remote environment.
- Desktop features and data that cross process boundaries need clear, validated contracts.
- Tauri and Rust add a small, defined set of native build work.
- The `EditorHost` interface must hide platform details.
- The interface must not include future features before a real use case needs them.

## Revision history

- `5ccd6638aa0124b286c5dc7562884f5c2d707f79` — Prior version before the plain-language rewrite.
