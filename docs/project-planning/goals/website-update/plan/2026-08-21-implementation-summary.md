# Website update implementation summary

Work date: 2026-08-21 local / 2026-08-22 UTC

Result: implementation and verification complete; final commits are recorded below.

Baseline: `4f676ec326dd50dac1c5eb3020a550258a6cdc74`

Implementation anchor used by capture provenance:
`8e20c7ad167ed0522fb2314cf487df9aa24cbb87`

## Outcome

The website now presents Antiky Town as the primary public key art and first runnable proof. Combat
Arena remains an internal runnable project, but the website does not list, link, stage, route, or
publish it. A request to `/demos/combat-arena` returns HTTP 404.

The public site now explains the Framework, Studio, Games, Research, Resources, Skills,
documentation, and Roadmap with visible Current, Emerging, Direction, and Research question
boundaries. The public demo catalog has exactly three entries in this order:

1. Antiky Town
2. Traversal Study
3. Point Light Expo

The generated launch art is limited to illustrative Open Graph, Twitter, and external campaign
material. It does not replace Antiky Town or any other Current evidence capture.

## Changes delivered

### Demo workspaces and publication

- Moved the four demo workspaces from `packages/demos/antiky/<slug>` to
  `packages/demos/<slug>` and updated workspaces, lock data, scripts, fixtures, documentation, and
  build references.
- Kept Combat Arena source and internal capture data so the project remains runnable and the exact
  historical ImageGen input can be reproduced.
- Removed Combat Arena from the public catalog, static route parameters, staged build manifest,
  sitemap, copy, public media, and visual-review route set.
- Made the demo index, Games page, and summary placements static and poster-first. Only a demo detail
  page exposes one explicit **Play [name]** action.
- Verified that `antiky.game.js` is not requested before Play and is requested after Play.
- Changed the managed demo capture command to retain capture evidence by default. Operators can use
  `--no-evidence` when they explicitly want temporary output without evidence retention.

The path move is recorded in `1a61f9b` (`Flatten demo workspaces`) and `8e20c7a`
(`Fix flattened demo relative paths`). The website implementation commit is recorded in the commit
ledger below.

### Public information architecture and copy

- Set the ordered desktop header to Thesis, Framework, Games, Resources, Research, and Docs, with
  Studio as a separate release-aware action.
- Reordered the footer around product proof, open work, documentation, and community destinations.
- Rewrote Framework, Studio, and Research around current evidence and labeled future boundaries.
- Updated Home so Antiky Town is the opening proof and first demo action.
- Split Games into three current Framework studies and the unreleased Emberwyrd direction.
- Added `/resources`, `/resources/shaders`, `/resources/projects`, and `/resources/skills`.
- Kept `/assets` as the canonical CC0 catalog route.
- Added a server-rendered `/roadmap` backed by a checked two-level text format and strict parser.
- Updated metadata, Open Graph/Twitter images, sitemap entries, crawler discovery files, and internal
  link coverage.
- Reconciled public BroMetal copy with the installed `0.18.0` dependency and removed stale public
  study counts.

### Documentation

- Regenerated all 14 Framework API reference pages from current source.
- Audited the Framework, command-line interface, Model Context Protocol, Studio, assets, and new
  Skills documentation contracts against current source and tests.
- Added Skills overview, installation, and reference guides from the reviewed skills repository
  snapshot `c5970383cde4e90588ba7d039f7a665ebe3443fd`.
- Published Skills through docs navigation, HTML, Markdown, search, `llms.txt`, and
  `llms-full.txt`.
- Added behavioral documentation assertions for commands, routes, availability boundaries, and
  generated reference coverage.

### Evidence capture and media publication

- Re-shot all four runnable demos with three managed runs each. Antiky Town, Traversal Study, and
  Point Light Expo became public posters; Combat Arena stayed internal.
- Captured four separate Studio source-build states: launcher, full workspace, paused simulation,
  and inspection/activity detail.
- Published one completed shader-research artifact and one active voxel-rendering capture.
- Added `packages/website/media-publication.json` plus validation and publication scripts. The final
  manifest contains 12 public entries: three demo captures, four Studio captures, two Research
  captures, and three generated launch images.
- Removed stale and duplicate public media families. Those deleted files remain recoverable from
  Git history.
- Recorded source revision, state, dimensions, byte limits, SHA-256 digests, use, ownership, role,
  and generated-image provenance in the manifest.

The capture requirements and decisions are in the [media matrix](./media-matrix.md),
[shot list](./capture-shot-list.md), and [baseline inventory](./baseline-inventory.md).

### ImageGen launch set

The initial generated direction was rejected because it did not follow the supplied visual
references closely enough. The final landscape, square, and portrait assets were generated as three
separate calls. Each final call explicitly passed these four absolute files through
`referenced_image_paths`:

1. `packages/website/design/references/home-media-first.png`
2. `packages/website/media-masters/marketing/reference-snapshots/antiky-town.png`
3. `packages/website/media-masters/demos/combat-arena.png`
4. `packages/website/media-masters/demos/point-light-expo.png`

The Antiky Town reference snapshot preserves the generation-time bytes because its current evidence
capture was refreshed after generation. Every selected master has a prompt sidecar with the full
prompt, absolute reference paths, reference roles, input digests, generation method, date, and
selection record.

The final deliveries are:

| Delivery | Dimensions | Role |
| --- | --- | --- |
| `launch-key-art.webp` | 1600 × 900 | Illustrative Open Graph, Twitter, and landscape launch art |
| `launch-announcement-square.webp` | 1200 × 1200 | Illustrative square launch art |
| `launch-announcement-portrait.webp` | 1080 × 1350 | Illustrative portrait launch art |

All three delivery files were reviewed at their actual dimensions. They contain no generated text,
logo, interface, gameplay, research result, or technical claim. The [creative
brief](./imagegen-creative-brief.md) and [launch kit](./launch-kit.md) contain the placement rules,
alt text, hashes, and provenance details.

## Visual review and corrections

The production build was reviewed across 14 routes at 1440 × 960 and 390 × 844. The saved first
round and confirmation sets contain 56 required full-page captures, plus a running Antiky Town frame
and one Studio loading diagnostic.

The first round found two product defects:

1. The Project library still referred to four studies after Combat Arena was withheld. A regression
   assertion was added, observed failing, and the count was corrected to three.
2. The mobile Antiky Town detail poster sat inside the inactive 68svh runtime stage and showed large
   empty bands. A responsive CSS assertion was added, observed failing, and the poster phase was
   changed to a 16:9 container. The stage still expands after Play.

Blank lazy-image areas in a few first-round long-page captures were traced to images without a
`currentSrc` at screenshot time. The confirmation method scrolled each image into view, waited for
non-zero natural dimensions, returned to the top, and captured again. Every confirmation image is
loaded.

The [visual review record](./visual-review.md) contains the route list, defect record, direct Combat
Arena 404 result, click-to-play network result, generated-crop review, and tooling notes.

## Verification record

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass across all workspaces, including Tauri Cargo checks |
| `npm test` | Pass; root policy tests 113/113 and all workspace suites completed |
| `npm run build` | Pass; production website generated 1,552 static pages |
| release-ready website test with `NEXT_PUBLIC_STUDIO_RELEASES_READY=true` | Pass; 70/70 |
| Framework tests | Pass; 173/173 |
| CLI tests | Pass; 144/144 |
| Website tests | Pass; 70/70 |
| Demo verification | Pass; 73/73 |
| Demo capture-script tests | Pass; 20/20 |
| Studio app tests | Pass; 58/58 |
| Tauri JavaScript tests | Pass; 25/25 |
| Tauri Rust tests | Pass; 11 unit and 7 integration tests |
| Framework API generation check | Pass; 14 generated pages current |
| Media publication validation | Pass; 12 entries |
| Direct withheld route check | Pass; `/demos/combat-arena` returned HTTP 404 |
| Antiky Town activation check | Pass; no game module request before Play, request after Play |
| Desktop/mobile visual review | Pass; no unresolved visual blocker |

The root test output includes known BroMetal warnings for unused shader uniforms in Traversal Study
and Point Light Expo. The commands exit successfully, and this website goal did not change those
shader declarations.

## Roadblocks and resolutions

| Roadblock or correction | Resolution |
| --- | --- |
| Generated work did not match the references closely enough | Rejected it; reran three distinct ImageGen requests with all four exact files in `referenced_image_paths`; saved reference hashes and prompt sidecars |
| Antiky Town needed to replace Combat Arena as the public key art | Reordered every public proof surface around Antiky Town and removed Combat Arena from public delivery while retaining internal source and provenance |
| The previous Antiky Town poster did not represent the final current capture | Re-shot every demo with three managed runs and republished bounded derivatives |
| The first capture command invocation discarded detailed evidence sidecars | Added a failing default-behavior test, made evidence retention the default, added `--no-evidence`, and captured again |
| One Studio source file had JPEG bytes under a `.png` name | Normalized the master to a real PNG before publication and validation |
| Node 25 / npm 11 introduced an unwanted package-manager mutation during lock work | Used the repository-compatible Node 22 / npm 10 toolchain and removed the accidental field |
| The first Tauri verification environment omitted Cargo from `PATH` | Restored the Cargo path and reran the affected checks successfully |
| The first root test environment omitted `git-lfs` from `PATH` | Added `/opt/homebrew/bin` and reran the complete root test successfully |
| The in-app Browser initially had no controllable instance | Used a clean fallback window without saving unrelated state, then completed exact-size checks in an isolated Playwright session |
| First-round visual review found a stale count and mobile poster sizing defect | Added failing regression assertions, fixed both defects, and completed the confirmation pass |
| Long-page screenshots initially captured unloaded lazy images | Changed the confirmation capture procedure to require a non-zero natural size before capture |

## Anti-slop review

The prose checker inspected all changed and new Markdown files. It found one empty metaphor in the
creative brief; “material seams” was replaced with the concrete phrase “visible joins between
modules.” The final prose pass is recorded as clean in the commit handoff.

The structure checker reported 154 repository findings: 150 `no-uncollected-test` findings and four
pre-existing root-script findings. The test findings conflict with the repository's actual runners:
the root and workspace commands executed the named files, including the new website tests, and
reported their assertions. The four script findings are outside this website change. No test files
or unrelated scripts were renamed, moved, or deleted to silence the checker.

Oxlint is not installed in this repository, so the anti-slop code plugin could not run. It was not
installed as an unrequested repository dependency. Therefore this record does not claim that the
plugin's 20 code rules passed. Full type, test, build, release-mode, media, activation, and browser
checks were run separately; those checks do not replace mutation testing or prove that every
abstraction is necessary.

## Remaining release boundary

`NEXT_PUBLIC_STUDIO_RELEASES_READY` remains false by default because the repository contains no
approved packaged Studio release assets. The true branch has been built and tested, but production
must not enable it until a selected release includes its version, supported platform, installation
steps, release notes, limitations, and expected download files.

No implementation work remains for this website-update plan. Publishing or deploying the resulting
site is a separate operational action.

## Commit ledger

| Commit | Change |
| --- | --- |
| `1a61f9b` | Flatten demo workspaces |
| `8e20c7a` | Fix flattened demo relative paths |
| `a2039a4` | Publish website launch update: website, documentation, media, tests, and capture behavior |
| This record's commit | Planning evidence, visual captures, acceptance links, and implementation summary |
