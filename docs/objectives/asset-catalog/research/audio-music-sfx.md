# CC0 game audio source research

Research date: 2026-08-09

## Executive summary

Audio should be cataloged as downloadable assets with a captured license record, not merely as outbound search results. The safest first collection is a small number of creator-owned, collection-wide CC0 libraries. Large community repositories are useful next, but only when every imported item independently passes the license and provenance checks below.

Recommended acquisition order:

1. **Kenney audio packs** for polished, game-ready UI, interface, RPG, impact, and music-loop coverage.
2. **Tallbeard Studios / Abstraction Music** for more than 200 seamless game-music loops.
3. **Signature Sounds** for broad Foley, field recording, ambience, percussion, one-shot, and texture coverage.
4. **Curated CC0 itch.io packs** for focused gaps such as voices, horror, retro SFX, and genre music.
5. **Freesound CC0 items** for the long tail, but only after obtaining API terms suitable for commercial catalog ingestion or using a deliberately manual acquisition process.
6. **OpenGameArt CC0 items** for game-specific music and SFX, with item-level evidence.
7. **Government/public-domain collections** for unusual natural, scientific, historic, and space recordings.
8. **Impulse responses** as a specialist category after the core SFX/music experience is sound.

The highest-value near-term result is approximately 1,000–3,000 carefully selected audio files rather than tens of thousands of unreviewed recordings. Audio quality, clean loop points, usable loudness, meaningful tags, and trustworthy provenance matter much more than raw count.

## Non-negotiable license rule

The catalog's default redistributable tier should accept only:

- an explicit **CC0 1.0 dedication** covering the exact audio file or exact downloadable pack; or
- a clear **public-domain determination** from the originating government/archive, with its non-copyright restrictions recorded.

“Free,” “royalty-free,” “no copyright,” “free for games,” and “commercial use allowed” are not synonyms for CC0. They may prohibit raw redistribution, impose attribution, exclude AI use, or operate only as contractual permissions. Creative Commons also cautions that its licenses cover copyright and similar rights, not every possible right in a recording ([Creative Commons FAQ](https://creativecommons.org/faq/)).

For mixed repositories, never infer the license from the site, uploader, category, search filter, filename, or neighboring items. Store the license assertion for each item.

## Priority sources

### 1. Kenney — ingest first

- **Coverage:** UI/interface sounds, digital and casino audio, impact sounds, RPG audio, music jingles and loops, and other game-oriented packs.
- **Scale:** Kenney's paid All-in-1 bundle advertises **1,200+ sound effects and music loops** among 60,000+ assets. Individual packs are also available from asset pages; for example, Interface Sounds contains **100 files** ([All-in-1 listing](https://kenney.itch.io/kenney-game-assets), [Interface Sounds](https://kenney.nl/assets/interface-sounds)).
- **License:** Kenney states that all assets on its asset pages are CC0 and need no attribution; the license file included with a pack remains the preferred evidence ([Kenney support](https://kenney.nl/support)).
- **Formats:** The collection advertises OGG among its cross-engine formats. Capture the exact formats per downloaded pack rather than assuming all packs are uniform.
- **Ingestion:** Crawl the official asset index for `Category: Audio`, download each pack from its official asset page, unpack it, and preserve the included license file. The paid All-in-1 archive is a convenient audit/reference source but should not be required for public ingestion when the same packs have official free pages.
- **Preview:** Self-host a short OGG/MP3 preview derived from the CC0 source. Do not hotlink Kenney downloads or artwork.
- **Quality:** Very high for immediate game use: consistent naming, cohesive style, short files, and packs arranged around gameplay needs.
- **Priority:** **P0.** Catalog every official audio pack.

### 2. Tallbeard Studios / Abstraction Music — ingest first

- **Coverage:** Seamless music loops spanning ambient, chiptune, upbeat, and other game genres.
- **Scale:** The official pack says **over 200 songs** and currently exposes multiple dated/genre ZIP archives, including 71 MB, 142 MB, and 44 MB bundles ([official itch.io pack](https://tallbeard.itch.io/music-loop-bundle)).
- **License:** The page explicitly dedicates the pack under **CC0**, allows commercial and noncommercial use and modification, and says credit is optional. The creator expresses preferences against NFT, AI/ML, and direct unmodified resale, but explicitly describes those uses as permitted by the license. Preserve both the legal license and the nonbinding creator preferences.
- **Formats:** Verify during pack inspection; do not derive a format claim from the browser player.
- **Ingestion:** Download the current archives manually or through an authorized itch.io acquisition flow. Preserve the page snapshot, version label, pack ZIP, and any embedded license. Deduplicate songs that recur across quarterly, pre-2023, and genre archives.
- **Preview:** Generate a normalized 20–30 second preview and separately test the original loop seam. CC0 permits catalog previews, but hosting a derivative avoids reliance on itch.io's player/CDN.
- **Quality:** High value for prototypes and complete games. Add BPM, duration, loop points, mood, energy, genre, instrumentation, and seamless-loop verification.
- **Priority:** **P0.** This is the clearest large CC0 music collection found.

### 3. Signature Sounds — ingest after a sample audit

- **Coverage:** Field recordings, Foley, percussion, drum loops, sound effects, textures, ambiences, one-shots, and production material.
- **Scale:** The creator reports **150+ packs, 80 GB+, and thousands of professional WAV files** in the combined soundbank; individual packs remain free ([Signature Soundbank](https://signaturesounds.org/the-signature-soundbank)).
- **License:** The creator says everything on the site is released under CC0 and that downloads include a CC0 license file. This is unusually strong collection-level evidence.
- **Formats:** High-quality WAV, according to the official collection page.
- **Ingestion:** Start with 5–10 free packs across field recording, Foley, ambience, and UI-suitable one-shots. Verify that each archive actually includes the stated license and that all sounds are original recordings. Contact the creator before automated or high-volume acquisition; there is no documented API, bandwidth is material, and the paid combined archive supports the project.
- **Preview:** Self-host low-bandwidth derivatives after acquisition. Do not treat access to a paid combined download as permission to expose that paid archive itself; expose catalog entries and permitted CC0 files according to the catalog's normal policy.
- **Quality:** Potentially excellent, but long field recordings require editing, segmentation, noise assessment, and gameplay-oriented tags.
- **Priority:** **P0/P1.** Best broad source for real-world sound; begin with a human-reviewed pilot.

### 4. itch.io CC0 asset listings — curate pack by pack

- **Coverage:** Music, seamless loops, UI sounds, retro effects, voices, horror, weapons, and genre packs.
- **Scale:** itch.io's explicit asset-license filter currently shows **53 music-tagged** and **37 sound-effect-tagged** CC0 asset results; its broader CC0/royalty-free view is larger and crosses media types ([CC0 music assets](https://itch.io/game-assets/assets-cc0/tag-music), [CC0 sound-effect assets](https://itch.io/game-assets/assets-cc0/tag-sound-effects)).
- **License:** Mixed at the platform level. The `assets-cc0` filter is valuable discovery metadata, but the project page and downloaded archive must both agree. A user-created `cc0` tag is weaker and must never be treated as a license.
- **Formats:** Varies by pack; common audio claims in listings include WAV, OGG, MP3, MIDI, looped/non-looped variants, and stems.
- **Ingestion:** There is no suitable public bulk catalog API documented for this purpose. Build a review queue from the explicit license-filter pages, then manually capture project URL, author, project version/update date, the platform's `Asset license` field, page license text, archive license, filenames, and hashes.
- **Preview:** Use the creator's public player only for review. Publish a catalog-hosted preview only after the downloaded file passes the license gate.
- **Quality:** Highly variable. Require technical review and reject AI slop, near-duplicates, clipped material, mislabeled loops, and packs whose authorship is unclear.
- **Priority:** **P1.** Strong candidates include:
  - **1000 8BIT SOUND EFFECTS:** 1,000 categorized retro sounds; explicit CC0, paid $10 ([official pack](https://ef9.itch.io/1000-8bit-sound-effects)).
  - **Tallbeard's Music Loop Bundle:** the P0 source above.
  - **Interface SFX Pack 1, 200 Free SFX, Free Audio Asset Collection,** and voice packs exposed by the CC0 sound-effects listing. Each still needs archive-level verification.
  - **High Quality 16-bit RPG Music, Not Jam Music Packs, 33 Free Chiptune Loops,** and other results exposed by the official CC0 music/soundtrack filters. Each still needs archive-level verification.

### 5. Freesound — enormous long-tail source, API constraint

- **Coverage:** Sound effects, field recordings, ambience, Foley, UI one-shots, synthesized sounds, loops, and some impulse responses.
- **Scale:** A very large community database; search by tags, pack, duration, technical properties, and license.
- **License:** Freesound hosts CC0, CC BY, and CC BY-NC. Its FAQ says CC0 sounds can broadly be reused without attribution, while the other licenses carry conditions ([license FAQ](https://freesound.org/help/faq/)). Accept only API records whose exact license value is `Creative Commons 0`, and archive that value plus the sound page URL.
- **Formats and metadata:** API resources expose original filename/type, duration, sample rate, bit depth, channels, tags, previews, uploader, pack, and license; the license is a required response field ([API resources](https://freesound.org/docs/api/resources_apiv2.html)).
- **Ingestion/API:** API v2 requires a credential. Critically, the free API is limited to **non-commercial purposes**, and the terms prohibit making a full database copy except by agreement ([authentication](https://freesound.org/docs/api/authentication.html), [API terms](https://freesound.org/docs/api/terms_of_use.html), [full terms](https://freesound.org/help/tos_api/)). Before production ingestion, obtain written/commercial terms from Freesound. A small manual editorial workflow is an alternative, but it must not be disguised scraping.
- **Preview:** API previews are useful during authorized ingestion, but do not hotlink them as the production catalog. Once an original CC0 sound is lawfully acquired, generate and host the catalog preview.
- **Quality:** Variable. Use ratings/downloads only for triage, never as proof. Screen for clipping, silence, speech/private information, trademarked device prompts, copyrighted music in the background, and synthetic near-duplicates.
- **Priority:** **P1 after API permission; otherwise P2 manual.** This is the best long-tail source but not the easiest operational source.

### 6. OpenGameArt — game-specific, item-level only

- **Coverage:** Music and sound effects designed for games, including UI, paper, weapons, platformer, fantasy, and retro packs.
- **License:** The repository accepts several licenses, including CC0, CC BY, CC BY-SA, OGA-BY, GPL, and LGPL. Therefore it is a mixed-license source. Individual pages display `License(s)`; examples include the CC0 **Basic Sound Effects** MP3 collection and **Various Paper Sound Effects** ([Basic Sound Effects](https://opengameart.org/content/basic-sound-effects), [paper sounds](https://opengameart.org/content/various-paper-sound-effects)).
- **Formats:** Vary by upload; the cited basic pack contains 320 kbps MP3 files. Prefer lossless uploads when available and record all alternatives.
- **Ingestion:** Discover through category/search pages, then parse each item page and its exact file list. Require `CC0` as an explicit item license and check descriptions/comments for imported or remixed material. Preserve the item page, uploader, upload/update dates, license label, files, and any attribution/source notes.
- **Preview:** Host derivatives only after verification. The page preview is discovery evidence, not the distributable artifact.
- **Quality:** Variable and sometimes old. Game relevance is excellent, but provenance can be weaker than single-creator libraries.
- **Priority:** **P1/P2.** Curate high-utility collections rather than mirroring everything.

### 7. Signature public-domain nature/science collections

These sources fill hard-to-record niches but are not all legally identical to CC0.

#### NOAA ONMS Sound raw audio

- Data.gov records the National Marine Sanctuaries raw-audio dataset with an explicit **CC0 1.0** license ([dataset record](https://catalog.data.gov/dataset/onms-sound-raw-audio)).
- High-value coverage includes underwater ambience and marine acoustic recordings. These files may be very long, large, noisy, or scientifically calibrated rather than game-ready.
- Prefer dataset metadata/download endpoints over page scraping. Retain dataset identifier, station/instrument/time metadata, and the CC0 declaration. Segmenting into game-ready clips requires a derivative pipeline and careful labeling.
- **Priority: P1 specialist.** Excellent provenance and uniqueness; higher processing cost.

#### Yellowstone National Park Sound Library

- The National Park Service explicitly says the recordings available on its Yellowstone Sound Library page were recorded in the park and are in the **public domain** ([official library](https://www.nps.gov/yell/learn/photosmultimedia/soundlibrary.htm)).
- Useful for wildlife, geothermal, weather, water, and natural ambience. Record the exact source page because general government authorship should not be assumed for unrelated NPS media.
- Public-domain status is strong, but wildlife vocalizations and long ambiences need noise, loop, and species/location metadata review.
- **Priority: P1 specialist.** Add a curated natural-ambience collection.

#### NASA Artemis and mission audio

- NASA says its content is generally not subject to US copyright, but it also imposes media-usage rules: identify third-party material, avoid endorsement, protect insignia, and consider privacy/publicity rights. NASA asks to be acknowledged as source ([NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)).
- The Artemis Audio Library provides downloadable WAV/MPEG mission sounds and says they are cleared for use under those guidelines ([Artemis Audio Library](https://www.nasa.gov/artemisaudio/)).
- This is **not equivalent to a plain CC0 pack**. Put it in a `public-domain-with-policy` tier, exclude logos/third-party material and identifiable-person promotional use, preserve NASA's required context, and do not imply endorsement.
- **Priority: P2 editorial.** Excellent space/mission flavor, but a poor fit for an undifferentiated “CC0” badge.

#### NOAA PMEL samples

- NOAA PMEL says its acoustics-page information may generally be distributed unless marked copyrighted and asks reusers to cite NOAA PMEL and the page URL. It provides WAV and other samples such as whale calls and earthquake hydrophone recordings ([PMEL multimedia](https://data.pmel.noaa.gov/acoustics/multimedia.html)).
- Treat as public information with a source-credit request, not as blanket CC0. Verify each recording lacks a contrary notice.
- **Priority: P2 editorial.** Use when ONMS does not cover a needed scientific sound.

### 8. Wikimedia Commons — per-file public-domain/CC0 discovery

- **Coverage:** Historic recordings, natural sounds, mechanical sounds, spoken clips, music performances, and unusual archival audio.
- **License:** Commons is entirely “free culture,” but that includes attribution/share-alike licenses, not only CC0/public domain. Its policy requires the exact status on each file-description page and warns about non-copyright restrictions and country-specific public-domain rules ([Commons licensing policy](https://commons.wikimedia.org/wiki/Commons:Licensing)).
- **API:** The MediaWiki API provides programmatic access ([Wikimedia developer portal](https://developer.wikimedia.org/use-content/content/)). Query audio files and request `imageinfo`/`extmetadata`, then whitelist only unambiguous CC0 or public-domain templates. Keep the canonical file page and complete metadata response.
- **Preview:** Wikimedia transcodes can assist review, but locally generated previews make availability and provenance more stable.
- **Quality:** Variable; historic audio can be noisy and “public domain in the US” may not be public domain globally.
- **Priority:** **P2.** Editorial acquisition only, with a conservative template whitelist and manual jurisdiction review.

### 9. Impulse responses — specialist collection

Impulse responses are useful game-development resources even though users do not hear them directly. They recreate rooms, halls, outdoor spaces, speakers, and unusual resonant objects in convolution reverb.

#### Canyon Soundings

- A purpose-built outdoor canyon IR library whose official listing explicitly states **CC0**, permits modification and redistribution, and describes true-stereo combinations and WAV files ([Canyon Soundings](https://www.kvraudio.com/product/canyon-soundings-by-cthonophonic/details)).
- Preserve channel layout, microphone/orientation, distance, relative attenuation, sample rate, and recommended pairing—not just a generic “audio” tag.
- **Priority: P1 for IR launch.** Clear license and distinctive game-audio utility.

#### OpenAIR

- A rich acoustic IR library designed in part for game audio, but uploaders choose among Creative Commons licenses or all rights reserved; licensing appears at the bottom of each content page ([OpenAIR about](https://openairlib.net/?page_id=2)).
- Never ingest OpenAIR wholesale. Accept only specific entries explicitly dedicated CC0 after checking all bundled files and metadata.
- **Priority: P2.** Excellent discovery, expensive license review.

#### Reverb.js cautionary example

- Reverb.js itself is CC0, but its documentation says **most included impulse responses have their own licenses** and must follow their individual attributions ([project documentation](https://www.skypack.dev/view/reverb.js)).
- Do not import a repository because its package license is CC0 when embedded media has separate notices. This exact dependency-versus-content distinction belongs in the automated validator.
- **Priority: reject as a bulk source; inspect individual IR provenance only.**

## Watchlist and exclusions

| Source | Decision | Reason |
| --- | --- | --- |
| FreePD / current `en.freepd.cn` library | **Watchlist** | The current site claims more than 1,000 MP3 tracks originated at FreePD.com and are CC0 ([library](https://en.freepd.cn/music)). The original project's continuity/provenance and each mirrored file should be confirmed before ingestion. MP3-only is also suboptimal for editing and seamless loops. |
| Internet Archive | **Discovery only** | Massive and API-accessible, but item metadata and `licenseurl` are depositor supplied and collections frequently mix rights. Require an authoritative upstream source plus an exact CC0/public-domain statement; do not trust search metadata alone. |
| GameSounds.xyz | **Watchlist** | Useful aggregator and direct downloads, but licenses originate in many underlying packs. Import from the original creator when possible and validate each included README. |
| Soundwoofer | **Exclude by default** | Large community impulse-response library, but “free” is not evidence of CC0, and cabinet/amplifier captures can have extra product/trademark considerations. |
| Sonniss GDC Game Audio bundles | **Exclude from redistributable catalog** | Excellent professional material, but a custom royalty-free license restricts raw redistribution and prohibits AI/ML training; it is not CC0 ([official archive](https://sonniss.com/gameaudiogdc/)). It may be a user-download recommendation, never a mirrored catalog asset. |
| Pixabay, Mixkit, ZapSplat, Adobe SFX, Looperman | **Exclude from CC0 pipeline** | Custom platform licenses and/or redistribution limits. “Royalty free” does not satisfy the catalog's CC0/public-domain contract. |
| BBC Sound Effects / RemArc | **Exclude** | The common free-use path is not an unrestricted CC0 commercial redistribution grant. |
| Free Music Archive, Jamendo, ccMixter | **Discovery only** | Mixed licensing and changing platform/API access. Only original creator pages with exact item-level CC0 evidence may enter review. |
| Open-source game repositories | **Manual only** | A repository's code license often does not cover its audio. Require an asset-specific manifest or file-level dedication and audit imported samples. |

## Verification and ingestion contract

### Required evidence per pack and per file

Store these fields in the catalog source record:

- canonical creator/publisher URL;
- canonical item or pack URL;
- direct original download URL when redistribution/storage policy permits;
- creator/uploader identity;
- asset title and stable upstream ID;
- license identifier (`CC0-1.0`, `Public-Domain-USGov`, or a more precise approved value);
- license URL and verbatim license assertion;
- scope of assertion: site, collection, pack, item, or file;
- evidence capture timestamp and immutable page/archive snapshot hash;
- original archive hash and each extracted file hash;
- embedded `LICENSE`, README, cue sheet, attribution, and source files;
- update/version date;
- provenance notes, including whether audio is original, recorded, synthesized, remixed, or derived;
- any non-copyright restrictions, creator preferences, privacy/publicity risks, or trademark concerns.

Do not mark a source verified merely because a crawler downloaded and hashed it. Hashing proves which bytes were reviewed; it does not prove the uploader owned them or that the license assertion is valid.

### Automated license gates

1. Require an allowlisted license identifier and resolvable evidence URL.
2. For community sites, require item-level evidence; reject inherited site/category licenses.
3. Compare the web license, archive license, and metadata license. Any conflict goes to quarantine.
4. Reject archives containing files with separate or unknown notices unless those files are removed.
5. Reject `NC`, `ND`, custom “no resale,” editorial-only, personal-use, or ambiguous royalty-free terms from the redistributable tier.
6. Reject missing provenance, dead source pages without a captured license, and mirrors with no authoritative upstream link.
7. Record policy-limited public-domain material separately from CC0 so the UI never promises identical rights.

### Audio technical validation

For every playable file:

- decode the entire file with a real audio decoder;
- record container, codec, sample rate, bit depth, channels, duration, and byte size;
- calculate peak level, true peak where practical, integrated/short-term loudness, and DC offset;
- flag clipping, near-silence, corrupt/truncated frames, excessive DC, and extreme noise;
- generate a waveform and a small spectrogram for reviewer triage;
- fingerprint perceptual audio and exact bytes to find duplicates and transcoded duplicates;
- scan metadata and filenames for inconsistent authors/license claims;
- for loops, test the boundary discontinuity and record BPM, musical key when reliably known, bar count, and whether the loop is truly seamless;
- for SFX, trim only in derived editions and preserve the untouched original;
- for multichannel/ambisonic audio and IRs, preserve channel order and spatial metadata;
- produce a web preview in a broadly playable codec while retaining the lossless original when available.

### Human review rubric

A reviewer should answer:

- Is the sound useful in a real game without heroic cleanup?
- Does the name describe the audible event rather than a vague pack label?
- Are variants meaningfully different?
- Is background speech, music, radio, a recognizable voice assistant, or other third-party content audible?
- Could a voice create privacy/publicity issues?
- Does a weapon, vehicle, device, or interface sound misleadingly imply a brand?
- Is a music composition as well as the particular recording actually covered?
- Would a Content ID claim be likely despite the license? If so, document the dispute evidence.
- Is the preview representative and safe to autoplay at a normalized level?

## Catalog taxonomy for audio

Top-level kinds:

- `sound-effect`
- `music`
- `ambience`
- `foley`
- `ui-audio`
- `voice`
- `loop`
- `one-shot`
- `impulse-response`
- `instrument` / `soundfont` (future, with a separate sampled-instrument provenance review)

Minimum tags should cover:

- **event:** footstep, impact, explosion, button, pickup, door, water, weather, creature, weapon;
- **world/theme:** fantasy, sci-fi, modern, nature, horror, arcade, space, underwater;
- **function:** confirm, cancel, warning, success, damage, movement, transition, background;
- **sonic character:** organic, synthetic, tonal, noisy, soft, hard, bright, dark, clean, distorted;
- **music:** genre, mood, energy, tempo/BPM, key, meter, instrumentation, loopable;
- **spatial:** mono, stereo, binaural, ambisonic, multichannel, indoor/outdoor, perspective, distance;
- **technical:** WAV/FLAC/OGG/MP3, sample rate, bit depth, channels, duration;
- **review:** seamless-loop-tested, loudness-reviewed, clipped, contains-speech, content-id-risk.

Search results should distinguish a **pack** from an individual **file**. A user may want “one coherent fantasy UI pack” rather than 70 isolated clicks. Keep both entities and their relationship.

## Concrete acquisition batches

### Batch A — coherent starter library

- Every official Kenney audio pack.
- Tallbeard/Abstraction Music Loop Bundle, deduplicated and loop-tested.
- 5–10 Signature Sounds packs: footsteps/Foley, nature ambience, urban ambience, impacts, percussion, and UI-suitable one-shots.
- Target: **1,500–3,000 files**, depending on Kenney's current free-pack split and the Signature pilot.

### Batch B — game-specific gaps

- 15–25 itch.io packs selected from the explicit CC0-license filters.
- 20–40 OpenGameArt CC0 items selected by utility and provenance.
- Prioritize voices, creature sounds, horror, retro/chiptune, weapons, vehicles, magic, and longer genre music absent from Batch A.
- Target: **500–2,000 additional files** after deduplication.

### Batch C — natural and specialist audio

- NOAA ONMS underwater excerpts, with original dataset linkage.
- Yellowstone public-domain nature recordings.
- Canyon Soundings CC0 impulse responses.
- A tightly reviewed NASA Artemis collection in the policy-limited public-domain tier.
- Target: **100–500 curated entries**, emphasizing uniqueness over count.

### Batch D — long tail

- Freesound CC0 ingestion after commercial/API approval.
- Conservative Wikimedia Commons CC0/public-domain query and review.
- Item-specific OpenAIR CC0 impulse responses.
- This batch can grow continuously but should retain a daily review quota and never bypass provenance gates.

## Product recommendations

- Display **CC0** and **public domain with source policy** as different badges.
- Put the original source, captured license evidence, creator, formats, duration, channels, and download size on every detail page.
- Make preview playback explicitly opt-in and normalize preview loudness so browsing is comfortable.
- Offer engine-friendly derivatives (OGG for runtime, WAV/FLAC original, mono/stereo variants) as generated editions, never replacements for originals.
- Let agents query by gameplay intent: “soft fantasy inventory confirm,” “seamless 90 BPM forest ambience,” or “short mono robot damage sound.”
- Return a pack manifest with stable filenames, hashes, license record, and suggested credits even when attribution is optional.
- Add a `provenanceConfidence` field distinct from `licenseStatus`; a valid-looking CC0 label on a low-provenance community upload is not equivalent to an original Kenney pack.
- Do not expose third-party preview/download URLs as if they were durable APIs. Catalog-hosted metadata and derived previews should be stable; the canonical upstream link remains evidence and a route to support the creator.

## Final direction

The audio catalog can become unusually useful because existing asset directories usually optimize for discovery, not for game readiness or license evidence. The winning collection is not “every free sound.” It is a smaller, reviewed library in which an agent can trust that:

1. the exact recording is covered by the displayed rights statement;
2. the file decodes and meets known technical constraints;
3. loops loop, previews are representative, and variants are tagged;
4. the source and immutable evidence can be audited later; and
5. policy-limited public-domain material is never mislabeled as CC0.

Kenney, Tallbeard, and a Signature Sounds pilot give the catalog a credible launch set. itch.io and OpenGameArt fill game-specific gaps. Freesound should become the scalable long-tail source only after its API terms are explicitly compatible with the planned commercial/public catalog.
