# Asset catalog objective summary

The asset catalog objective is complete and was archived on 2026-08-10. It established the first
trusted, static Antiky asset library and the research framework for growing it without weakening
license, provenance, delivery, or quality standards. The completed working folder was removed after
this summary was written.

## Delivered outcome

- Added `@antiky/asset-catalog` as the owner of the catalog schema, committed provider snapshots,
  explicit maintenance crawlers, preview generation, install behavior, and static API build.
- Published a static, versioned JSON contract at `https://catalog-api.antikylabs.com/v1/`, including
  a version manifest, the complete catalog, one document per asset, and locally hosted previews.
- Integrated asset discovery into the website with generated human-readable detail pages, browser-side
  filtering, permanent asset URLs, and complete agent-readable context through `/llms.txt` and
  `/llms-full.txt`.
- Built a metadata-first acquisition pipeline that does not crawl providers during deployment or a
  catalog request. Provider refreshes are explicit, bounded maintenance operations that produce
  committed, reviewable snapshots.
- Reached a closeout baseline of 1,453 CC0 records: 998 from Poly Haven, 212 Kenney packs, 82
  Quaternius packs, 17 KayKit packs, 82 OpenDuelyst resource families, and 62 Screaming Brain
  Studios packs.
- Added deterministic catalog, static-output, provider-contract, community-source, installation,
  delivery, and quality-tier checks around the shipped implementation.

## Research conclusions

The catalog has strong initial model, material, texture, HDRI, and low-poly pack coverage. Its main
remaining gaps are coherent audio and music, fonts, UI, VFX, animation, characters, vegetation,
genre-ready 2D families, and richer technical metadata for existing packs. Future acquisition
should improve collection balance and game usefulness instead of maximizing raw record count.

The recommended next structured source is ambientCG. Existing Kenney, Quaternius, Screaming Brain,
OpenDuelyst, and KayKit records should be enriched before equivalent sources are duplicated. Strong
curation candidates include reviewed creator collections for 2D art, audio, and fonts. Cultural,
scientific, museum, government, geospatial, and large mixed-license sources require specialized or
quarantine-first pipelines.

Components, shaders, templates, generators, and sample projects are a separate catalog class. They
can share discovery surfaces, but their actual software licenses, dependencies, engine versions,
source revisions, notices, and render/build evidence must remain distinct from CC0 media records.

## Durable admission rules

- A provider's reputation, search filter, user tag, repost, or aggregator record is discovery
  evidence only. Trusted publication requires evidence tied to the specific item or bounded pack.
- Record identity, publisher authority, license scope, preview rights, source-access terms, technical
  validation, and non-copyright risks as separate decisions.
- Treat metadata indexing, repeated metadata retrieval, remote preview display, preview mirroring,
  and asset mirroring as separate permissions. Approval for one does not imply the others.
- Do not convert “free,” “royalty-free,” provider-wide “open,” or another permissive software or
  font license into a CC0 claim.
- Keep mixed-license sources item-scoped. Quarantine conflicting, missing, inherited, stale, or
  unclear rights evidence instead of silently accepting it.
- Screen trademarks, likeness and privacy rights, moral rights, functional or patent concerns,
  cultural protocols, sensitive heritage material, unsafe files, and third-party content separately
  from copyright status.
- Preserve immutable source identity, raw and normalized rights data, evidence retrieval time,
  preview provenance, hashes for hosted bytes, review state, confidence inputs, refresh policy, and
  correction or takedown history.
- Prefer coherent pack-level records. Do not inflate the catalog by publishing every frame, map,
  glyph, or component file as a separate asset.
- Use deterministic snapshots and human-reviewable refresh diffs. A material upstream change sends
  a record back to quarantine; it does not silently overwrite prior evidence.

## Source posture

- **Automate** only structured sources with authoritative rights evidence and acceptable API or feed
  terms. Cache requests, respect rate limits, and keep automation metadata-only unless file retrieval
  is intentionally approved.
- **Curate** valuable sources that lack a safe bulk interface or require per-item evidence.
- **Contact first** when ownership, crawling, hotlinking, preview, or feed permission is unclear.
- **Quarantine** specialist sources that require object-level rights or non-copyright review.
- Use aggregators and marketplace filters for **discovery only** unless the original publisher and
  exact item independently satisfy the admission gates.
- Keep OFL, MIT, Apache, BSD, zlib, GPL, and other non-CC0 material in accurately labeled separate
  lanes with their conditions and notices intact.

## MCP and delivery decision

The public catalog remains static-only. Antiky does not host an asset-catalog MCP server while the
website and catalog API need no runtime API, database, sessions, jobs, or authenticated state.
Agents consume the same static JSON and agent-readable documents as other clients.

If protocol-specific discovery becomes necessary first, the preferred intermediate option is an
optional local stdio package that reads and caches the public catalog and exposes bounded read-only
search and lookup tools. A hosted MCP endpoint should be reconsidered only for needs such as private
collections, authenticated generation jobs, server-side installation, queries unsuitable for static
delivery, or measured client demand that cannot use static resources.

## Closeout and future work

The implementation and maintained user documentation are now authoritative. The archived research
was a dated 2026-08-09 snapshot, not a standing warranty, permission to crawl, or executable backlog.
Any future provider integration must recheck current rights, access terms, technical behavior, and
product priorities before implementation.

Future catalog expansion must start as a new objective with a bounded outcome. It should reuse the
admission rules above, but revalidate sources rather than treating historical recommendations as
approval.
