# 0007: Use commands to change world state

## Status

Accepted

## Context

These callers must request changes to shared world state:

- Studio
- Agents
- Gameplay clients
- Services
- Tests
- Future administration tools.

An authoritative session owns this state and controls changes to it. External callers must not have
direct write access to shared world objects. Direct access can bypass:

- Input validation
- Authority checks
- Revision checks
- Audit history
- Consistent notifications.

## Decision

An external caller must use a versioned command for each important state change.

The command ingress is the entry point for these commands. It must do these actions:

- It must validate each command against its schema.
- It must get the caller identity from a trusted source.
- It must make sure that the caller has the necessary permissions.
- It must reject duplicate requests.
- It must check the required revision or tick window.
- If all checks are successful, it must schedule the command.

A command handler must accept or reject the command. The command handler must return this decision
in a structured result. If necessary, the handler must emit a durable event, a transient delta, or
both.

A durable event records accepted history. A transient delta reports a temporary update.

Internal fixed-tick systems can update runtime state through session-owned APIs. These systems do
not need a command for each frame update.

## Consequences

- All callers use the same path for validation. Permissions can be different for each caller.
- Undo and audits use the command path.
- Conflict detection and sandbox promotion use the same command path.
- Authoritative networking also uses this command path.
- External clients can depend on command formats and rejection codes. Each format and code has a
  version.
- The system validates each local edit and sends it to a handler. It does not serialize the edit
  when the caller and the session are in the same process.
- Only private runtime code can bypass the command ingress. The session must own this runtime code.

## Revision history

- `4c35b270f3da017454b12dd75e104b0c50355818` — Prior version before the plain-language rewrite.
