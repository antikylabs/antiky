# 0015: WebGPU Support Only

## Status

Accepted

## Context

Orignally BroMetal and by extension Antiky wanted to support both WebGPU and WebGL2, however after discussion with BroMetal auther we've agreed to drop WebGL2 support and focus wholly on WebGPU.

## Decision

Antiky will only support WebGPU. Antiky will not support WebGL2. Most modern browsers support WebGPU, and as such that is our focus.

## Consequences

- The Runtime is smaller than it would be if we supported both.
- WebGL2 will not work.
- We get to focus on one protocol and standard. We do not waste time on balacing two.
- We stay in sync with BroMetal direction and support.
