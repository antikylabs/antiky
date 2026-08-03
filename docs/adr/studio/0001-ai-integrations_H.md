# 0001: AI Integration

## Status

Accepted

## Context

Studio needs to work with coding agents without making one model vendor or another usage subscription
a prerequisite. Local AI can consume substantial machine resources, while cloud models require the
user's own trust and billing relationship.

## Decision

We will let users run the coding-agent harness of their choice through an integrated terminal and
connect it to Studio's structured engine surface. Studio will not require an Antiky-hosted AI token
service or subscription.

Optional built-in AI features will run locally by default and will state their hardware and software
requirements. Features that need hosted models will use bring-your-own-key configuration and remain
optional.

## Consequences

- Users can keep their existing agent, provider, account, and billing relationship.
- Antiky remains vendor-neutral and does not rely on AI-service revenue.
- Studio must maintain provider-independent integration points and secure secret handling.
- Local AI features may require substantial memory, compute, downloads, and setup.
- Hosted capabilities may differ by provider and by the user's account.

## Revision history

- `d5512a91c2c6719a7488b03feebe01bd24eaf93b` — Clarified local-first, vendor-neutral AI integration.
