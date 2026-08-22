# Research line F - Rights, provenance, and contribution lifecycle

_As of 2026-08-12. This is engineering research, not legal advice. “Established” describes source evidence; “Proposed” and “Inference” are implementation recommendations._

## Decisive conclusions

- **Established:** Rights must be evaluated per component and per action. Metadata indexing, remote preview display, preview mirroring, code redistribution, adaptation, and notice fulfillment are not interchangeable permissions.
- **Established:** A repository’s root license does not reliably cover every example asset, dependency, media file, or imported fragment. Three.js, Bevy, MaterialX, Godot, and Godot Shaders all demonstrate mixed-rights repositories.
- **Established:** A public GitHub repository grants platform users permission to view and fork through GitHub; broader reuse depends on an actual license. Unlicensed public content remains under default copyright. GitHub license detection is informational rather than proof. [GitHub Terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service), [Licensing a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
- **Proposed:** The catalog should deny redistribution by default. Missing, conflicting, private, or stale rights evidence should produce `NOASSERTION`/quarantine, never an inferred permissive license.
- **Proposed:** Generated descriptions need their own provenance record. A generated or rewritten description neither clears the underlying shader nor changes its license.

## Rights-action matrix

| Action | Established constraint | Proposed admission rule |
|---|---|---|
| Metadata indexing | In US copyright guidance, facts are not protected, while expressive descriptions and creative selection or arrangement can be. Platform terms and non-US database rights remain separate. [US Copyright Office](https://www.copyright.gov/what-is-copyright/) | Index minimal normalized facts, identifiers, hashes, and source links. Do not copy upstream prose unless its license permits that use. |
| Remote preview/link/embed | A public URL is not itself a content license. Display, hotlinking, privacy, branding, and platform terms are separate questions. | Permit only where item terms or direct permission support the delivery method. Record whether the preview is linked, embedded, or merely referenced. |
| Preview mirroring | Storing and serving an upstream image/video involves copying and redistribution independently of shader-source rights. Godot Shaders expressly excludes images, screenshots, videos, and other media from its per-shader code licenses. [License](https://godotshaders.com/license/), [FAQ](https://godotshaders.com/faq/) | Require media-specific evidence. Prefer an Antiky-rendered preview when the shader license permits execution/adaptation, and record that it is a new capture rather than upstream media. |
| Code mirroring/redistribution | Redistribution depends on the exact item license and normally carries notice obligations. MIT requires preservation of its copyright and permission notice; Apache-2.0 additionally requires modification marking and preservation of applicable notices. [Three.js r185 MIT](https://github.com/mrdoob/three.js/blob/r185/LICENSE), [MaterialX Apache-2.0](https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/LICENSE) | Admit only an immutable source revision with declared and concluded licenses, evidence, notices, and dependency review. |
| Adaptation/porting | Translation between GLSL/WGSL/framework APIs does not erase upstream rights. The derivation chain and modification history remain material. W3C’s software/document license also requires its notice and identification of modifications. [W3C license](https://www.w3.org/copyright/software-license-2023/) | Record every upstream input, relationship, hash, transformation, and compatibility conclusion. Do not treat “inspired by” as a substitute for an accurate derivation record. |
| Notices and attribution | Notices can apply per file, asset, dependency, or upstream NOTICE bundle. CC BY additionally requires attribution, a license link, and change indication; ShareAlike and NonCommercial add further conditions. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) | Generate a distributable notice bundle from structured records, but retain the source evidence and original notice text. |
| Generated descriptions | US Copyright Office guidance says AI assistance does not disqualify human-authored expression, but prompts alone generally do not establish authorship of generated expression. This does not decide contracts, training-data rights, or non-US treatment. [Copyrightability Report, Part 2](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf) | Store generation inputs and activity separately from artifact rights. Require factual citations, human review, and near-copy screening. |

## External ecosystem constraints

- **BroMetal - established local evidence:** The installed `brometal` 0.17.2 package declares MIT and publishes `examples/`. However, `examples/shaders/water-evolve.shader.ts`, `water-fft.shader.ts`, and `waterpro-probe-velocity.shader.ts` identify Three.js Water Pro material as “used with permission.” No visible evidence establishes the grant’s scope, sublicensing, adaptation, or MIT-relicensing terms.
  **Proposed:** Quarantine these Water Pro-derived examples until the permission grant is reviewed. Do not infer that the package’s root MIT license cures this ambiguity. [BroMetal repository](https://github.com/ericdrowell/brometal)

- **Three.js r185 - established:** Root code is MIT, but example assets can carry separate licenses. The Damaged Helmet example records a Creative Commons Attribution-NonCommercial source and modification/re-export history. The contribution guide separately requires proper licenses for assets added to examples. [MIT license](https://github.com/mrdoob/three.js/blob/r185/LICENSE), [Damaged Helmet provenance](https://github.com/mrdoob/three.js/blob/r185/examples/models/gltf/DamagedHelmet/README.md), [Contribution guide](https://github.com/mrdoob/three.js/blob/r185/.github/CONTRIBUTING.md)

- **Bevy - established:** Code is generally MIT OR Apache-2.0, while example assets use mixed licenses documented in `CREDITS.md`, including CC0, CC BY, OFL, and other terms. Contributions default to the repository’s dual license unless stated otherwise. Bevy also requires AI-use disclosure and human responsibility, and prohibits AI-generated public prose/media. [Repository and license policy](https://github.com/bevyengine/bevy), [Asset credits](https://github.com/bevyengine/bevy/blob/main/CREDITS.md), [AI contribution policy](https://bevy.org/learn/contribute/policies/ai/)

- **MaterialX - established:** Apache-2.0 provides clear redistribution and contribution defaults, while `THIRD-PARTY.md` separately records bundled third-party sources. Contributions use EasyCLA, with corporate handling where employers own the work. [License](https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/LICENSE), [Third-party manifest](https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/THIRD-PARTY.md), [Contribution policy](https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/CONTRIBUTING.md)

- **Godot - established:** Engine, documentation, class-reference, demo, and third-party rights are not one license surface. Godot’s contribution rules require disclosure of copied, third-party, or AI-assisted material and compatible source licenses. [License compliance](https://docs.godotengine.org/en/stable/about/complying_with_licenses.html), [Documentation repository](https://github.com/godotengine/godot-docs), [Demo repository](https://github.com/godotengine/godot-demo-projects), [Contribution guidelines](https://contributing.godotengine.org/en/latest/pull_requests/pull_request_guidelines.html)

- **Godot Shaders - established:** Shader code is licensed per post as CC0, MIT, or GPLv3; accompanying media is outside that code license. The site’s contributor attestation is useful evidence but does not replace per-item verification. [License](https://godotshaders.com/license/), [FAQ](https://godotshaders.com/faq/)

- **Shadertoy - claimed, not established:** Secondary material commonly describes a CC BY-NC-SA default, but the current official terms page was inaccessible during this research.
  **Proposed:** Treat Shadertoy as discovery-only until current official terms and each item’s license are captured. Do not mirror code or previews based on the secondary claim. [Official terms URL](https://www.shadertoy.com/terms)

## Proposed provenance model

The present catalog schema should be extended from artifact-level source information to component-level rights and derivation.

```text
identity
  artifactId, artifactClass
  publisher, repositoryUrl, sourceUrl
  upstreamRevision, sourcePath, retrievedAt
  sourceHash, evidenceSnapshotHash

rights[]                         # one record per component and action
  component: metadata | description | source | generated-output |
             preview | media | dependency | sample-asset
  actions: index | display-remote | mirror | redistribute | adapt
  licenseDeclared
  licenseConcluded              # SPDX expression or NOASSERTION
  conclusionExplanation
  evidenceUrl, evidenceRevision, evidenceHash, evidenceRetrievedAt
  copyrightNotices[], attributionText, noticeFiles[]
  requiresChangeNotice, shareAlike, nonCommercial
  patentGrant, trademarkGrant
  permissionGrantRef, permissionScope, permissionExpiry, sublicensingScope
  status: verified | noassertion | conflict | permission-required
  reviewer, reviewedAt

derivation[]
  sourceArtifactId, sourceUrl, sourceRevision, sourceHash
  relation: adapted | ported | transliterated | generated-from |
            quoted-from | inspired-by | reference-only
  transformation, contributor, humanReview

descriptionProvenance
  kind: upstream-verbatim | human-authored | machine-generated |
        machine-assisted | deterministic-extracted
  inputs[]
  modelProvider, modelId, modelVersion
  providerTermsEvidence
  promptTemplateId, promptTemplateHash
  pipelineVersion, generatedAt, outputHash
  factualEvidence[], similarityCheck
  humanEditor, reviewStatus
  supersedes, invalidatedBy

previewProvenance
  origin: upstream | contributor | antiky-rendered
  sourceArtifactRevision
  renderer, runtime, browser, GPU, captureRecipe
  outputHash, rightsBasis, hostingPermission

lifecycle
  ingestionLane
  discoveredAt, admittedAt, lastRightsRefresh
  state: discovered | quarantined | reviewed | admitted |
         deprecated | corrected | takedown
  decisionReasons[], history[]
```

This follows the useful distinctions in [SPDX declared versus concluded licensing](https://spdx.github.io/spdx-spec/v3.0.1/model/Licensing/Licensing/) and [W3C PROV-O’s entity/activity/agent and derivation model](https://www.w3.org/TR/prov-o/).

## Proposed ingestion lanes

1. **Discovery/reference-only:** URL, identifier, title, and minimal factual metadata; no copied prose, code, or media.
2. **Factual metadata index:** Normalized facts with citations and retrieval evidence.
3. **Remote preview:** Link/embed only when the rights and platform terms support that exact use.
4. **Mirrored or Antiky-rendered preview:** Separate media rights review; record whether upstream media or a new render was used.
5. **Permissive code redistribution:** Exact-version MIT/BSD/Apache/W3C-style code with complete notices and dependency review.
6. **Reciprocal or restricted material:** CC BY, ShareAlike, GPL, NonCommercial, or otherwise conditional items in a separate delivery surface pending compatibility and product-policy decisions.
7. **Direct permission:** Securely retain the grant reference and exact scope. Incomplete grants remain quarantined.
8. **Antiky-origin contribution:** Contributor rights attestation, third-party manifest, inbound-license agreement, AI disclosure, human review, and render/test evidence.
9. **Generated descriptions:** Authorized inputs, traceable factual claims, reproducible activity metadata, human review, and similarity screening.
10. **Quarantine:** Missing/conflicting evidence, unclear media rights, unknown revision, stale terms, or permission that does not expressly cover the intended action.

## Proposed contribution lifecycle

`discover → immutable capture → component rights classification → automated evidence/notice checks → human rights review → technical/render review → admit → periodic refresh → correction/takedown`

Each contribution should attest that the contributor owns or may submit the material, identify employer or third-party interests, enumerate dependencies/assets, disclose AI assistance and source inputs, and accept the chosen inbound license. Prior records should remain immutable when a correction or takedown supersedes them.

## Decisions requiring owner or legal judgment

1. **BroMetal Water Pro material:** Whether the private permission permits publication, sublicense, adaptation, and MIT/npm redistribution.
2. **Catalog policy:** Whether distributable libraries are commercial-compatible and permissive-only, and whether GPL, ShareAlike, or NonCommercial material may appear in isolated or discovery-only lanes.
3. **Contribution mechanism:** GitHub’s inbound-equals-outbound default, a Developer Certificate of Origin, or a CLA; also employee authorization and AI-use rules.
4. **Generated descriptions:** Their outbound license, database terms, model-provider terms, retention settings, and desired human-authorship posture.
5. **Copyleft boundaries:** Whether shader ports, generated WGSL, compiled artifacts, previews, and runtime linking trigger reciprocal obligations.
6. **Access and previews:** GitHub/API crawling scope, rate-limit compliance, hotlinking, privacy/referrer behavior, trademarks, and whether rendered previews count as licensed adaptations in each source.
7. **Jurisdiction:** Database rights, moral rights, patents, trademarks, publicity/privacy, and takedown obligations outside the US.

## Explicit gaps

- Current authoritative Shadertoy terms and per-item license behavior were not retrievable.
- The private permission underlying BroMetal’s Water Pro-derived examples is unavailable.
- BroMetal exposes no clear contribution policy in the reviewed repository/package evidence.
- Final source repositories and versions from the library comparison have not yet been selected; every admitted item still needs an item-level audit.
- No model/provider, API terms, retention configuration, or prompt policy has been selected for generated descriptions.
- Antiky has not yet chosen the catalog/database/description outbound license or contribution agreement.
- Preview rights cannot be generalized from code licenses.
- Bulk metadata/database-rights analysis outside the US remains open.
- A correction, challenge, and takedown service-level policy remains undefined.
