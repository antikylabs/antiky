# Website update goal summary

Completed: 2026-08-17

## Result

The website-update goal now has an implementation-ready delivery plan and complete copy decks for
Framework, Studio, and Research. The work also produced the supporting Framework and Studio vision
documents and the editable two-level roadmap DSL used by the future Roadmap page. A correction pass
applied the website-local AI SEO, marketing, copywriting, copy-editing, and site-architecture
workflows to the plan and all three copy decks.

This goal planned the launch update and supplied its public copy. It did not change the production
website, documentation, demo layout, or media; those changes are the implementation work defined in
the plan.

## Deliverables

- [Implementation plan](../website-update/plan/goal-plan.md) — owns all fourteen acceptance
  criteria, exact source areas, delivery order, release gates, and completion evidence.
- [Framework page copy](../website-update/copy/framework.md) — explains the human-agent engine
  assumption, current Framework proof, TypeScript and BroMetal choices, shared authority, headless
  boundary, and product maturity.
- [Studio page copy](../website-update/copy/studio.md) — separates the current native workspace from
  ACP, exact-target feedback, mini apps, and durable-feedback direction, with four real screenshot
  specifications and release-aware actions.
- [Research page copy](../website-update/copy/research.md) — defines research gyms, distinguishes
  completed, active, and future work, and states the evidence required before a question becomes a
  claim.
- [Roadmap DSL](../website-update/plan/roadmap.txt) — keeps roadmap delivery and subitems to two
  editable single-line levels without dates or unsupported release assignments.
- [Framework vision](../website-update/vision-framework.md) and
  [Studio vision](../website-update/vision-studio.md) — durable direction used as the higher-weight
  source for the copy.

## Website-local review

- **AI SEO:** Each product page opens with a direct 41–55 word definition, has bounded metadata,
  names the evidence or next action, and requires the answer, maturity label, and primary action in
  server-rendered HTML. The plan preserves ordinary crawling, adds product definitions to
  `llms.txt`, keeps `llms-full.txt` grounded in public sources, and rejects crawler-only copy and
  extraction-shaped FAQ filler.
- **Marketing:** The positioning contract leads with a familiar category before the distinctive
  Antiky idea. It states the status quo, product value, one intended reader, and one primary action
  for Framework, Studio, and Research. Technical claims use first-party proof instead of comparison
  rhetoric, invented authority, or unsupported performance language.
- **Copywriting and copy-editing:** The decks address the reader as “you,” put benefits before
  mechanisms, use one primary and at most one secondary hero action, expand specialized acronyms on
  first use, and provide an exact link-destination ledger. Source and community actions now appear
  where they answer a later reader question instead of competing in the hero.
- **Site architecture:** The plan now includes a visual sitemap, URL map, navigation specification,
  and required internal-link paths. Every planned route needs a maintained inbound link and a useful
  onward link.

## Decisions captured

- Primary navigation becomes six destinations by replacing Assets with Resources and keeping
  Studio as the separate release-aware product action required by `DESIGN.md`. `/assets` remains
  the canonical CC0 catalog route.
- Roadmap becomes `/roadmap`, backed by a strict parser and a durable website-owned copy of the text
  DSL. The goal directory does not become a production dependency.
- Demo index cards become static screenshots. A demo detail page loads its module only after the
  visitor selects **Play [demo name]**.
- Games presents the four approved Framework studies separately from Emberwyrd. The study count and
  entries come from the demo catalog rather than duplicated page constants.
- Demo projects move from `packages/demos/antiky/<slug>` to `packages/demos/<slug>`. A script remains
  only when it has a caller, a documented manual workflow, or a checked artifact.
- Launch media receives source/capture provenance and bounded derivatives. Generated concept art
  cannot stand in for product or research evidence.
- The skills resource is a reviewed snapshot of `antikylabs/skills`; skills documentation also
  publishes through Docs, Markdown routes, search, sitemap, `llms.txt`, and `llms-full.txt`.
- Studio downloads remain gated until a GitHub release names its version, platforms, installation,
  notes, limitations, and downloadable assets.

## Implementation findings

- The website's manually maintained BroMetal version does not match the current Framework
  dependency and must be derived or reconciled before publication.
- The research README and the committed shader-report filename disagree; the public Research action
  must not point at the broken name.
- Home and Games contain a stale “seven focused studies” quantity while the approved public demo
  catalog contains four entries.
- Current demo paths are repeated across workspaces, scripts, tests, READMEs, and publication data;
  the directory move needs a repository-wide current-reference audit.
- Retired Town, Worlds, and Studio media still exists alongside current captures and needs an owned
  media-manifest cleanup rather than a filename-only replacement.

## Verification

- The four requested goal artifacts exist and are no longer stubs.
- The plan contains an owner and completion evidence for acceptance criteria 1 through 14.
- Framework, Studio, and Research are each classified and written as Explanation pages for one
  defined reader.
- Their direct definitions are 41–55 words. Metadata titles are at most 60 characters and
  descriptions are at most 160 characters.
- Each hero contains one active primary and one secondary action; Studio selects its primary through
  the release gate. Every named action has a destination in its copy deck.
- The AI-search review covers server-rendered answers, ordinary crawler access, agent-readable
  files, first-party evidence, acronym expansion, maintained review dates, and the prohibition on
  crawler-only content.
- The deterministic anti-slop prose checker reports `0 findings` across the plan and all three copy
  decks.
- `git diff --check` passes.
- Manual claim review checked the copy against `PRODUCT.md`, `DESIGN.md`, the current page source,
  public docs, demo catalog, Studio tests, and the local Research and Skills repositories.

No production tests were run because this goal changed planning and copy documents only. The plan
names the focused and full commands required for the implementation work.

## Commits

- `be04b98` — Write Framework and Studio vision
- `4e56f3a` — Add public Antiky roadmap
- `146a1ba` — Detail roadmap release scope
- `ae365d2` — Convert roadmap to YAML DSL
- `9a9c218` — Simplify roadmap DSL
- `5715529` — Plan website launch update
- `d8c2120` — Write launch page copy
- `fffa856` — Refine website launch messaging
