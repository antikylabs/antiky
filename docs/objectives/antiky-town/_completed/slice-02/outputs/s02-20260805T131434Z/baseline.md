# Slice 02 Baseline

Run `s02-20260805T131434Z` starts from revision
`acc8ab4aceaab34844821c7326fb59252ffc4350`.

- BroMetal `0.15.0` is both installed and current in the npm registry.
- Shader regeneration produced no tracked change.
- All demo reference, geometry, shader-parity, and lifecycle tests pass.
- The complete repository check passes when its loopback-only tests can bind their ports.
- Town currently derives a delta in the render callback, caps it at `0.05` seconds, and gives the
  character motor `1/60`-second fixed steps.
- The retained Town reference reports 16 draws, 1,247 instances, three GPU submissions, and no
  normal GPU readback for each measured frame.
- The final verifier must capture the running result because no browser-control surface was
  available during this checkpoint.

The last-known-good software revision is the source revision above. Use a corrective or revert
commit if a later checkpoint cannot be fixed forward.
