# 0005: Use one Antiky project manifest

## Status

Accepted

## Context

Antiky Studio and the CLI must identify the same game project. Finder also needs one named file
that can open Studio.

A project manifest is a JSON file that identifies a project and supplies its development data.
The current `antiky.config.json` file has no project name or file association. A second pointer file
would give the project two sources that can disagree.

A canonical path is the path after the operating system resolves symbolic links. A content hash is
the SHA-256 digest of the manifest bytes.

## Decision

We will use one named `<name>.antiky` file as the Antiky project manifest. The manifest will use
strict JSON and schema version 1.

The schema has this complete form:

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

All fields in this form are necessary. The parser will reject unknown fields. It will reject an
unsupported schema version.

The canonical manifest path will identify the local project. The content hash will identify the
manifest revision. The manifest parent directory will be the project root.

All manifest paths will use forward slashes and will be relative to the project root. The host will
reject a path that leaves the project root after symbolic-link resolution.

The CLI will use an explicit manifest path when the user supplies one. Without that path, the CLI
will accept exactly one `.antiky` file in the current directory. The CLI will not search parent
directories.

The Tauri adapter will own file selection, file association, canonical paths, and bounded file reads.
The browser-safe `@antiky/cli/project` module will own the schema and content validation.

The hidden `.antiky/` directory will contain temporary local runtime state. The CLI will put an
ignore marker in this directory before it writes a session credential.

The migration command will convert `antiky.config.json` into one `.antiky` file. Normal clients will
not read `antiky.config.json` after this change.

## Consequences

- Finder, Studio, and the CLI use the same visible project boundary.
- Studio can validate a project without starting project code.
- Invalid or incompatible input cannot replace the current Studio workspace.
- Existing projects must migrate from `antiky.config.json`.
- One Studio window can own only one project at a time.
