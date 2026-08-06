# Studio Slice 00 outputs

Each run creates one `outputs/{run-id}/` directory. Do not overwrite an earlier run.

Keep implementation in `packages/`. This directory contains delivery evidence only:

- `receipt.json` lists the run and every stored output.
- `confirmation-checks.md` summarizes human verification.
- `facts.json` records structured results.
- `measurements.json` records timing and resource facts when required.
- `captures/` contains the browser, desktop, terminal, and live-canvas reference images.
- `logs/` contains bounded build, test, Studio, and development-session logs.

The receipt must include a digest for each stored file. Do not store credentials, terminal history,
agent conversations, absolute private paths, or other secrets.
