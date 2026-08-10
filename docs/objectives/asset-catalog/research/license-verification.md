# CC0-first license and provenance verification

Last researched: 2026-08-09

This is the operating policy for deciding whether an asset may be indexed, previewed, or mirrored by the Antiky asset catalog. It is a conservative evidence framework, not legal advice. Ambiguous material stays out of the trusted catalog until a human resolves it.

## Executive summary

“The source says CC0” is not enough. A trustworthy record must connect a specific asset to a specific rights statement made by someone plausibly authorized to make it. The catalog must also distinguish:

- permission to use the asset from permission to call a source's API or crawl its site;
- rights in an individual asset from rights in a collection or database;
- permission to link to a source image from permission to copy and serve a thumbnail;
- copyright freedom from trademark, patent, privacy, publicity, moral-rights, endorsement, and cultural-protocol concerns.

The practical policy is:

1. Discover widely, but verify at the original publisher or authoritative institution.
2. Admit only item-level `CC0-1.0`, a well-supported worldwide public-domain determination, or an explicitly approved equivalent into the default trusted catalog.
3. Keep metadata-only evidence. Do not download and hash every asset merely to verify its license.
4. Mirror a preview only when the evidence covers that exact image or the source separately permits its reuse.
5. Quarantine uncertainty and preserve prior evidence when a source disappears or changes.
6. Never describe a record as “legally guaranteed.” CC0 itself is offered without warranties.

## What CC0 does—and does not do

[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) is a public-domain dedication by an affirmer who owns relevant copyright and related rights. It first waives those rights to the greatest extent permitted; if a waiver is ineffective, it supplies an irrevocable public-license fallback. It expressly reaches copyright, neighboring rights, database rights, and some rights held by the affirmer.

That strong grant has limits:

- The affirmer can surrender only rights the affirmer owns or controls.
- CC0 does not waive patent or trademark rights.
- Third-party privacy, publicity, personality, copyright, and related rights can remain.
- Moral rights may be unwaivable or unlicensable in some jurisdictions.
- The work is supplied as-is, without warranties of title, non-infringement, accuracy, or fitness.
- Reuse must not imply endorsement.

Creative Commons therefore says that no legal instrument can eliminate every copyright interest worldwide and advises reusers to determine whether they have all necessary rights in a CC0 work in its [CC0 FAQ](https://wiki.creativecommons.org/wiki/CC0_FAQ). The catalog's verified badge means “the recorded evidence passed this policy,” not “Antiky warrants the asset against every possible claim.”

### CC0 is not the Public Domain Mark

These signals are related but not interchangeable:

| Signal | Who applies it | What it asserts | Catalog treatment |
| --- | --- | --- | --- |
| CC0 1.0 | A creator or other rightsholder | The affirmer dedicates or licenses the rights it controls as broadly as possible | Preferred when applied to the specific asset by a plausible rightsholder |
| Public Domain Mark (PDM) 1.0 | Someone with reliable knowledge of status | The work is believed free of known copyright restrictions worldwide | Accept only with a credible institution or documented copyright-status analysis |
| “Public domain” text | Anyone | Meaning varies; it may mean expiration, government work, permission, or merely “free” | Review; never normalize to CC0 automatically |
| U.S.-only public domain | A source applying U.S. law | Copyright is absent in the United States | Not enough for an unqualified worldwide-ready badge |

Creative Commons describes PDM as a label for works believed to be in the public domain worldwide and CC0 as the strongest cross-jurisdiction dedication available on its [public-domain tools page](https://creativecommons.org/public-domain/). PDM should normally be used for old works already free of copyright, while CC0 is for a rightsholder relinquishing existing rights.

### Government work is not automatically global public domain

Under [17 U.S.C. sections 101 and 105](https://www.copyright.gov/title17/92chap1.html), copyright protection is generally unavailable for a work prepared by a U.S. federal employee as part of official duties. That does not automatically cover:

- contractors, grantees, state or local governments;
- third-party material embedded in a federal publication;
- trademarks, privacy/publicity rights, export restrictions, or non-U.S. rights.

Only admit such material when the source identifies the particular item as reusable and the record preserves the asserted legal basis and jurisdiction.

## Scope: four permissions, four separate decisions

Each source integration must answer four questions independently.

| Operation | What must authorize it | Safe default |
| --- | --- | --- |
| Index metadata and link out | Site/API terms plus applicable database rights | Store factual fields and source URLs only after reviewing source terms |
| Fetch metadata repeatedly | API agreement, documented feed, or crawl policy | Prefer official APIs/feeds; honor authentication, rate limits, and robots rules |
| Display a remote preview | Source hotlink policy and rights in the image | Do not hotlink unless explicitly intended by the source |
| Copy and host a preview or asset | Item-level asset license plus source/API terms governing obtained files | Mirror only after explicit approval; record the copied object's provenance |

Robots rules are crawl instructions, not a copyright license or proof of authorization. [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html) standardizes crawler behavior and explicitly notes that robots.txt is not a substitute for access controls. Antiky should comply with both robots policy and contractual terms; permission under one does not cure a prohibition under the other.

## Source hierarchy

Evidence closer to the actual rightsholder is stronger. Use this order:

1. **First-party item page or package:** the creator's or institution's stable item page, repository release, manifest, or included license file.
2. **First-party collection policy tied to the item:** an institution's explicit item flag plus its governing rights policy.
3. **Authoritative repository record:** a project release or commit whose owner is the creator and whose license applies to clearly enumerated files.
4. **Aggregator pointing to original evidence:** useful for discovery, never sufficient alone unless it is also the authoritative publisher.
5. **Search snippets, reposts, social posts, mirrors, and user tags:** leads only; never admission evidence.

Openverse is the clearest warning. Its [API terms](https://docs.openverse.org/_preview/2901/terms_of_service.html) say it aggregates third-party metadata, does not verify licensing, requires independent verification, prohibits scraping its catalog, and requires compliance with both API and host-platform terms. Its [consumer guidance](https://docs.openverse.org/api/reference/made_with_ov.html) repeats that license accuracy is not guaranteed. Treat every mixed-license aggregator in the same way unless its own primary documentation establishes something stronger.

### Mixed-license source rule

A provider-wide “open” reputation never propagates to every item. For a source that contains CC0, CC BY, NC, editorial-only, or restricted material:

- require an item-level rights field or badge;
- preserve the raw license identifier and version;
- resolve the license URL to an approved canonical identifier;
- reject missing, contradictory, custom, or inherited licenses until reviewed;
- follow the original item URL and corroborate the same status there;
- detect packages whose files have multiple licenses or exclusions.

The Met illustrates correct scoping: its [terms](https://www.metmuseum.org/policies/terms-and-conditions) distinguish Open Access items marked with the OA icon from other restricted materials, while its [image and data policy](https://www.metmuseum.org/policies/image-resources) distinguishes CC0 collection metadata from qualifying OA images. A collection-level data grant does not make every depicted work or every image CC0.

## Individual files, packages, and databases

A catalog entry can contain several rights layers:

1. the database selection/arrangement;
2. factual metadata;
3. the downloadable package;
4. individual models, textures, sprites, recordings, music, fonts, and source files;
5. third-party dependencies or embedded works;
6. preview renders, screenshots, cover art, logos, and documentation.

Do not infer one layer's license from another. Creative Commons' [data FAQ](https://creativecommons.org/faq/#data) explains that database structure, forms, field names, and individual contents can have different copyright status, and that sui generis database rights can restrict extraction or reuse of a substantial part. CC 4.0 and CC0 can cover database rights, but only rights held by the licensor; Open Data Commons licenses may cover the database without covering its individual contents.

For an asset pack, inspect the archive manifest or repository tree when practical. A top-level CC0 statement passes only when it clearly applies to all distributed files and contains no exclusions. Common blockers include:

- a bundled font with its own license;
- samples from a third-party sound library;
- branded logos or character likenesses;
- source files containing linked proprietary materials;
- “free assets” in a package whose README names separate terms;
- a CC0 model paired with a non-CC0 preview image.

### Fonts

“Font” can refer to a typeface design, font software, specimen art, or a bundled license. These are not the same rights object. Admit downloadable font software only under an approved software/font license or CC0 explicitly covering the font files; preserve any reserved font-name or attribution terms. Do not infer that a font file is unrestricted because a typeface design may be outside copyright in one jurisdiction.

### Software and components

Creative Commons says in its [license FAQ](https://creativecommons.org/faq/#can-i-apply-a-creative-commons-license-to-software) that it does not recommend CC licenses for software. For scripts, shaders, UI components, plugins, or tools, preserve the actual software license and dependency licenses. A CC0-first media collection may surface these in a separate `code-license` lane, but must not relabel MIT, BSD, Apache-2.0, GPL, or other code as CC0.

## Preview and thumbnail policy

A thumbnail is a reproduction and often a derivative crop or render. Small size does not itself make copying authorized. Apply this order:

1. Use an exact preview that the item-level CC0/PDM evidence clearly covers.
2. Generate Antiky's own preview from a verified asset when doing so is permitted and operationally safe.
3. Use a provider-supplied preview only when its reuse terms explicitly permit copying and redistribution.
4. Otherwise show metadata, a neutral placeholder, and a link to the source.

For every hosted preview, record:

- preview provenance type: `covered-original`, `antiky-generated`, or `separately-licensed`;
- source asset/version and transformation recipe when generated;
- preview source URL and retrieval time when copied;
- preview license/evidence reference;
- SHA-256 of the hosted preview, because Antiky is serving that exact file.

Do not routinely hash remote download archives solely for license verification. Hashing requires downloading bytes and proves identity, not permission. Compute an asset archive hash only when Antiky intentionally mirrors, validates, or imports that archive. A source-provided checksum may be stored without downloading the file but must be labeled `source-provided` rather than `verified-by-antiky`.

## Non-copyright risk screen

CC0 is not a substitute for content review. Apply these screens before trusted publication.

### Trademark and false endorsement

Quarantine recognizable brands, product trade dress, game/franchise names, sports marks, logos, and branded characters. CC0 does not affect trademark rights. The [USPTO explains](https://www.uspto.gov/trademarks/search/likelihood-confusion) that confusing similarity can arise from appearance, sound, meaning, or overall commercial impression, especially for related goods or services. Even absent confusion, do not present a source or creator as endorsing Antiky.

Generic props that incidentally contain a logo should have the logo removed only if the asset license permits modification and the resulting asset passes a fresh review. Record the transformation; do not silently call the original risk-free.

### Privacy, publicity, personality, and personal data

Quarantine recognizable real people, voices, signatures, personal records, license plates, addresses, or biometric material unless documented releases and lawful processing cover the intended use. A photographer's CC0 dedication cannot surrender a depicted person's rights. The [CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/) specifically flags privacy/publicity and non-endorsement constraints.

### Moral rights and integrity

Flag named artists, fine art, architecture, and culturally important works where attribution, integrity, or withdrawal rights may survive. CC0 attempts the broadest waiver/fallback available, but Creative Commons notes that some moral rights cannot be waived or licensed in every jurisdiction. The catalog can recommend factual creator/source credit even when CC0 does not require attribution.

### Patents and functional designs

CC0 does not grant patent rights. Quarantine assets primarily documenting a patented mechanism, proprietary industrial design, or implementable invention when the intended reuse would practice rather than merely depict it. Escalate to counsel for commercial distribution.

### Cultural heritage and community protocols

Legal public-domain status does not erase ethical, cultural, sacred, or community authority. Screen museum and archival content for culturally sensitive, secret/sacred, funerary, ceremonial, ancestral, or human-remains material. Respect source restrictions and community notices.

[Local Contexts' Traditional Knowledge Labels](https://localcontexts.org/labels/traditional-knowledge-labels/) communicate community protocols such as culturally sensitive, seasonal, gender-restricted, secret/sacred, non-commercial, or community-use-only treatment. These labels are not conventional copyright licenses, but they are material provenance signals. A restrictive or sensitive TK/BC Label sends the item to `restricted` or `quarantine`, even if a repository also claims public-domain copyright status. [RightsStatements.org](https://rightsstatements.org/page/1.0/?language=en) similarly includes “No Copyright—Other Known Legal Restrictions” for public-domain items subject to other constraints.

## Verification states

Use explicit state plus confidence; do not collapse uncertainty into a green badge.

| State | Meaning | Public behavior |
| --- | --- | --- |
| `candidate` | Discovered but item evidence has not been reviewed | Not in trusted results; internal research only |
| `verified` | Item-level evidence passes the checklist; no unresolved material risk | Searchable and labeled with exact rights basis |
| `verified-with-notice` | Rights basis passes, but a non-blocking notice or recommended credit applies | Searchable; notice displayed and exported |
| `quarantine` | Evidence is missing, contradictory, stale after material change, or a risk screen needs human judgment | Not downloadable or recommended; optionally visible to reviewers |
| `restricted` | Known license, API term, third-party right, or cultural protocol is incompatible with catalog policy | Excluded from public catalog; reason retained |
| `withdrawn` | Previously published record is removed because source/evidence changed or a credible complaint arrived | Stable tombstone without asset/preview distribution |

### Confidence is evidence quality, not legal certainty

Record a numeric score for prioritization, but derive state from hard gates. Suggested components:

| Evidence component | Points |
| --- | ---: |
| First-party item page or included license explicitly names CC0/PDM | 35 |
| Publisher is creator/rightsholder or an authoritative institution | 20 |
| Asset identity is stable and specific (ID/version/files) | 15 |
| Independent first-party corroboration (API plus page/package) | 10 |
| Package/file scope reviewed with no exclusions | 10 |
| Non-copyright risk screen completed | 10 |

`verified` requires at least 80/100 **and** all hard gates. A high score cannot override a conflicting license, uncertain ownership, forbidden API use, or a privacy/cultural/trademark flag. PDM and copyright-expiration determinations require the authoritative-institution or documented-analysis component.

## Decision table

| Situation | Decision | Reason / next action |
| --- | --- | --- |
| Creator's stable item page applies CC0 1.0 to the named pack; included license agrees; no exclusions or risk flags | `verified` | Preserve both evidence references and exact version |
| Creator says “free,” “royalty-free,” “no copyright,” or “use however” without canonical terms | `quarantine` | Ask for or locate an explicit license; these phrases are not equivalent to CC0 |
| Aggregator reports CC0 but original page is missing, disagrees, or names another license | `quarantine` | Aggregator metadata is discovery evidence only |
| Authoritative museum marks the item PDM/OA and its policy explicitly covers the downloadable image | `verified` or `verified-with-notice` | Preserve item flag, policy, jurisdiction/status rationale, and notices |
| Repository license is CC0 but asset archive contains files with separate licenses | `restricted` unless separable | Admit only clearly separable eligible files/variant |
| Asset is CC BY, OFL, MIT, or another permissive license | Separate non-CC0 lane, not CC0 | Preserve conditions exactly; do not normalize to CC0 |
| Asset is NC, ND, editorial-only, research-only, personal-use, or custom ambiguous terms | `restricted` | Incompatible with general game-building and redistribution |
| License is CC0 but preview rights are unclear | Asset may be `verified`; preview is placeholder/link only | Verification and preview mirroring are separate decisions |
| CC0 asset contains a recognizable brand/logo/character | `quarantine` | Trademark/third-party rights review required |
| CC0 photo/model/voice depicts an identifiable real person without documented release | `quarantine` | Privacy/publicity/personality review required |
| Public-domain cultural item has a restrictive TK Label or source restriction | `restricted` or `quarantine` | Copyright status does not nullify cultural or other legal constraints |
| Source removes the page but saved evidence was strong and no complaint exists | `quarantine` for refresh; do not relabel automatically | Preserve prior record; seek current authoritative corroboration |
| Source changes CC0 to a restrictive license | Stop new distribution and investigate; preserve prior evidence | CC0 is designed to be irrevocable, but the change may reveal mistaken authority or scope |
| Credible takedown/rightsholder complaint arrives | `withdrawn` immediately pending review | Disable previews/downloads; retain internal audit trail |

## Admission checklist

An automated importer may populate fields, but a record cannot become `verified` until every hard gate passes.

### Identity and provenance

- [ ] Canonical source URL resolves to the specific asset, not a search or category page.
- [ ] Creator/publisher identity and provider asset ID are recorded.
- [ ] Title, version/release, and asset type identify what was reviewed.
- [ ] Original landing URL and download URL are distinguished.
- [ ] Source chain is recorded when discovery came through an aggregator.
- [ ] Package scope or file manifest was checked for exceptions when applicable.

### Rights evidence

- [ ] Raw rights string, canonical normalized identifier, license version, and license URL agree.
- [ ] The rights statement applies to this asset and the relevant files—not just site metadata or page layout.
- [ ] The person/institution applying CC0 appears plausibly authorized.
- [ ] Original/source evidence corroborates aggregator metadata.
- [ ] PDM or expiration claims include a credible status basis and worldwide assessment; jurisdiction-limited claims are labeled.
- [ ] No conflicting terms, custom restrictions, or separate file licenses remain unresolved.
- [ ] Database/API terms permit Antiky's method and volume of metadata collection.

### Distribution and presentation

- [ ] Indexing, remote previewing, preview mirroring, and asset mirroring were decided separately.
- [ ] Hosted preview has its own provenance, license basis, and SHA-256.
- [ ] Antiky-generated preview records tool/version, inputs, and transformations.
- [ ] Required attribution/notices are retained for any non-CC0 lane.
- [ ] The page does not imply endorsement or guarantee freedom from all claims.
- [ ] The record links users to the original publisher and canonical legal instrument.

### Risk screen

- [ ] No obvious third-party franchise, character, brand, logo, trade dress, or product mark.
- [ ] No identifiable person's face, voice, likeness, signature, or personal data without appropriate clearance.
- [ ] Moral-rights/integrity risk was considered for named fine art, architecture, and culturally important works.
- [ ] No apparent patent/functional-design issue requiring escalation.
- [ ] Cultural heritage, sacred/sensitive material, human remains, TK/BC Labels, and institutional notices were checked.
- [ ] Malware and file-safety checks are tracked separately from license verification.

### Publication and maintenance

- [ ] Evidence retrieval time, verifier, policy version, and confidence components are stored.
- [ ] Refresh interval is assigned based on source stability and risk.
- [ ] Material changes trigger quarantine rather than silent overwrite.
- [ ] Complaint/takedown path and stable tombstone behavior are available.

## Required audit fields

The following is a conceptual record, not a commitment to a particular storage schema:

```json
{
  "assetId": "provider:stable-id",
  "provider": "provider-slug",
  "providerAssetId": "stable-id",
  "canonicalUrl": "https://publisher.example/item/123",
  "downloadUrl": "https://publisher.example/item/123/download",
  "creator": { "name": "Creator", "url": "https://publisher.example/creator" },
  "assetVersion": "2026-04-02",
  "discoveredVia": { "name": "aggregator", "url": "https://aggregator.example/result" },
  "rights": {
    "raw": "CC0 1.0 Universal",
    "normalized": "CC0-1.0",
    "canonicalUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    "scope": "all files in release except README",
    "jurisdiction": "worldwide",
    "assertedBy": "creator",
    "evidenceIds": ["evidence-item-page", "evidence-license-file"]
  },
  "sourceAccess": {
    "method": "official-api",
    "termsUrl": "https://publisher.example/api-terms",
    "termsRetrievedAt": "2026-08-09T00:00:00Z",
    "robotsCheckedAt": "2026-08-09T00:00:00Z",
    "databaseLicense": "CC0-1.0",
    "rateLimit": "documented provider limit"
  },
  "preview": {
    "mode": "antiky-generated",
    "sourceAssetId": "provider:stable-id",
    "recipe": "blender-4.x/render-recipe-v1",
    "sha256": "...",
    "evidenceIds": ["evidence-item-page"]
  },
  "riskFlags": [],
  "verification": {
    "state": "verified",
    "confidence": 90,
    "policyVersion": "2026-08-09",
    "verifiedBy": "reviewer-or-job-id",
    "verifiedAt": "2026-08-09T00:00:00Z",
    "refreshAfter": "2026-11-09T00:00:00Z"
  }
}
```

Evidence objects should contain:

- evidence ID and type (`item-page`, `license-file`, `api-record`, `terms`, `institution-policy`);
- exact URL and, where available, immutable commit/release URL;
- retrieval timestamp, HTTP status, content type, ETag, and Last-Modified;
- the short relevant rights excerpt or structured response fields;
- SHA-256 of the stored evidence text/JSON/screenshot, not necessarily the remote asset;
- storage/archive reference permitted by source terms;
- parser/importer version and reviewer notes.

Keep snapshots narrow: the license block, structured API record, included license file, and governing policy are usually enough. Do not archive an entire site or asset library when a small evidentiary extract proves the assertion.

## Refresh, diffing, and revocation handling

### Refresh schedule

- **30 days:** aggregators, personal creator sites, custom platforms, records with notices, or sources whose terms changed recently.
- **90 days:** stable creator storefronts/repositories and established asset providers.
- **180 days:** authoritative museums/government collections with persistent identifiers and versioned policy.
- **Immediate:** complaint, source webhook/change feed, failed URL, conflicting importer result, or material terms update.

Use conditional HTTP requests (`If-None-Match`, `If-Modified-Since`) when supported. Recheck the small evidence targets, not every download. Respect API quotas and source caching rules.

### Diff classification

| Change | Automated action |
| --- | --- |
| Formatting, tracking parameter, or non-rights metadata only | Update metadata; retain verification |
| Canonical redirect within same verified owner/item | Record redirect and review identity automatically where strong IDs match |
| Title/tags/files changed but license unchanged | Refresh metadata; re-review package scope if files changed |
| License text/URL/version/scope changed | Set `quarantine`; preserve old and new evidence |
| Item removed, 404/410, owner changed, or ID reused | Set `quarantine`; stop new mirroring until resolved |
| New trademark/person/cultural sensitivity signal | Set `quarantine` regardless of license |
| Explicit restriction, credible complaint, or malware | Set `withdrawn`/`restricted`; disable preview and download immediately |

### “Revocation” is an investigation trigger

Creative Commons licenses and CC0's waiver/license fallback are designed to be irrevocable for recipients. A later page edit does not necessarily erase rights already granted. However, do not automatically continue distribution: a change can reveal that the uploader lacked authority, the license covered different files, the asset was replaced at the same URL, or third-party rights exist.

On a restrictive change:

1. freeze the last verified evidence and identify the exact asset/version/hash if available;
2. stop refreshing or newly mirroring changed bytes;
3. quarantine the public record and remove hosted preview/download when identity is uncertain;
4. contact the source or investigate immutable releases and included license files;
5. restore only after a human documents why the prior grant still covers the exact distributed object.

This is intentionally more conservative than asserting irrevocability from metadata alone.

## Takedown and correction procedure

Publish a plain-language reporting channel on every asset page. A report should accept the asset ID, claimant/contact, claimed right, relevant URLs, and supporting evidence without demanding sensitive documents publicly.

On a credible report:

1. immediately suppress Antiky-hosted previews/downloads and set `withdrawn`;
2. retain evidence and logs privately; do not destroy the audit trail;
3. notify the verifier/source owner where appropriate;
4. distinguish catalog metadata correction from a legal takedown;
5. record outcome, decision maker, timestamps, and any replacement version;
6. leave a stable, minimal tombstone so clients do not silently receive a different asset under the same ID.

## Implementation gates

The importer should fail closed on these invariants:

- `verified` requires at least one first-party/authoritative item evidence object.
- `verified` cannot coexist with an unresolved risk flag.
- `CC0-1.0` normalization requires a matching raw assertion and canonical evidence; never infer it from “free.”
- PDM must remain `PDM-1.0` and must not be rewritten as CC0.
- A hosted preview requires preview-specific provenance and a local SHA-256.
- An aggregator record must include the original landing page and independent verification.
- Material evidence diffs automatically leave `verified`.
- Every public record exposes `verifiedAt`, exact rights identifier, source, and limitations/notices.
- Every static bundle carries a verification-policy version so downstream clients can detect policy drift.

Contract tests should use fixtures for: clean first-party CC0; aggregator-only CC0; mixed-license archive; CC0 asset with an unlicensed preview; PDM museum item; U.S.-only public-domain claim; license mutation; source disappearance; trademark/person/TK risk flag; and a withdrawn tombstone.

## Source-integration review template

Before adding a provider, write a short source profile answering:

1. Who publishes the assets, and are uploaders the creators/rightsholders?
2. Is it first-party, curated institutional, community-uploaded, or an aggregator?
3. Which item-level rights fields exist, and can they contradict collection defaults?
4. Does the source expose immutable IDs, versions, manifests, license files, and last-modified data?
5. What do website, API, download, hotlink, and redistribution terms separately allow?
6. What database license applies to bulk metadata?
7. What authentication, attribution, identification, caching, and rate-limit requirements apply?
8. Can Antiky store evidence excerpts, mirror previews, or mirror archives?
9. How are removals, license edits, and abuse reports surfaced?
10. Which content risks are common for this source?
11. What automated checks are reliable, and which decisions require humans?
12. What refresh cadence and kill switch will this connector use?

No connector should launch until its answers are linked from the source record and its terms have a retrieval date.

## Authoritative references

- Creative Commons, [CC0 1.0 Universal legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) — waiver, fallback license, covered rights, exclusions, and disclaimers.
- Creative Commons, [CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/) — concise reuse cautions for trademark, privacy/publicity, endorsement, and verification.
- Creative Commons, [CC0 FAQ](https://wiki.creativecommons.org/wiki/CC0_FAQ) — affirmer authority, worldwide limits, moral rights, and PDM distinction.
- Creative Commons, [Public Domain](https://creativecommons.org/public-domain/) — roles of CC0 and the Public Domain Mark.
- Creative Commons, [Frequently Asked Questions](https://creativecommons.org/faq/) — mixed rights, attribution, software, data, collections, and sui generis database rights.
- Openverse, [API Terms of Service](https://docs.openverse.org/_preview/2901/terms_of_service.html) and [consumer guidance](https://docs.openverse.org/api/reference/made_with_ov.html) — aggregator limitations, independent verification, source terms, API restrictions, and license accuracy warning.
- The Metropolitan Museum of Art, [Terms and Conditions](https://www.metmuseum.org/policies/terms-and-conditions) and [Image and Data Resources](https://www.metmuseum.org/policies/image-resources) — an example of item flags, separate image/data scope, and OA versus restricted material.
- Wikimedia Commons, [Reusing content outside Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) — file-description licensing, multi-license handling, source preservation, and moral-rights caution.
- RightsStatements.org, [rights statement vocabulary](https://rightsstatements.org/page/1.0/?language=en) — standardized public-domain/restriction distinctions.
- Local Contexts, [Traditional Knowledge Labels](https://localcontexts.org/labels/traditional-knowledge-labels/) — community protocols and culturally sensitive reuse signals.
- U.S. Copyright Office, [Copyright Act, Chapter 1](https://www.copyright.gov/title17/92chap1.html) — definitions and U.S. federal government works.
- U.S. Patent and Trademark Office, [Likelihood of confusion](https://www.uspto.gov/trademarks/search/likelihood-confusion) — trademark similarity and source-confusion risk.
- IETF, [RFC 9309: Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html) — crawler instructions and their security/access-control limits.

