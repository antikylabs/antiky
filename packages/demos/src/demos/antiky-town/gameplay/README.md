# Gameplay

This folder contains the private Antiky Town host, semantic input adapter, systems, and game
policies. The host maps platform time and movement to the reusable `EngineSession`. It is not a
public Framework host API.

Reusable session, command, event, identity, inspection, and simulation mechanisms belong in
`@antiky/framework`. Town keyboard mappings and history choices stay here until another game proves
a broader contract.
