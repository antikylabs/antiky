# 0001: Let users choose their AI coding tools

## Status

Accepted

## Context

Studio must work with coding agents from different providers. It must not require one model provider
or a new subscription.

Local AI can use large amounts of memory and processing power. Cloud AI requires the user to trust
the provider and pay the provider directly.

## Decision

Users can run their preferred coding-agent tool in the Studio terminal. The tool can connect to the
structured engine API.

Studio will not require an AI token service or subscription from Antiky.

Optional AI features in Studio will run on the user's computer by default. Each feature will state
its hardware and software requirements.

An optional cloud feature will use an API key that the user supplies. Antiky will not supply the
account or API key.

## Consequences

- Users can keep their current agent, provider, account, and payment plan.
- Antiky does not depend on one AI provider or income from an AI service.
- Studio must supply connections that work with different providers.
- Studio must store and use API keys securely.
- Local AI features can need substantial memory, processing power, downloads, and setup.
- Cloud features can be different for each provider and user account.

## Revision history

- `d5512a91c2c6719a7488b03feebe01bd24eaf93b` — Clarified local-first, vendor-neutral AI integration.
- `5ccd6638aa0124b286c5dc7562884f5c2d707f79` — Prior version before the plain-language rewrite.
