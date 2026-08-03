# 0001: AI Integration

## Status

Accepted

## Context

For right now the Studio will not bring in it's own definition of AI systems and services, and will run completely locally. If an AI feature is added to the stuido it will be optional and local by default. Users should not have to purchase yet another AI subscription to use the studio.

## Decision

- We will allow use of AI via integrated terminal, allowing users to use the AI harness of their choice.
- We will provide visibility and integration points for AI to use the studio and all aspects of it.
- We will not provide a hosted AI service that forces users to subscribe to tokens, usage, etc.
- We will provide optional AI systems that run locally, and let the users know what is required to do so.
- We will provide byok to features that require more powerful AI.

## Consequences

- Users do not need yet another AI subscription.
- Antiky can stay as a neutral application, and uplevel users existing setups.
- Antiky will not generate revenue from ai services.
- Antiky will require more resources of a machine if local AI is enabled.
- Users get functionality over hype.
