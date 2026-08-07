# General thoughts and feedback on project right now.

1. User face docs feel stale? We have a game object/host in framework but no framework api for it.
2. scripts folder feels overloaded. Why are we building public dmeos and artifacts at a repo level? Should that be a concern of the website's build process? Nothing else uses that!
3. theres some api reference stuff in scripts... but they don't work and are not useful cause now we have drift in framework and no user facing docs to support it.
4. We have docs/adr/UNDER_REVIEW_A.md... is it stale? Have things been addressed in it already? Is it missing opportunities not yet addressed? Have we done something in our cli, framework, studio, etc that should be an ADR but isn't recorded and thus should go into UNDER_REVIEW?
5. can we have cli be able to launch studio for a project if ran in folder or targeting .antiky file?
6. We don't need billions of .png / .jpeg / .jpg files and snapshots as outcomes of work. We actually probably don't need the outputs/verfication folders of planning slices to even be in git repo.
7. Where we at now with antiky-town, we've done a lot of work around it but not on it. Maybe what we have done completely changes slices, direction, etc?


# Agent Answers below here

Status: resolved on 2026-08-07.

## 1. User-facing Framework documentation

The generated Framework reference now derives its scope from every public package entry. It
documents the game-host API as well as the root API. The generator rejects an undocumented entry,
symbol, description, or generated page.

- [Framework API reference](../user-facing-docs/api/reference.md)
- [Game-host API](../user-facing-docs/api/game-host.md)
- [Framework-owned generator](../../packages/framework/scripts/generate-api-reference.mjs)

The task-oriented game-module guide remains separate from the exact generated signatures.

## 2. Demo publication and artifact ownership

Website-only demo tooling now belongs to the website package:

- [build-public-demos.mjs](../../packages/website/scripts/build-public-demos.mjs)
- [build-demo-artifact.mjs](../../packages/website/scripts/build-demo-artifact.mjs)
- [stage-demo-artifacts.mjs](../../packages/website/scripts/stage-demo-artifacts.mjs)

Each demo owns its game code, shader build, and browser-module build. A demo does not implement a
development host. The CLI or Studio mounts the compiled game module in the host owned by `antiky
dev`. The website builds and mounts selected demo modules in its own host.

The website artifact manifest remains private website publication data. It must not become a shared
Antiky contract until another product needs that contract. The root package no longer aggregates
demo shader commands.

## 3. Framework API-reference tooling

The Framework package owns reference generation and verification. Its check derives coverage from
the Framework export map and fails when generated documentation is stale.

The website prebuild runs the Framework check. It does not regenerate the reference or repair drift
as a side effect. The website only publishes the verified canonical documents.

## 4. ADR review state

[ADRs under review](../adr/UNDER_REVIEW_A.md) now separates open candidates from resolved
candidates and records the latest review date. It also includes the missing Studio-terminal and
external analytics/presence subjects.

The project accepted these related Framework decisions:

- [Select physics authority and execution independently](../adr/framework/0018-select-physics-authority-and-execution-independently_H.md)
- [Use Rapier for CPU physics and Nexus for GPU physics](../adr/framework/0019-use-rapier-for-cpu-physics-and-nexus-for-gpu-physics_H.md)
- [Keep game code and game hosts in different modules](../adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md)

An ADR must contain its own context and decision. It can refer to another ADR, but it must not use
an objective, goal, feedback record, or implementation plan as authority. The ADR guide and scoped
ADR instructions own this rule. Reviewers must evaluate the meaning of a record. A grep script
cannot prove that an ADR is self-sufficient or conforms to ASD-STE100.

## 5. Launch Studio from the CLI

The CLI now supports `antiky studio [--project path]`.

Without `--project`, the command requires exactly one `.antiky` file in the current directory. With
`--project`, it uses the explicit manifest. The command validates and canonicalizes the project
through the shared loader, then asks macOS to open it with Antiky Studio.

The command does not start development services or retain a supervisor process. Studio receives the
project and starts the shared project service.

## 6. Planning evidence and images

Objective `outputs/` and `verification/` directories are ignored and are no longer tracked. The
workflow keeps durable results in a short `slice-summary.md`: the commit, commands, pass/fail result,
essential measurements, and any documentation or ADR effect.

Run logs and captures belong in local or CI evidence. Existing evidence remains recoverable from Git
history, and ignored local copies can remain on a developer machine.

PNG, JPEG, and JPG files use Git LFS. Maintained product assets and intentional visual references can
stay in the repository. Routine run captures cannot.

## 7. Antiky Town direction

Slices 00 through 02 are complete history. The previous Slice 03 and Slice 04 plans are superseded
because they predate the current standalone demo and game-host architecture.

The [Town roadmap](antiky-town/slice-list.md) is the one current sequence. The next slice must first
qualify a real Nexus and BroMetal path. It must then move the playable hero with approved collision
behavior and no per-step CPU readback. The work stays private to Antiky Town until evidence proves a
reusable Framework boundary.

Later work is an unordered player-visible backlog. A new slice is selected only when its player
result, architecture, prerequisites, and verification are ready.

## 8. Prevent these regressions

Use automation only when it can prove a real invariant.

| Invariant | Protection |
| --- | --- |
| Every Framework package export has API documentation | Export-map-derived Framework generator tests |
| A demo is a standalone game module | Demo import, dependency, build, and host-boundary tests |
| Website publication tooling stays with its owner | Website artifact and publication tests |
| Root scripts and commands have cross-workspace ownership | Repository policy checks |
| Run evidence is not committed | Ignore rules and a tracked-file policy check |
| PNG, JPEG, and JPG content uses Git LFS | Attributes plus `git lfs fsck --pointers` |
| CLI and Studio share project-service behavior | CLI, Studio, and native integration tests |

Do not create tests that freeze documentation wording, an exact generated symbol count, heading
text, roadmap prose, or the archive location of old plans. Those tests create maintenance work but
do not prove product behavior.

Use these controls for judgment and documentation quality:

- Put architecture decisions in self-contained ADRs.
- Put repository and writing rules in the nearest scoped `AGENTS.md` or maintained standard.
- Keep one canonical active roadmap and archive superseded plans clearly.
- Validate local links after documentation moves.
- Require human review for ADR meaning, ASD-STE100 usage, copy quality, visual balance, hierarchy,
  spacing, and tone.

A code change needs a focused regression test at the narrowest behavior or dependency boundary. A
documentation-only correction does not justify a synthetic test. It needs correct links, the right
authoritative source, and human review.
