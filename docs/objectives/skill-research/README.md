# Game-development skill-library research

Research snapshot: 2026-08-09

This directory evaluates public agent skills, engine-control integrations, production workflows,
and specialist-agent team structures for building an internal game-development skill library.
It is research, not an installation manifest. No skill, MCP server, editor plugin, engine, or DCC
extension was installed while producing these reports.

## Decision summary

The public ecosystem contains useful parts, but no package found should be adopted wholesale.
The strongest direction is a layered library with:

1. small, portable workflow skills;
2. authoritative, version-pinned engine knowledge;
3. narrow adapters for privileged editor and runtime control;
4. project-specific product and art direction;
5. independent verification, playtest, performance, privacy, and release gates.

Five findings recur across every research track:

- A `SKILL.md` knowledge package and a live editor bridge solve different problems. Treating them
  as interchangeable hides both capability gaps and security risk.
- Engine APIs can create valid objects without creating a good game. The library must put game
  design, art direction, game feel, UX, sound, playtesting, and producer-controlled scope on equal
  footing with implementation.
- One agent should own a live editor or shared binary asset at a time. Parallel agents can research,
  design, write isolated source, review, and prepare bounded change packets.
- A screenshot is evidence that a frame rendered, not proof of polish. Approval needs deterministic
  captures, motion, runtime state, performance evidence, a declared visual target, and independent
  judgment.
- Editor bridges, DCC scripting, logs, captures, and crash reports are privileged data surfaces.
  Default to local and read-only, deny arbitrary execution and outbound data, checkpoint changes,
  and never capture unrelated desktop, terminal, username, path, or account information.

## Engine direction

| Engine | Recommended baseline | Candidate extension or pilot | Principal constraint |
| --- | --- | --- | --- |
| Unreal Engine 5.8 | Epic's native experimental MCP, Toolset Registry, official skills, Automation/UAT | VibeUE at a reviewed commit for deeper editor domains | MCP tools run serially on the game thread; no authentication on the local endpoint |
| Unity | Unity Technologies skills and official experimental CLI/Pipeline | Official Unity MCP or Coplay; evaluate focused playtest and technical-art tooling separately | Domain reloads and serialized assets make broad or concurrent mutation brittle |
| Godot | Official CLI/headless/editor APIs plus version-pinned knowledge | Pilot Godot MCP Toolkit or Godot AI; consider Satellite for read-only runtime QA | Most bridges are young; text-native assets still require real editor/runtime validation |
| Antiky/BroMetal | Project-owned adapter and evidence contracts | Reuse cross-engine compiler, asset, capture, and production patterns | Do not inherit another engine's object model or tool surface by accident |

## Report map

| Report | What it answers |
| --- | --- |
| [Public registry inventory](registry-inventory.md) | What `find-skills` and skills.sh surface, which results are promising, and where the registry is weak or polluted |
| [Unreal and VibeUE](unreal-vibeue.md) | Epic's native UE 5.8 MCP, VibeUE, source-grounded Unreal skills, security, serialized editor operation, and an Unreal team pattern |
| [Unity](unity.md) | First-party Unity skills and CLI, MCP/editor bridges, tests/builds, Shader Graph/assets, safety, and a Unity team pattern |
| [Godot](godot.md) | Native automation, public skills, MCP/editor bridges, GUT/GdUnit4, shaders/assets, exports, and Godot team patterns |
| [Rendering, shaders, and materials](rendering-shaders-materials.md) | Shader languages and validators, engine materials/VFX, textures, compression, color, GPU capture, visual QA, and technical-art roles |
| [Art and content pipeline](art-content-pipeline.md) | Concept and art direction, 2D/3D DCC workflows, animation, audio, provenance, visual review, and content-specialist roles |
| [Game design and player experience](game-design-ux.md) | Core loops, mechanics, level design, game feel, UI/UX, accessibility, playtesting, telemetry, and design-agent boundaries |
| [Production and QA](production-qa.md) | Producer, QA, performance, build/release, localization, certification, privacy, playtests, community feedback, and live operations |
| [Orchestration and library design](orchestration-and-library-design.md) | Skill format, routing, artifact contracts, concurrency, permissions, subagent setup, eval design, and library maintenance |
| [Recommended library](recommended-library.md) | Cross-report synthesis, proposed internal taxonomy, first skills, evaluation harness, adoption decisions, and roadmap |

## Evidence standard

Reports distinguish among verified primary-source facts, publisher or maintainer claims, and our
inferences. Install counts, stars, and advertised tool counts are discovery signals rather than
quality proof. Fast-moving claims are dated, and adoption requires a fresh source, version, license,
and security review.

The default candidate policy is:

1. inspect source and every referenced script or asset;
2. pin a tag or commit and record its license and dependencies;
3. install only in a disposable project with no secrets or private assets;
4. begin read-only and verify the exact project, engine, editor, and connection;
5. run the same representative vertical-slice benchmark repeatedly;
6. compare with a no-skill baseline and inspect transcripts, diffs, captures, and failures;
7. promote only the narrow capabilities that improve quality without unacceptable authority or
   fragility.

## What this research does not claim

- Repository popularity does not establish production readiness.
- A project's own tests or demo do not provide independent validation.
- Passing compilation, a successful export, or a generated screenshot does not establish fun,
  readability, originality, artistic coherence, accessibility, or release quality.
- Recorded install commands are reproducibility notes, not recommendations to execute them.
- No external skill or bridge has yet passed an Antiky-owned benchmark.

The next step is to implement the minimum library and evaluation harness described in
[recommended-library.md](recommended-library.md), then run isolated pilots before selecting any
editor bridge for real project work.
