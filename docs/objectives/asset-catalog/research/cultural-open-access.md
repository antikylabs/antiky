# Cultural, scientific, and government open-access sources

Research date: 2026-08-09

This report evaluates archives that can supply public-domain or CC0 material useful in games: reference art, textures, maps, terrain, natural-history imagery, audio, and ready or convertible 3D models. It deliberately separates the rights in catalog metadata, the depicted work or object, and the delivered media file. An archive is not safe to ingest merely because its metadata is open or its institution is public.

This is source research, not legal advice. The catalog should preserve the institution's current object-level rights statement and let users follow it to the primary record.

## Executive recommendation

Start with five narrow importers that have strong machine-readable rights signals and useful formats:

1. **Smithsonian Open Access CC0 records**, initially 3D `glTF`/`glb`/`obj` and selected natural-history 2D media.
2. **NASA 3D Resources**, initially models and textures without visible people, NASA identifiers, or third-party credits.
3. **Art Institute of Chicago public-domain works**, using the API's `is_public_domain` filter and conservative IIIF sizes.
4. **Cleveland Museum of Art Open Access images**, using its daily API or bulk dump and only image records explicitly released under the open-access terms.
5. **Natural Earth**, as pack-level public-domain vector and raster map resources rather than millions of tiny catalog entries.

Then add National Gallery of Art, The Met, Getty, Rijksmuseum, Walters, USGS 3DEP, and NOAA Digital Coast through specialized adapters. Keep Europeana, Library of Congress, NYPL, GBIF, Biodiversity Heritage Library, and mixed government galleries in a discovery-only queue until their item-level rights and non-copyright concerns can be represented accurately.

No institutional source should be promoted directly from crawl to public catalog. A deterministic snapshot, object-level rights evidence, media-origin evidence, and a reviewable diff are mandatory.

## Rights model: three layers, not one license field

Every candidate has at least three independently licensed layers:

| Layer | Example | Catalog rule |
| --- | --- | --- |
| Record metadata | title, creator, date, dimensions | Record the metadata license separately. CC0 metadata does not license the media. |
| Underlying work or data | painting, map, scan subject, observation | Require an explicit CC0/Public Domain designation or a qualifying U.S.-government authorship statement. |
| Digital media | JPEG reproduction, mesh, texture, audio file | Require an explicit reusable-media statement, a matching item flag, or a defensible government-work provenance. |

The Art Institute API illustrates the trap: most response data is CC0, descriptions are CC BY, and its IIIF service also contains images that are not public domain. Its documentation explicitly tells clients to filter on `is_public_domain=true` and warns that an image URL by itself proves nothing ([API documentation](https://api.artic.edu/docs/)). The Biodiversity Heritage Library similarly dedicates its metadata to CC0, but that is not a collection-wide grant for every scanned page ([developer and data tools](https://about.biodiversitylibrary.org/tools-and-services/developer-and-data-tools/)).

Use these catalog values rather than collapsing the layers:

- `metadataLicense`
- `workRightsUri`
- `mediaRightsUri`
- `rightsEvidenceUrl`
- `rightsCheckedAt`
- `rightsScope`: `item`, `media`, `collection`, or `government-authorship`
- `nonCopyrightReview`: `clear`, `needs-review`, or `restricted`

## Priority source catalog

### Tier 1 — automate after a sampled importer review

#### Smithsonian Open Access

- **Game value:** exceptionally broad 2D reference and texture material plus genuinely useful 3D scans of scientific, historical, and cultural objects.
- **Scale and access:** millions of CC0-designated digital assets; official API, weekly JSON data on GitHub, IIIF manifests, and object records. Formats include JPG, TIFF where available, `glTF`, `glb`, full- and 150k-face OBJ, and Voyager scenes ([Open Access FAQ](https://www.si.edu/openaccess/faq)).
- **Rights boundary:** only media carrying the CC0 designation qualifies. Smithsonian metadata may exist for restricted objects even when no reusable media is supplied. “No known copyright restriction” is not equivalent to CC0 and belongs in quarantine.
- **Caveats:** CC0 addresses copyright, not trademark, privacy, publicity, or other third-party rights. Smithsonian names and marks are excluded. Smithsonian also excludes culturally sensitive material from Open Access in some cases and asks reusers to respect the dignity of represented communities ([Terms of Use](https://www.si.edu/termsofuse), [Open Access values](https://www.si.edu/openaccess/values)).
- **Ingestion:** accept only an object/media pair whose current record carries CC0. Preserve unit, accession number, contributor/credit line, object URL, media URL, and 3D format/LOD. Quarantine human remains, funerary or sacred objects, Indigenous cultural materials, identifiable people, trademark-heavy objects, and any record containing sensitivity or restriction language.
- **Priority:** **P0 for 3D; P1 for curated 2D.** It is the clearest institutional route to game-useful scans.

#### NASA 3D Resources

- **Game value:** spacecraft, satellites, rovers, planetary bodies, mission equipment, texture maps, and printable models. Strong source for simulation, education, science-fiction reference, and physically based space scenes.
- **Scale and access:** the official hub currently exposes a searchable collection with 3D model, printable, image/texture, collection, contributor, and format filters; files include formats such as `glb`, `usdz`, STL, LWO, Maya, TIFF, and others. The archive is mirrored on GitHub ([3D Resources](https://science.nasa.gov/3d-resources/)).
- **Rights boundary:** NASA says its images, audio, video, and files used to render 3D models generally are not subject to U.S. copyright, but third-party material is separately marked. This is a government-work policy, not a CC0 collection claim ([Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)).
- **Caveats:** NASA insignia, logotype, and identifiers are protected; use must not imply endorsement. Identifiable astronauts and employees introduce publicity/privacy limits, especially for commercial or promotional uses. Contributors can include outside organizations, so “hosted by NASA” is insufficient provenance.
- **Ingestion:** capture author/contributor and the exact file page. Automatically quarantine models or textures credited to a non-NASA contributor, containing prominent marks, or depicting an identifiable person. Prefer celestial bodies, terrain, instruments, and unbranded spacecraft geometry. Label the rights basis `US government work; NASA media guidelines`, not CC0.
- **Priority:** **P0 curated importer.** High game utility, modest collection, and manageable review volume.

#### Art Institute of Chicago

- **Game value:** high-resolution paintings, prints, decorative patterns, historical costume, objects, and sculpture reference useful for textures, UI, props, and mood boards.
- **Scale and access:** REST API, bulk data dumps, IIIF Image API 2.0, and IIIF manifests. The API documents pagination and a public-domain filter. It recommends 843-pixel IIIF derivatives for ordinary use, permits larger public-domain derivatives, supports CORS, and asks scrapers to make one request at a time with about a one-second delay ([API documentation](https://api.artic.edu/docs/)).
- **Rights boundary:** require `is_public_domain=true` on the artwork and preserve image-specific credit data. Descriptions are CC BY rather than CC0; do not copy them into a CC0-only catalog. Other API metadata is CC0, but non-public-domain images remain reachable through IIIF.
- **Caveats:** image records can be unpublished or replaced. Depicted people, trademarks, or culturally sensitive objects still require review.
- **Ingestion:** use bulk dumps for discovery, then confirm the live artwork record before publication. Generate previews through the recommended IIIF size, not full-resolution scraping. Store `content_e_tag` or equivalent revision fields where available.
- **Priority:** **P0 for curated 2D batches.** Excellent API and unusually explicit implementation guidance.

#### Cleveland Museum of Art Open Access

- **Game value:** paintings, textiles, armor, decorative objects, sculpture, manuscripts, and high-resolution historical reference.
- **Scale and access:** more than 64,000 artwork records and image assets for more than 37,000 works; REST API plus daily JSON/CSV data in GitHub, with web, print, full-size, and uncompressed image links where available ([Open Access API](https://openaccess-api.clevelandart.org/)).
- **Rights boundary:** the dataset is CC0, but it also contains identifying records for artworks still under copyright. Accept media only when the corresponding artwork/image fields identify it as an Open Access work under the same unrestricted terms.
- **Caveats:** a dataset-wide CC0 grant for metadata is not evidence that every described work or image is public domain. Apply ordinary privacy, publicity, trademark, and cultural-sensitivity review.
- **Ingestion:** prefer the daily bulk snapshot, retain accession ID and image variant metadata, and cross-check a live object record before first publication.
- **Priority:** **P0/P1.** Strong structured access and useful object imagery.

#### Natural Earth

- **Game value:** world coastlines, land/ocean polygons, rivers, lakes, borders, populated places, relief, and raster base maps for strategy games, globes, map backgrounds, and procedural world tools.
- **Scale and access:** three levels of detail (1:10m, 1:50m, 1:110m) with vector and raster themes. Bulk vector bundles are offered as SHP, SQLite, and GeoPackage; the quick-start kit is about 219 MB ([downloads](https://www.naturalearthdata.com/downloads/)).
- **Rights boundary:** all Natural Earth raster and vector data versions on the official site are declared public domain for commercial and noncommercial reuse ([terms](https://www.naturalearthdata.com/about/terms-of-use/)).
- **Caveats:** boundaries can be politically disputed; the project documents de facto and disputed-boundary handling. Data is generalized and unsuitable for navigation or high-detail terrain.
- **Ingestion:** catalog releases and theme packs rather than individual features. Preserve version, scale, theme, disputed-boundary metadata, and upstream creation notes. Convert to game-friendly GeoJSON/TopoJSON only as a clearly labeled derived asset.
- **Priority:** **P0 pack-level source.** Clean rights, compact coverage, immediate utility.

### Tier 2 — high value, specialized adapter or manual curation

#### National Gallery of Art, Washington

- **Game value:** paintings, drawings, prints, ornament, material studies, historical clothing, landscapes, and public-domain reference.
- **Scale and access:** more than 60,000 downloadable open-access images; daily UTF-8 CSV data for more than 130,000 artworks and artists. The dataset links to media but does not bundle the images ([Free Images and Open Access](https://www.nga.gov/artworks/free-images-and-open-access)). NGA has also placed tens of thousands of high-resolution images on Wikimedia Commons and collection data in Wikidata ([Wikimedia program](https://www.nga.gov/national-gallery-art-wikimedia-commons-and-wikidata)).
- **Rights boundary:** use only images made available under NGA Open Access. Those digital images are released under CC0; unavailable images must not be inferred open from the age of the object ([Terms and Notices](https://www.nga.gov/terms-and-notices)).
- **Caveats:** no endorsement or logo use; the Gallery conveys only the rights it holds and offers no warranty against other claims.
- **Ingestion:** daily metadata snapshot, object-level open-access check, then image link. Wikimedia can be a transport mirror, but NGA remains the canonical provenance.
- **Priority:** **P1.** Excellent reference art, less game-ready than existing pack sources.

#### The Metropolitan Museum of Art

- **Game value:** broad historical art, armor, weapons, furniture, instruments, clothing, architecture fragments, sculpture, and surface-detail reference.
- **Scale and access:** JSON API exposes hundreds of thousands of object IDs, object metadata, original and web-sized JPEG URLs, additional images, and `isPublicDomain` ([Collection API](https://metmuseum.github.io/)).
- **Rights boundary:** require `isPublicDomain === true` and a nonempty image on the current object response. Do not infer image rights from department, date, or search results.
- **Caveats:** primarily reference imagery rather than game-ready files; human depictions, sacred/funerary material, cultural patrimony, and marks need review.
- **Ingestion:** search narrowly by useful object types, fetch at the published request rate, preserve object ID and accession data, and cap per-run requests. Prefer web-size preview URLs and link to originals.
- **Priority:** **P1 curated.** Huge breadth; quality requires aggressive selection.

#### Getty Open Content Program

- **Game value:** more than paintings—antiquities, sculptures, decorative arts, manuscripts, maps, early photographs, architectural records, and texture/reference material.
- **Scale and access:** over 160,000 open-content images, including roughly 86,000 Museum and 78,000 Research Institute images. Downloadable images are high resolution and multiple sizes may be offered ([program overview](https://www.getty.edu/projects/open-content-program/)).
- **Rights boundary:** accept only a record with the CC0/public-domain icon or Getty's explicit Open Content download statement. Getty says works are public domain in the United States and waives its digital-image copyright to the extent it owns it ([FAQ](https://www.getty.edu/projects/open-content-program/faqs/)).
- **Caveats:** third parties may assert trademark, copyright, privacy, or publicity rights. Some records are withheld for those reasons. Do not imply Getty endorsement.
- **Ingestion:** initially manual or through Getty's linked-data services after confirming stable documentation. Store the exact rights indicator and object URL; never treat a visible website image as Open Content without the marker.
- **Priority:** **P1.** High quality and breadth; automation needs endpoint validation.

#### Rijksmuseum

- **Game value:** paintings, prints, ship models, armor, furniture, ceramics, textiles, maps, and ornamental design.
- **Scale and access:** data services report metadata for about 800,000 objects and high-resolution photographs for about 600,000, available through APIs and downloads ([Data Services](https://data.rijksmuseum.nl/)).
- **Rights boundary:** object information and images can be Public Domain/CC0, CC BY, copyrighted, or unavailable. The record's copyright notice is authoritative; only PDM/CC0 items enter a CC0/public-domain lane ([information policy](https://data.rijksmuseum.nl/policy/)).
- **Caveats:** some works are unavailable because of copyright, preservation, or research. PDM states lack of copyright rather than a license grant; preserve the exact URI and jurisdictional meaning.
- **Ingestion:** query/download metadata, require the item media's PDM or CC0 marker, and keep CC BY assets outside this catalog unless a future attributed-assets lane is intentionally added.
- **Priority:** **P1.** Large, excellent image source with good rights signaling.

#### Walters Art Museum

- **Game value:** manuscripts, armor, jewelry, ceramics, ancient objects, sculpture, and decorative patterns.
- **Scale and access:** open digital images and metadata of collection objects; availability should be measured during importer prototyping.
- **Rights boundary:** Walters applies CC0 to digital images and metadata of works it believes are public domain, allowing unrestricted reuse ([rights policy](https://thewalters.org/about/policies/rights-reproductions/)).
- **Caveats:** accept only records with the qualifying public-domain/CC0 status; apply sensitivity review to sacred, funerary, and culturally specific objects.
- **Ingestion:** start with a small manually verified object-type collection, then assess whether its data endpoint is stable enough for automation.
- **Priority:** **P1/P2.** Strong content fit; access mechanics need proof.

#### Paris Musées

- **Game value:** fashion, posters, photographs, paintings, decorative arts, architecture, and Paris historical reference.
- **Scale and access:** the collection portal reports more than 400,000 works and a similarly large pool of public-domain images marked `CC0 Paris Musées` ([collections portal](https://www.parismuseescollections.paris.fr/en)).
- **Rights boundary:** only images explicitly bearing the CC0 Open Content designation qualify; collection visibility does not imply open rights.
- **Caveats:** French metadata and multi-museum field variation will complicate normalization; identifiable people and third-party marks remain relevant.
- **Ingestion:** prototype a single museum/type and retain the exact CC0 label, institution, inventory number, and object page. Do not crawl until robots/access rules and stable record delivery are confirmed.
- **Priority:** **P2.** Large opportunity, but less mature machine-access evidence than the P0 sources.

#### USDA Agricultural Research Service photo archive

- **Game value:** plants, insects, crops, soil, lab equipment, animals, farming, and ecological reference useful for textures, cards, educational games, and concept art.
- **Scale and access:** official topic/photo pages; the featured archive states its images are free of charge, copyright-free public-domain images ([ARS Featured Photo Archive](https://www.ars.usda.gov/oc/images/photos/photos-featured-photo/)).
- **Rights boundary:** accept only ARS pages carrying that public-domain photo policy and a federal/ARS credit. Do not generalize the statement to all USDA-hosted imagery; the USDA PLANTS help, for example, says individual image use can depend on its Usage field ([PLANTS help](https://plants.usda.gov/assets/docs/PLANTS_Help_Document.pdf)).
- **Caveats:** people, branded machinery, labels, and externally credited photos require quarantine.
- **Ingestion:** manual curated sets first; preserve photographer/byline and the specific page's usage statement.
- **Priority:** **P2.** Useful nature reference, weak bulk interface.

### Tier 3 — specialized geospatial pipelines

#### USGS 3D Elevation Program and The National Map

- **Game value:** authoritative U.S. terrain, DEMs, contours, orthoimagery, and point clouds for terrain generation and real-place simulations.
- **Scale and access:** nationwide U.S./territory coverage through The National Map Downloader. Standard elevation products use GeoTIFF; lidar point clouds use LAS/LAZ ([elevation formats FAQ](https://www.usgs.gov/faqs/what-types-elevation-datasets-are-available-what-formats-do-they-come-and-where-can-i-download)).
- **Rights boundary:** USGS-authored or produced data is U.S. public domain, but not every photograph, illustration, or hosted dataset is USGS-authored. Third-party content is normally credited/copyright-marked ([copyright policy](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits)).
- **Caveats:** enormous files, coordinate systems, datums, voids, inconsistent resolutions, and source-provider metadata. People in USGS media can have publicity rights. The USGS identifier is trademarked.
- **Ingestion:** never represent arbitrary areas as individual assets. Catalog named 3DEP products or curated game-ready terrain derivatives with bounding box, CRS, datum, resolution, acquisition year, source agency, transformation recipe, and both source and derived hashes. Quarantine records whose producer is not USGS until their own rights are verified.
- **Priority:** **P1 specialized pack/derivative pipeline**, after ordinary assets.

#### NOAA Digital Coast

- **Game value:** coastal lidar, bathymetry-adjacent terrain, elevation models, contours, land cover, and imagery for islands, coastlines, flood worlds, and realistic environments.
- **Scale and access:** thousands of datasets; custom geographic downloads and bulk LAZ, DEM, and contour products. The lidar archive also exposes streamable EPT tiles and browser Potree views ([elevation archive](https://coast.noaa.gov/htdata/lidar1_z/index.html), [Data Access Viewer](https://coast.noaa.gov/digitalcoast/tools/dav.html)).
- **Rights boundary:** NOAA-created government media is generally public domain, but Digital Coast aggregates multiple providers. Each dataset's provider and rights metadata must be checked; NOAA's own copyright guidance says third-party content can carry separate restrictions ([NOAA copyright guidance](https://sos.noaa.gov/copyright/)).
- **Caveats:** mixed contributors, very large downloads, changing services, coordinate transformations, varying accuracy, and scientific fitness limitations.
- **Ingestion:** use only datasets whose producer/rights evidence is explicitly reusable. Prefer metadata-only catalog entries pointing to custom download tools, then publish small derived terrain packs after provenance review. Preserve provider, accuracy, datum, projection, date, geographic bounds, and processing steps.
- **Priority:** **P2 specialized.** Valuable but operationally and legally more variable than USGS-only products.

### Discovery-only or quarantine-first sources

#### Europeana

Europeana is a discovery aggregator, not a collection-wide rights grant. It supports 14 rights statements, including in-copyright and restricted categories. Only PDM, CC0, CC BY, and CC BY-SA are classified as freely reusable, and a RightsStatements.org label communicates status rather than granting a license ([rights FAQ](https://leuven2012.europeana.eu/page/rights-statements-faq)). For this CC0/public-domain catalog, accept only exact `edm:rights` values for CC0 or PDM, then confirm the provider's item and media records. Keep `NoC-NC`, `NoC-OKLR`, “unknown,” and every in-copyright URI out. Europeana is **P2 discovery**, never direct trust.

#### Library of Congress

The Library's curated Free to Use and Reuse sets cover photographs, maps, posters, films, scores, sound recordings, and other useful material, but the portal groups together public domain, no-known-copyright, and owner-cleared content ([Free to Use and Reuse](https://www.loc.gov/free-to-use/)). The Library generally does not own collection copyrights and directs users to each item's Rights and Access or Rights Advisory; its records can be incomplete, and privacy/publicity rights remain the user's responsibility ([copyright guide](https://www.loc.gov/legal/understanding-copyright/)). Import only items with an explicit `public domain`/CC0 item statement and an unambiguous downloadable-media credit. Treat “no known restrictions” and merely being in a curated set as **manual-review**, not verified CC0.

#### New York Public Library Digital Collections

NYPL offers nearly 500,000 items described as public domain/no known U.S. copyright restrictions, high-resolution derivatives, and CC0 metadata. However, this status is U.S.-specific and may not resolve privacy/publicity or other jurisdictions. More importantly, its Repository API is scheduled for deprecation on 2026-08-01 with no planned replacement, and its API terms restrict API use to noncommercial purposes unless contacted ([API documentation](https://api.repo.nypl.org/), [collection rights](https://digitalcollections.nypl.org/about)). Use the public-domain bulk metadata export for offline discovery if its current terms permit the intended operation; otherwise wait for the post-deprecation access direction. **P3/hold for automation.**

#### Biodiversity Heritage Library

BHL provides an API and CC0 metadata, making it excellent for discovering botanical and zoological illustrations. The CC0 grant described by its developer documentation applies to metadata, not automatically to every digitized page ([developer tools](https://about.biodiversitylibrary.org/tools-and-services/developer-and-data-tools/)). Require the item/page rights field to be explicit public domain or CC0, plus a media URL whose reuse terms match. **P2 discovery; P3 ingestion.**

#### GBIF

GBIF is valuable for species names, geography, and observation/media discovery, not as a ready-made art library. Datasets use one of CC0, CC BY, or CC BY-NC, and license information travels with records/downloads ([terms](https://www.gbif.org/pt/terms), [download fields](https://techdocs.gbif.org/en/data-use/download-formats)). Filter explicitly to CC0 and then verify each associated media object's creator, identifier, and rights because an occurrence license is not necessarily a photo license. Sensitive-species coordinates may be generalized or restricted and must never be “recovered.” **P2 metadata enrichment; quarantine all media until separately verified.**

## Sources not suitable for a CC0-only ingestion lane

These may be useful to users as external discovery links, but should not enter this catalog without a separately designed attributed/restricted-license lane:

- **British Museum:** its typical image terms are not a collection-wide CC0 dedication.
- **CyArk and Open Heritage 3D:** valuable photogrammetry, but projects and downloads can carry attribution, noncommercial, registration, or project-specific terms.
- **Sketchfab:** licenses vary per model; search filters and uploader claims do not replace item-level provenance review.
- **Internet Archive and Wikimedia Commons:** host and aggregate material under many licenses. They are possible transport mirrors, not authoritative proof unless the originating institution and exact rights statement are retained.
- **Freesound, xeno-canto, Macaulay Library, and museum sound archives:** potentially excellent audio, but licenses are creator/item-specific and frequently require attribution or prohibit commercial reuse. Ingest only exact CC0 items through a future audio adapter.
- **OpenTopography and academic scan repositories:** data access may be open while the dataset license is CC BY, CC BY-NC, custom, or absent. Treat every dataset as its own provider.

## Cultural sensitivity and non-copyright quarantine

Legal reusability is necessary but not sufficient. Public-domain cultural heritage can depict or encode sacred, ceremonial, funerary, violent, exploitative, or community-restricted material. The Smithsonian says culturally sensitive objects may remain outside Open Access and asks users to preserve dignity and respect; the Library of Congress recognizes that some Indigenous knowledge was never intended for sharing outside its community ([Smithsonian values](https://www.si.edu/openaccess/values), [Library of Congress Indigenous materials policy](https://www.loc.gov/acq/devpol/materialsindigenouspeoples.pdf)). Local Contexts TK and Biocultural Labels provide community-specific protocols that should travel with records when present ([Local Contexts labels](https://localcontexts.org/labels/about-the-labels/)).

Automatically quarantine when titles, descriptions, classifications, or provider flags indicate:

- human remains, burials, grave goods, funerary practice, or ancestor imagery;
- sacred, secret, ceremonial, medicine, ritual, initiation, or restricted knowledge;
- Indigenous/community-specific material without contextual and community-use metadata;
- identifiable living or recently deceased people;
- nudity involving minors, medical records, personal correspondence, or other sensitive personal data;
- graphic violence, exploitation, racist caricature, or dehumanizing historical description;
- prominent logos, institutional seals, product trade dress, or named personalities;
- endangered-species locations or precise archaeological/site coordinates.

Quarantine means the record is invisible to ordinary search and absent from downloadable JSON until a human records a reasoned decision. It is not a “content warning” that automatically permits publication.

## Ingestion and verification design

### Candidate states

1. **Discovered** — provider and stable ID recorded; not public.
2. **Rights parsed** — exact metadata, work, and media rights fields captured; not public.
3. **Quarantined** — ambiguous rights, non-copyright concern, or missing provenance; not public.
4. **Sample reviewed** — adapter behavior checked against at least 25 diverse records and every rights branch.
5. **Catalog eligible** — explicit CC0/PDM or verified government-work basis, stable source/media links, and clear non-copyright review.
6. **Install verified** — optional later stage after download, format inspection, safety scan, and conversion testing.

### Hard publication gates

A crawler may publish a candidate only when all of these are true:

- provider and upstream object IDs are stable;
- canonical object page and primary rights-evidence URL are present;
- exact rights value is allowlisted, not inferred from age or institution;
- media creator/provider and media rights are present;
- preview rights are no weaker than the cataloged media rights;
- no restriction, third-party copyright, or sensitivity flag is present;
- required provenance and suggested credit are preserved even when attribution is not legally required;
- source revision/date and crawl date are recorded;
- duplicate canonical URL, accession number, and perceptual duplicate checks pass.

For U.S. government sources, also require a federal-employee/agency authorship signal or source-specific public-domain declaration. A `.gov` hostname is not evidence: agencies host contractor, partner, licensed, and user-submitted work.

### Bandwidth-safe media policy

- Crawl metadata first and cache responses with conditional requests.
- Use official bulk dumps instead of paginating APIs when offered.
- Do not mirror full-resolution TIFF, LAS/LAZ, OBJ, or research archives during discovery.
- Generate catalog previews from provider-recommended derivatives or locally cache only after the provider permits it.
- Rate-limit per provider; honor documented limits such as the Art Institute's single-thread/one-request-per-second guidance.
- Download original files only for selected high-demand assets entering install verification.
- Store hashes only after a file is intentionally downloaded; absence of a hash must never appear as a failed rights check.

### Adapter tests

Every source adapter should include fixtures for:

- one accepted CC0/PDM item;
- one copyrighted or noncommercial item;
- one record with CC0 metadata but restricted media;
- one third-party credited government-hosted item;
- one missing or changed rights field;
- one culturally sensitive or privacy-related record;
- one missing preview and one changed upstream URL;
- duplicate object/media IDs;
- deterministic output from the same input snapshot.

The CI contract should fail closed when a provider adds a new rights URI, changes a field type, removes a media credit, or changes the meaning of an allowlisted flag. A scheduled update creates a reviewable report: added, removed, rights-changed, media-changed, quarantined, and publishable counts. It must never automatically broaden the allowlist.

## Recommended acquisition sequence

| Phase | Deliverable | Why now | Exit evidence |
| --- | --- | --- | --- |
| 1 | Smithsonian 3D importer, 100–300 reviewed records | Best combination of game-ready formats and explicit CC0 | All published media carries live CC0 evidence; sensitivity quarantine sampled |
| 1 | NASA 3D curated importer | High game utility and finite scope | Contributor and logo/person quarantine proven; formats inventoried |
| 1 | Natural Earth release packs | Immediate maps with clean terms | Versioned packs, formats, scale, bounds/dispute notes recorded |
| 2 | Art Institute + Cleveland 2D importers | Strong APIs and rights fields | Public-domain flag and media link contracts tested against bulk/live data |
| 2 | NGA + Met curated thematic sets | High-quality art/object reference | Object-level rights checks and selection rubric produce useful, nonduplicative sets |
| 3 | Getty + Rijksmuseum + Walters + Paris Musées | Broaden cultural imagery | Stable access method and exact item rights mapping demonstrated |
| 3 | USGS terrain pilot | Adds a new game-asset direction | One bounded terrain derivative is reproducible from source + recipe + CRS |
| 4 | NOAA coastal pilot | Valuable mixed-provider geodata | Provider-specific rights survive the entire transformation pipeline |
| 4 | LOC/BHL/GBIF discovery indexes | Find niche imagery without rights overclaim | Discovery results remain quarantined until media-level checks pass |

## What “quality” means for these archives

Institutional authority is not game readiness. Rank candidates on:

- usable resolution or model topology;
- common formats or a documented deterministic conversion path;
- complete textures/materials and sensible coordinate/scale metadata;
- clean crop/background and preview legibility;
- source permanence and reproducible retrieval;
- distinct utility versus near-duplicate paintings or scans;
- historical/scientific context sufficient to use the asset responsibly;
- absence of unresolved legal, cultural, privacy, publicity, or trademark risk.

The catalog should tag institutional assets as `reference`, `texture-source`, `terrain-source`, `scan`, `map-data`, `audio-source`, or `game-ready`. Do not label a museum JPEG or raw lidar tile “game-ready” merely because it is downloadable.

## Bottom line

The opportunity is substantial: Smithsonian supplies CC0 3D scans, NASA supplies practical space models and textures, major museums supply hundreds of thousands of reusable images, and USGS/NOAA/Natural Earth supply real-world terrain and map inputs. The safe strategy is not a universal museum crawler. It is a set of small, fail-closed adapters whose allowlists encode the exact object- and media-level rights signals each institution publishes.

The first milestone should optimize for proof, not raw count: several hundred unusually useful Smithsonian/NASA models, Natural Earth packs, and selected Art Institute/Cleveland images with complete provenance will improve the catalog more than tens of thousands of weakly classified archive thumbnails.
