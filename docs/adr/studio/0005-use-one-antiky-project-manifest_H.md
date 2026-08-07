# 0005: Use one Antiky project manifest

## Status

Accepted

## Context

Antiky Studio and the CLI must identify the same game project. Finder must open Studio from one
`<name>.antiky` project manifest.

A project manifest is a JSON file. It identifies a project and supplies its development data.
The `antiky.config.json` file has no project name or file association. A second pointer file can
supply different project data.

A canonical path is the result after the operating system resolves symbolic links. A content hash
is the SHA-256 digest of the manifest bytes.

## Decision

We will use one `<name>.antiky` file as the Antiky project manifest. The manifest will use strict
JSON and schema version 1.

The schema has this full form:

```json
{
  "schemaVersion": 1,
  "name": "Antiky Town",
  "development": {
    "command": ["npm", "run", "dev"],
    "shaderCommand": ["npm", "run", "shaders:watch"],
    "workingDirectory": ".",
    "url": "http://127.0.0.1:3010/",
    "viewport": {
      "width": 1280,
      "height": 720
    }
  },
  "network": {
    "host": "127.0.0.1",
    "gamePort": 3010,
    "inspectionPort": 3011
  },
  "build": {
    "command": ["npm", "run", "build"],
    "workingDirectory": "."
  }
}
```

All fields in this form are necessary. The parser will reject unknown fields. It will reject each
schema version other than 1.

The canonical manifest path will identify the local project. The content hash will identify the
manifest revision. The manifest parent directory will be the project root.

All manifest paths will use forward slashes. They will be relative to the project root. The host will
reject a path that leaves the project root after symbolic-link resolution.

The CLI will use the manifest path in the `--project` option. Without this option, the CLI will
accept only one `.antiky` file in the current directory. The CLI will not examine parent directories
for a manifest.

The Tauri adapter will manage file selection, file association, and canonical paths. The Tauri
adapter will read a maximum of 64 KiB from one file. The browser-safe `@antiky/cli/project` module
will contain the schema and content validation.

The `.antiky/` directory will contain temporary runtime state for the local project. The CLI will
put an ignore marker in this directory before it writes a session credential.

The migration command will convert `antiky.config.json` into one `.antiky` file. Clients will not
read `antiky.config.json` after this change.

## Consequences

- Finder, Studio, and the CLI use one project boundary that the user can see.
- Studio can validate a project and does not start project code.
- Input with an error or input that is not compatible cannot replace the Studio workspace.
- The migration command is necessary for projects that use `antiky.config.json`.
- One Studio window can manage only one project at a time.

## Revision history

- `ef36519e3f7386fc9b55fbecff02336358f1b9e5` — Text change for ASD-STE100 Issue 9.
