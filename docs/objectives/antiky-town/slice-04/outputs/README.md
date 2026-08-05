# Slice 04 Outputs

Each Slice 04 run creates one `outputs/{run-id}/` directory. Do not overwrite an earlier run.

Keep implementation files in `packages/`. This directory contains only delivery outputs that the
plan creates, such as:

- `receipt.json` as the machine-readable output manifest.
- `confirmation-checks.md` as the short human verification summary.
- `facts.json` as the recorded structured facts.
- `measurements.json` for compile, hash, asset-size, and static-upload measurements.
- `captures/` and `logs/` when a completion check needs them.

The receipt must list each stored output and its digest. Do not store credentials or other secrets.
