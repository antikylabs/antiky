# General thoughts and feedback on project right now.

1. User face docs feel stale? We have a game object/host in framework but no framework api for it.
2. scripts folder feels overloaded. Why are we building public dmeos and artifacts at a repo level? Should that be a concern of the website's build process? Nothing else uses that!
3. theres some api reference stuff in scripts... but they don't work and are not useful cause now we have drift in framework and no user facing docs to support it.
4. We have docs/adr/UNDER_REVIEW_A.md... is it stale? Have things been addressed in it already? Is it missing opportunities not yet addressed? Have we done something in our cli, framework, studio, etc that should be an ADR but isn't recorded and thus should go into UNDER_REVIEW?
5. can we have cli be able to launch studio for a project if ran in folder or targeting .antiky file?
6. We don't need billions of .png / .jpeg / .jpg files and snapshots as outcomes of work. We actually probably don't need the outputs/verfication folders of planning slices to even be in git repo.
7. Where we at now with antiky-town, we've done a lot of work around it but not on it. Maybe what we have done completely changes slices, direction, etc?


# Agent Answers below here

## 1. User-facing Framework documentation

Yes. The documentation has a real coverage gap.

The Framework package has two public entry points: `@antiky/framework` and
`@antiky/framework/game`. The generated API reference reads only
[`packages/framework/src/index.ts`](../../packages/framework/src/index.ts). It does not read the
package export map. As a result, the reference covers the root entry but omits all 12 public game
host symbols, including `GameHostContext`, `GameInstance`, `GameModuleEntry`, and
`createGameInspectionSnapshot`.

The hand-written [game module guide](../user-facing-docs/framework/game-modules.md) explains the
workflow and uses some of these types. That guide does not replace an exact API reference. The
current [Framework API reference](../user-facing-docs/api/reference.md) must not claim complete
package coverage while it omits a public entry point.

The fix should do these things:

- Make the generator read every public entry in `packages/framework/package.json`.
- Add a generated game host API area and page.
- Test that every exported package entry and every symbol from each entry has documentation.
- Keep the task guide for normal use and the generated page for exact signatures.

## 2. Repository-level demo and artifact scripts

Yes. Website demo orchestration belongs to the website while it has only one product consumer.

[`build-public-demos.mjs`](../../scripts/build-public-demos.mjs) and
[`stage-demo-artifacts.mjs`](../../scripts/stage-demo-artifacts.mjs) exist for the website build and
its tests. They should live under `packages/website/scripts/`.

[`build-demo-artifact.mjs`](../../scripts/build-demo-artifact.mjs) is also called by each demo
package. That does not make it a shared product capability. It means each supposedly standalone
demo still reaches outside its project for repository tooling. Today, only website publication
uses the resulting `antiky-artifact.json` contract.

Until Antiky accepts a general shipped-game artifact contract, the clean ownership is:

- A demo builds its own shaders and browser module inside its project.
- The website builds selected demos and creates, verifies, and stages its publication artifacts.
- Website publication tests stay with the website.
- Root scripts contain only tools that genuinely serve more than one workspace.

If the artifact becomes a CLI or release product later, its builder should move to that product
boundary. It should not return to an unowned root script.

## 3. Framework API-reference tooling

The generator works mechanically, but its contract is incomplete. `npm run docs:api:check` passes
and currently verifies seven generated pages and 176 root-entry symbols. It cannot detect the
missing game API because it never enumerates the package export map.

The source fingerprint includes Framework source outside the root entry. This can force a
regeneration after a game-host change, but the regenerated output still omits the game-host API.
That is activity without coverage.

Framework should own this tooling, preferably under `packages/framework/scripts/`. The Framework
test should generate or check every public entry. The website should publish already-verified
documentation instead of repairing source drift as a side effect of `next build`.

This is the same root problem as answer 1: the reference must derive its scope from the public
package contract, not from one hard-coded source file.

## 4. ADR review state

[`UNDER_REVIEW_A.md`](../adr/UNDER_REVIEW_A.md) is stale. Most of its text dates from August 4, and
its last material update was August 5. The project accepted major CLI, Studio, project, game-host,
and demo-delivery decisions after that review.

The current candidates need this audit:

| Candidate | Current result |
| --- | --- |
| 2. Runtime schema | Keep, but rewrite. Antiky now exposes several versioned schemas and validators. The proposed first proof already exists, while a general schema catalog remains undecided. |
| 3. ECS storage and queries | Keep. No implementation or accepted ADR selects this yet. |
| 4. 2.3D depth policy | Keep. The current Town renderer is evidence, not a shared policy. |
| 5. Studio process and connection | Remove as resolved. CLI ADRs 0002 and 0003 plus Studio ADR 0006 select the local service owner and connection model. |
| 6. Principals and permissions | Keep, but rewrite. Point-light commands prove one trusted-context path. Antiky still has no general principal or grant model. |
| 7. Sandbox isolation | Narrow it. Framework ADR 0014 decides how approved changes return to the primary world. Clone construction, resource sharing, and process isolation remain open. |
| 8 through 12 | Keep. Parts have prototypes or related ADRs, but the durable store, online runtime, voxel boundary, and feedback governance decisions remain open. Candidate 11 still controls any future general asset work. |
| 14 and 15 | Keep. Game-host ownership constrains presentation and extensions but does not decide either contract. |
| 16. Shipped-game artifact | Rewrite immediately. The repository has now completed the proposed browser-artifact proof. The open decision is whether that manifest is a durable Antiky product contract or website-private publication data. |

Two missing subjects deserve review candidates:

- Studio terminal ownership. Studio now embeds Ghostty through native macOS code. The accepted ADRs
  mention an integrated terminal but do not decide native terminal ownership, portability, process
  boundaries, or the cross-platform fallback.
- External analytics and presence. The website loads Fathom and SSPS, and Studio can load SSPS.
  The network, privacy, opt-out, failure, retention, and third-party ownership rules are not in an
  accepted ADR.

Not every recent change needs an ADR. Git LFS patterns, objective-output retention, generated-doc
placement, and the rule that repository demos are self-contained are repository policies. Keep
those in focused documentation and executable checks. Framework ADR 0020 already records the
important product decision for game modules and game hosts.

## 5. Launch Studio from the CLI

Yes. Add `antiky studio [--project path]`.

Without `--project`, it should use the existing current-directory rule: exactly one `.antiky` file
must exist. With `--project`, it should validate and canonicalize that manifest through the same
project loader used by `antiky dev`.

The CLI should then ask the operating system to open the manifest with the installed Antiky Studio
application. The first implementation can support the currently shipped macOS application and
return a stable error when Studio is missing or the platform is unsupported.

The command must not start development services or keep a supervising CLI process alive. Studio
receives the project-open event and remains responsible for starting the shared project service.
That behavior follows Studio ADR 0006 instead of creating a second startup path.

This is a normal feature under the existing project and Studio decisions. It does not need another
ADR.

## 6. Planning outputs, verification, and images

Agreed. The repository currently tracks 140 files under objective `outputs/` folders. Those files
use about 11 MB and include 42 PNG or JPEG captures. It also tracks two files under a
`verification/` folder even though the workflow says verification is temporary.

Git LFS keeps image bytes out of normal Git objects, but it does not make repeated run captures
useful source history.

The planning workflow should change as follows:

- Ignore slice `verification/` directories and delete them after a run.
- Keep run outputs in CI artifacts or another disposable evidence location, not in Git.
- Keep one short `slice-summary.md` when durable closeout context is useful.
- Put the commit, commands, pass or fail results, and essential measurements in that summary.
- Keep an image in Git only when it is a maintained product asset or an intentional visual
  reference. Do not keep routine before, after, retry, or terminal captures.
- Remove the existing tracked run outputs and completed verification files in a separate cleanup
  change after the retention rule is updated.

If a release needs durable audit evidence, keep one compact receipt or an external artifact link.
Do not keep complete logs and screenshot sets for every planning attempt.

## 7. Antiky Town status and direction

The work since Slice 02 changed the development platform substantially, but it did not advance the
Town game by the same amount.

What is real now:

- Antiky Town is a self-contained project at
  [`packages/demos/antiky-town`](../../packages/demos/antiky-town).
- Its game module runs in CLI, Studio, website, and test hosts.
- It uses `EngineSession`, point-light inspection, the Town renderer, shaders, physics, and assets.
- Town Study is a separate self-contained project with its own copy of the necessary Town code.
- No Nexus dependency or Nexus and BroMetal integration exists yet.
- No Framework asset registry or compiled Town asset contract exists yet.

The active Town planning is not current:

- The [Town objective index](antiky-town/README.md) points to an old package path and still tells the
  reader to start Slice 02, which is complete.
- The [implementation plan](antiky-town/IMPLEMENTATION_PLAN_A.md) treats `brometal-town` as a
  separate reference module that no longer exists in that form.
- Slice 03 contains an old CPU plan plus an addendum that rejects it. Its owner input is still
  pending, and the required Nexus integration research and prototype do not exist.
- Slice 04 says not to duplicate the Town builder. That directly conflicts with the accepted
  direction that each demo is standalone.
- Slices 05 and later depend on those stale assumptions, so their order is not reliable.

Do not run Slice 03 or Slice 04 as written. Keep Slices 00 through 02 as completed history, then
reset the active roadmap from the current projects and accepted ADRs.

The next Town slice should produce a visible game result. The current owner direction makes the
smallest honest next result a qualified Nexus and BroMetal path that moves the playable hero and
preserves approved collision behavior without per-step CPU readback. Keep that work private to
Antiky Town until the real integration proves a reusable Framework boundary.

After that slice, select the next player-visible Town feature. Extract a Framework service only
when that feature or a second game proves the boundary. Keep website delivery, Studio polish,
documentation infrastructure, and evidence cleanup out of the Town gameplay roadmap.
