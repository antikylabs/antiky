# 0005: Share one ability system across Antiky games

## Status

Accepted

## Context

Antiky games need these common ability-system parts:

- Active abilities
- Passive abilities
- Attributes
- Costs
- Cooldowns
- Effects
- Related rules.

A separate ability system for each game would duplicate complex behavior. Tools and agents would
also need to learn a different system for each game.

## Decision

Antiky will supply one programmable Antiky Ability System (AAS) for all games. The AAS will supply
common parts for abilities and attributes. Each game will own its content and rules.

We will build the AAS in small steps from real game features. We will not copy all features from
another engine's ability system.

## Consequences

- Games, Studio, and agents use the same ability terms.
- The framework owns shared behavior and state rules.
- Each game owns its abilities and balance.
- The AAS must work with commands, durable results, and authority rules.
- Its simulation rules must give the same results for the same inputs.
- The first AAS version will have fewer features than the Unreal Engine Gameplay Ability System.

## Revision history

- `d5512a91c2c6719a7488b03feebe01bd24eaf93b`: Formalized the initial Antiky Ability System boundary.
- `cb8ecc4b54e5607130c94fc64d568b58c9937e96`: Prior version before the plain-language rewrite.
- `d59e241c5dc6948743a5f70db1e41ae65c183b44`: Replaced em dash punctuation with standard punctuation.
