# Slice 02 Outputs

Each Slice 02 run creates one `outputs/{run-id}/` directory. Do not overwrite an earlier run.

Keep implementation files in `packages/`. This directory contains only delivery outputs that the
plan creates, such as:

- `receipt.json` as the machine-readable output manifest.
- `confirmation-checks.md` as the short human verification summary.
- `facts.json` as the recorded structured facts.
- `measurements.json` for clock, render, and long-frame measurements.
- `captures/` and `logs/` when a completion check needs them.

The receipt must list each stored output and its digest. Do not store credentials or other secrets.

Completed run: [`s02-20260805T145240Z`](s02-20260805T145240Z/receipt.json).
