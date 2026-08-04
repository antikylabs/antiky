# Slice 00 Outputs

Each Slice 00 run creates one `outputs/{run-id}/` directory. Do not overwrite an earlier run.

Keep core implementation files in `packages/`. This directory contains only delivery outputs that
the plan creates, such as:

- `receipt.json` as the machine-readable output manifest.
- `confirmation-checks.md` as the short human verification summary.
- `facts.json` as the recorded structured facts.
- `measurements.json` when the slice records timings, counts, or sizes.
- `captures/` and `logs/` when the plan requires them.

The receipt must list each stored output and its digest. Do not store credentials or other secrets.

The Evidence field in [`../plan.md`](../plan.md) identifies the authoritative receipt. Run
`s00-20260804T185103Z` remains immutable historical evidence and is superseded by
`s00-20260804T205140Z`, which records and corrects its browser-network evidence failure.
