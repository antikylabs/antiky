# Slice 01 Confirmation Checks

Run `s01-20260805T014602Z` passed at revision `3381c800ca2ee1eed07ded3e52c936d2e77abd54`.

- [x] AC-01 — Owner input and Slice 00 dependency are complete. owner-input_H.md and Slice 00 receipt
- [x] AC-02 — The focused Antiky Town host shows the reference town and lamp. captures/corrected-host.png
- [x] AC-03 — The fixed lamp identity, authored data, revision, history, and binding are inspectable. entity 018f0f3a-7b2c-7a1d-8e2f-123456789abd; slot 0
- [x] AC-04 — The same service supports a second headless point light. entity 018f0f3a-7b2c-7a1d-8e2f-123456789abe; no render binding
- [x] AC-05 — The accepted fixture reaches every projection and the next frame. 018f0f3a-7b2c-7a1d-8e2f-123456789ad0: revision 2, event 1, power 2
- [x] AC-06 — Every rejected fixture preserves all six protected state values. NO_OP, DUPLICATE_COMMAND, STALE_REVISION, VALUE_OUT_OF_RANGE, ENTITY_NOT_FOUND, WORLD_NOT_FOUND, INVALID_COMMAND, MISSING_PERMISSION
- [x] AC-07 — Replay, rebuild, and correction produce the required state. 018f0f3a-7b2c-7a1d-8e2f-123456789ad1: revision 3, event 2, power 1.05
- [x] AC-08 — Direct, CLI, Studio-compatible, and MCP clients agree. Exact point-light snapshot and identity parity
- [x] AC-09 — Only render slot zero becomes dirty. Changed and corrected paused snapshots each report [0]
- [x] AC-10 — Actual BroMetal full-block writes are measured. 2112 affected bytes; 4288 uniform bytes per frame
- [x] AC-11 — The normal path adds no readback, resource kind, draw, or submission. Paused command deltas are zero and steady windows match the baseline
- [x] AC-12 — Reload, reconnect, failure, disposal, shutdown, and security checks pass. bf1bf920-88bf-4109-935f-cb87f9ff1dda -> 16f04441-934f-470e-a520-f3ccb1064849; logs/verification-check.log
- [x] AC-13 — Framework and applicable CLI or Studio docs match behavior. Framework and CLI pages pass; Studio is N/A because its connection workflow did not change
- [x] AC-14 — Town Study remains available with no unapproved visual change. 0.998196 corrected-to-baseline similarity
- [x] AC-15 — Framework tests and the integrated repository check pass. logs/verification-check.log
- [x] AC-16 — The complete verifier passes from one clean Antiky dev start. correlation verify-4781a778-4ac5-475d-9012-6fa51e500d85
- [x] AC-17 — The closed receipt links all required facts and artifacts. Canonical receipt self-digest and artifact digests

The final goal audit passed. The evidence run is closed.
