# Website launch media matrix

Status: approved for implementation

Approval basis: the Antiky Labs owner instructed Codex on 2026-08-21 to execute
`goal-plan.md` through completion. This matrix narrows that delegated work; it does not approve any
later asset that changes the roles, claims, or creative direction recorded here.

## Rules shared by every slot

- An **Evidence capture** proves a Current claim and must retain source revision, fixture or state,
  capture date, dimensions, and file digests in `packages/website/media-publication.json`.
- An **Illustrative marketing image** establishes launch mood only. It must be visibly identified as
  illustrative wherever a visitor could mistake it for product output.
- Generated pixels cannot depict or repair gameplay, Studio UI, research output, charts, source code,
  or technical results.
- Reuse is deliberate. A Current capture can serve several routes only when it proves the same claim.
- Desktop focal content stays inside the middle 70% of the frame. Mobile-specific crops keep the
  subject inside the middle 74%; text is always real HTML or campaign typography outside the image.
- The Antiky Labs owner is the approval authority for every row. The implementation selection is
  covered by the approval basis above; any changed direction needs a new explicit review.

## Route and launch slots

| Owner / placement | Communication job | Role | Source | Master and delivery | Focal safe area | Caption | Alt-text intent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home `/` opening stage | Show one current browser study immediately after the thesis | Evidence capture | managed `antiky-town` capture at the implementation revision | 16:9 PNG master; 16:9 WebP; no separate mobile crop unless review shows the subject is lost | town structures and player marker within center 70% | Current browser study: Antiky Town | Name the visible voxel town, market structures, and warm evening light; do not call it a game release |
| Framework `/framework` opening evidence | Prove that the Framework runs a current authored world | Evidence capture | same approved `antiky-town` master as Home | reuse the approved 16:9 WebP | same as Home | Current Framework study: Antiky Town | Describe the rendered town and identify it as a current Framework study |
| Studio `/studio` launcher | Show the source-build entry state and available project actions | Evidence capture | current macOS Tauri source build, clean fixture state | lossless native-window PNG; bounded WebP | create, open, and recent-project choices readable in center 80% | Current source build: launcher | Describe create, open, and recent-project choices without implying a packaged release |
| Studio `/studio` workspace | Show the four-panel working loop in one truthful state | Evidence capture | current macOS Tauri source build with clean Antiky Town fixture | lossless native-window PNG; bounded WebP | running game, terminal, inspection, and activity panels all legible | Current source build: game, terminal, inspection, and activity in one workspace | Name the four visible panels and the running Antiky Town fixture |
| Studio `/studio` simulation controls | Prove pause and step controls exist in the current source build | Evidence capture | same build and fixture, paused state | lossless native-window PNG; bounded WebP | pause and step controls plus paused state remain visible | Current source build: paused simulation with step controls | Describe the paused simulation and visible step controls |
| Studio `/studio` detail | Prove current inspection and activity detail tabs | Evidence capture | same build and fixture, detail tabs open | lossless native-window PNG; bounded WebP | inspection and activity details readable; unrelated desktop content excluded | Current source build: inspection and activity details | Describe the open inspection and activity detail areas; do not infer selection or feedback features |
| Games `/games` current studies | Distinguish the three public runnable studies from Emberwyrd direction | Evidence capture | approved Antiky Town, Traversal Study, and Point Light Expo captures | three 16:9 WebPs; static linked posters | each study subject inside center 70% | Current Framework study: `[name]` | Describe only the visible study scene and identify it as a technical study |
| Demos `/demos` index | Let visitors choose a study without starting WebGPU | Evidence capture | same three approved public demo captures | reuse Games delivery files | same as Games | Verified static capture; play is available on the detail page | Describe each scene, not hidden controls or runtime behavior |
| Demo detail `/demos/:slug` | Show verified state before explicit Play activation | Evidence capture | matching managed capture for the selected slug | matching 16:9 WebP poster | control overlay must not hide the subject | Verified static capture from the current study build | Describe the scene; activation label supplies the interaction instruction |
| Research `/research` completed result | Show that the completed shader study has an inspectable result | Evidence capture | current research repository AOT report social chart or report view | lossless source copy; bounded WebP | title, plotted values, and source label legible at final size | Completed research: ahead-of-time shader study result | State the chart or report subject and completed status without adding a performance conclusion |
| Research `/research` active gym | Show the current voxel-rendering experiment, not a generated result | Evidence capture | current `voxel-rendering` checked evidence capture | lossless source copy; bounded WebP | geometry and material comparison remain visible | Active research: voxel-rendering gym evidence | Describe the visible voxel scene and identify it as active research |
| Resources `/resources` and children | Explain availability through status and source links | No media | server-rendered catalog facts and text | none | not applicable | not applicable | not applicable; do not add filler art |
| Launch/Open Graph landscape | Establish a recognizable Antiky launch mood without making a product claim | Illustrative marketing image | approved ImageGen brief; design reference plus current demo captures as visual references | distinct 16:9 PNG master; bounded 16:9 WebP | abstract physical-maquette subject in right-center 55%; quiet left field for external typography | Illustrative launch artwork | Abstract near-black maquette with warm amber and violet light; explicitly illustrative when displayed with a caption |
| Launch announcement square | Supply the actually planned square social crop without deriving it from landscape art | Illustrative marketing image | same approved brief and reference set, generated as a distinct request | distinct 1:1 PNG master; bounded 1:1 WebP | subject within center 70%; clear perimeter | Illustrative launch artwork | Describe the same abstract physical maquette and restrained lighting |
| Launch announcement portrait | Supply the actually planned 4:5 social crop without automatic cropping | Illustrative marketing image | same approved brief and reference set, generated as a distinct request | distinct 4:5 PNG master; bounded 4:5 WebP | subject in middle/lower 65%; quiet upper field for external typography | Illustrative launch artwork | Describe the same abstract physical maquette and restrained lighting |

## Reuse and exclusion decisions

- Home and Framework intentionally reuse Antiky Town because both slots prove the same current
  Framework output. Games, Demos, and demo detail routes reuse the same three public verified
  captures. Combat Arena remains an internal capture and historical ImageGen reference only.
- Studio states are not interchangeable: each of the four files has a distinct evidentiary job.
- Research imagery comes only from checked research artifacts. ImageGen is excluded from both
  research rows.
- Resources has no image slot. Its truth is better carried by reviewed catalog data and maturity
  labels than by decorative media.
- Generated launch work is a separate, text-free campaign family. It does not appear in a Current
  proof slot and is never described as a screenshot, demo, game, Studio view, or research result.
