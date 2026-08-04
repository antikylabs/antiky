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
- Future administrative tools.

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

Internal fixed-tick systems can update runtime state through session-owned APIs. These systems do
not need a command for each frame update.

## Consequences

- All callers use the same path for validation. Permissions can be different for each caller.
- Undo and audits use the command path.
- Conflict detection and sandbox promotion use the same command path.
- Authoritative networking also uses this command path.
- Commands and rejection codes are public contracts. Each public contract has a version.
- The system validates and dispatches a local edit. It does not serialize the edit when the caller
  and the session are in the same process.
- Only private runtime code can bypass the command ingress. The session must own this runtime code.
