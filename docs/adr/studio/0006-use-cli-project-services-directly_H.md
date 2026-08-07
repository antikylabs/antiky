# 0006: Use CLI project services directly

## Status

Accepted

## Context

[Studio ADR 0004](0004-share-engine-services-with-cli_H.md) gives one rule. CLI and Studio must use
the same engine services. That record also makes Studio attach to a development host that the
`antiky dev` command starts.

Because Studio uses that connection, Studio waits for a child CLI process and a session descriptor.
Studio cannot start the project service with that connection.

[CLI ADR 0002](../cli/0002-supply-cli-project-services-through-a-library-api_H.md) gives a library
API to applications with approved local permissions. [CLI ADR 0003](../cli/0003-make-cli-project-services-the-development-authority_H.md)
makes that API the authority for the local project lifecycle.

The Studio application host is the native layer with approved local permissions. It can use local
files, processes, and network ports. The
[portable Studio UI](0002-tauri-portable-web-editor_H.md) does not have this authority.

## Decision

The Studio application host will import CLI project services and call them directly.

When Studio activates a project, the application host will start its project service. The service
will start the development build process, development game host, inspection service, and MCP
endpoint.

Studio will use the lifecycle handle for status and cleanup. Studio will not start a
child process with the `antiky dev` command for this workflow.

Studio will not parse CLI text or wait for a session descriptor during local startup. It will not
use HTTP or MCP to start or stop the local project.

Studio will not contain a second project service or development game host. The CLI command and
Studio application host will use the same library API.

The portable Studio UI will use its small application-host contract. It will not import CLI modules
that use process APIs.

A detached Studio client can use a validated network boundary to connect to a development session.
A second host with approved local permissions starts that session.

This record replaces Studio ADR 0004.

## Consequences

- Studio has primary responsibility for all local startup steps.
- Local Studio startup does not use a child CLI command.
- CLI and Studio keep the same project behavior and development game host.
- The Studio application host must have the runtime and permissions that CLI project services use.
- Studio must stop its lifecycle handle when a project closes or startup has an error.
- The portable UI stays in a different module from process and file-system APIs.
- Detached and browser clients can use the validated development client to connect.
