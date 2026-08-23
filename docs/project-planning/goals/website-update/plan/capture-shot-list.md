# Website launch capture shot list

Status: captured and verified

All evidence is captured from a clean fixture at the implementation revision. Capture operators must
record the source revision and exact state before pressing the shutter. They must not repair product
evidence with ImageGen or paint over credentials after capture.

## Demo studies

The managed capture command is:

```bash
npm run demos:shoot -- --runs 3
```

| Slug | Required state | Reproducibility check | Selected frame |
| --- | --- | --- | --- |
| `antiky-town` | deterministic opening town view | three-run visual budget and control pair | run 1, captured 2026-08-22 UTC; public key art |
| `combat-arena` | deterministic opening arena view | three-run visual budget and control pair | run 1, captured 2026-08-22 UTC; internal only, not published |
| `point-light-expo` | deterministic three-light foundry view | three-run visual budget and control pair | run 1, captured 2026-08-22 UTC; public poster |
| `traversal-study` | deterministic opening platform route | three-run visual budget and control pair | run 1, captured 2026-08-22 UTC; public poster |

The selected captures are promoted through `npm run media:publish-demo --workspace @antiky/website`
only after `demos:verify` passes. The publication manifest owns exact fixture, source, and digest data.

## Studio source build

Use the current macOS Tauri source build and the clean
`packages/demos/antiky-town/antiky-town.antiky` fixture. Keep usernames, absolute paths, secrets,
unrelated notifications, and unrelated desktop windows outside the app state before capture.

1. **Launcher:** no project open; create, open, and recent-project choices visible. A recent entry is
   allowed only when its presentation does not expose an absolute local path.
2. **Full workspace:** Antiky Town running; game, terminal, inspection, and activity panels visible in
   one window. Do not populate diagnostics with invented events.
3. **Paused controls:** same fixture paused; paused state and step controls clearly visible.
4. **Inspection/activity detail:** same fixture; inspection and activity detail tabs open with only
   genuine fixture data.

Capture the full native window at a repeatable size. Store lossless PNG masters in
`packages/website/media-masters/studio/` and deterministic bounded WebPs in
`packages/website/public/media/studio/`.

## Research artifacts

1. **Completed:** select one current AOT shader study report/social chart from the research repository.
   Preserve the plot, title, labels, and source attribution at a readable delivery size.
2. **Active:** select the checked `voxel-rendering` evidence frame that best shows the common scene and
   camera. Do not imply it is a final renderer or a completed result.

Copy the original lossless artifact into `media-masters/research/`, publish a bounded WebP derivative,
and record the research repository revision plus source-file digest in the media manifest.

## Marketing assets

Marketing generation is governed by `media-matrix.md` and `imagegen-creative-brief.md`. Each call uses
all four recorded references through `referenced_image_paths`; 16:9, 1:1, and 4:5 are distinct calls.
The selected output remains Illustrative and never substitutes for a shot above.
