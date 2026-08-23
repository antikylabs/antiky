# 0012: Let the server decide online game state

## Status

Accepted

## Context

Emberwyrd is intended to support online play and large multiplayer worlds.

Clients cannot control the true game state. A modified client could claim false positions, damage,
inventory, ownership, or cooldown results. Moving control to a server later would require a large
rewrite.

## Decision

Server-hosted `EngineSession` instances will make the final gameplay decisions and run the true
simulation.

Clients will send limited groups of inputs and intended actions. An authenticated gateway will use
trusted data to identify the player and the player's permissions.

The session will check the game rules and calculate the result. It will send each client only the
updates that are relevant to that client.

A client can show predicted movement before the server responds. When the server state arrives, the
client must correct an incorrect prediction.

The server will send relevant current state and presentation cues, such as visual or audio effects,
to each client. It will not send the durable event log as the network update.

## Consequences

- Clients cannot directly set the true position, damage, inventory, or ownership.
- The server and clients must use compatible gameplay rules, build information, and input formats.
- Prediction makes controls feel more responsive. Prediction and correction add code and tests.
- The server must decide which updates each client needs. It must also manage session placement,
  checkpoints, and movement between sessions.
- Durable event history stays selective. Network updates for each frame stay temporary.

## Revision history

- `6facfccaf4614340a4181b4361f77117e59a5e76`: Prior version before the plain-language rewrite.
- `d59e241c5dc6948743a5f70db1e41ae65c183b44`: Replaced em dash punctuation with standard punctuation.
