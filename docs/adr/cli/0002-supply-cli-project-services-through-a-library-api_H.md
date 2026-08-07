# 0002: Supply CLI project services through a library API

## Status

Accepted

## Context

The `@antiky/cli` package supplies commands for a terminal. It also contains services that have
primary responsibility for an Antiky project.

A project service starts, inspects, and stops one Antiky project. A command adapter changes
terminal input and operating-system signals into project service calls.

Studio must use the same project lifecycle without a child CLI process. Shell commands, terminal
text, HTTP messages, and MCP messages are not a library API.

A library API is a typed interface that an in-process application imports.

## Decision

We will export CLI project services through a typed library API.

The command adapter and Studio will use the same library API. The API will supply operations to
initialize, load, build, start, inspect, and stop one project.

The API will give a lifecycle handle after it starts a project. The handle will give typed status
and one stop operation.

The stop operation will give the same result after each call.

The library API will have primary responsibility for these items:

- Project validation
- Build process supervision
- Shader process supervision
- The development game host
- Inspection and MCP services
- Development state
- Cleanup.

The command adapter will have primary responsibility for these items:

- Argument parsing
- Terminal input and output
- Exit codes
- Operating-system signal translation.

The library API will not read `process.argv`, write terminal output, or call `process.exit`. The typed
inputs will contain cancellation, log output, and port configuration.

Studio will import the library API directly. Studio will not use a shell command, terminal text,
HTTP, or MCP to start or stop the local project.

Browser-safe read clients will stay in a different module from the library API. A detached client
can use a validated network boundary to inspect a development session.

## Consequences

- The CLI command and Studio use one project service implementation.
- In-process callers do not parse terminal text or process exit codes.
- The command adapter stays small.
- The library API must have compatibility tests and stable error codes.
- Cleanup must be safe after the first call.
- Callers must have the local permissions that project services use.
- Browser clients cannot import CLI modules that use process APIs.
