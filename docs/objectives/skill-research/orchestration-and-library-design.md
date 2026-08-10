# Game-creation orchestration and skill-library design

Research snapshot: 2026-08-09

This report proposes how Antiky should organize agents, skills, editor controls, evidence, and approvals for game creation across Unreal Engine, Unity, Godot, rendering, art, design, QA, and production. It does **not** recommend installing any third-party skill pack as-is.

## Reading guide

- **Verified fact** means the claim is stated in a primary specification, official product documentation, or the linked source repository and was checked for this report.
- **Observed signal** is a time-sensitive registry or repository measurement captured on 2026-08-09. It is useful for discovery, not proof of quality.
- **Recommendation** is an Antiky design decision inferred from the evidence.
- **Candidate** means “audit or mine for patterns,” not “install.”

The principal recommendation is a small, staged production cell with one artifact owner and one live-editor writer at a time. A normal milestone should use three to five active roles, not a permanently running simulated studio. Every handoff should be an artifact contract, and every playable change should pass a deterministic runtime replay plus an independent visual/gameplay review. Compilation is necessary evidence; it is not evidence that the game is good.

## Executive recommendation

Build the system as three layers:

1. A **production and review layer** owns the brief, acceptance criteria, task graph, risk, evidence, and final approvals. It normally has no editor-mutation capability.
2. A **discipline layer** owns game design, gameplay, technical art, shaders, assets, animation, audio, UX, performance, and QA outputs. A discipline role receives explicit inputs and owns named output paths.
3. An **engine-adapter layer** translates approved work into one specific engine/version through a pinned CLI, plugin, or MCP adapter. Only one role holds the live-editor mutation lease for a project at a time.

Use a stage-gated loop:

```text
brief -> design contract -> implementation -> deterministic replay
      -> technical checks -> runtime capture -> independent reviews
      -> human milestone approval
```

A failed gate returns a structured defect to the artifact owner. It does not invite every role to edit the same project. The implementation/review loop should have a small retry limit, after which the producer escalates the decision rather than hiding churn.

The first library release should be intentionally small:

- one producer/orchestrator skill;
- one engine-context skill;
- one game-design contract skill;
- one implementation skill per supported engine;
- one deterministic runtime-verification skill;
- one independent visual/game-feel review skill;
- one artifact-ingest/provenance skill;
- one release-readiness skill.

Add specialized shaders, materials, animation, audio, level design, and genre skills only after the core handoff and evidence system works.

## Research method

The registry was searched with the installed `find-skills` workflow, without installing results:

```bash
npx skills find "unreal engine"
npx skills find "vibeUE"
npx skills find "unreal material shader"
npx skills find "unity game engine"
npx skills find "unity shader"
npx skills find "godot game engine"
npx skills find "godot shader"
npx skills find "shader materials"
npx skills find "texture generation"
npx skills find "game design gameplay"
npx skills find "level design"
npx skills find "gameplay testing game feel"
npx skills find "game development production"
npx skills find "game producer"
npx skills find "game art blender"
npx skills find "game audio"
npx skills find "technical art"
npx skills find "animation rigging"
```

Repository metadata and current default-branch revisions were inspected through the GitHub API. Specifications and operational constraints were checked against the primary sources linked below. Search results were treated as leads, then cross-checked against source repositories and official engine documentation.

Two search outcomes are important:

- `level design` returned mostly irrelevant web-design results, and `game producer` returned no useful result. Registry discovery is not a dependable taxonomy.
- `kevinpbuckley/vibeue@vibeue` showed only one registry install while its source repository showed roughly 587 GitHub stars and active recent work. Install counts are not comparable trust scores.

## Verified foundations

### The Agent Skills standard

**Verified facts:** The [Agent Skills specification](https://agentskills.io/specification) defines a skill as a directory containing at least `SKILL.md`. A skill may also contain `scripts/`, `references/`, and `assets/`. The required frontmatter fields are `name` and `description`; optional standard fields include `license`, `compatibility`, `metadata`, and the experimental `allowed-tools`. Names are lowercase, hyphenated identifiers that must match their directory. The description should explain both what the skill does and when to use it.

The specification recommends progressive disclosure: clients discover compact metadata first, load the full instructions on activation, and access referenced resources only as needed. It recommends keeping `SKILL.md` below 500 lines and references one level deep. A standards-conforming package can be validated with:

```bash
skills-ref validate ./path/to/skill
```

**Verified facts:** The standard's [client integration guidance](https://agentskills.io/client-implementation/adding-skills-support) treats project skills as an instruction supply chain. It recommends a trust gate for project-provided skills, deterministic handling of name collisions, visibility rules for disabled/inaccessible skills, protected activated-skill content during compaction, and de-duplicated activation. `.agents/skills` is a cross-client discovery convention, but the core specification does not mandate a discovery location.

**Recommendation:** Antiky should publish simple, portable Agent Skills packages, while keeping richer lifecycle, dependency, provenance, risk, and evaluation data in a separate signed catalog and lockfile. Do not overload `SKILL.md` with a private package-manager format.

### Codex skill and subagent behavior

**Verified facts:** The official [Codex skills documentation](https://learn.chatgpt.com/docs/build-skills) implements the open skill format. Codex scans project and user scopes, supports optional `agents/openai.yaml` metadata, and can declare invocation policy and MCP dependencies there. A skill may set `allow_implicit_invocation: false`, which is useful for risky operations. Codex recommends a single job per skill, explicit inputs and outputs, and trigger-prompt testing. It can shorten or omit catalog entries when a large skill catalog exceeds the initial context budget, so merely placing hundreds of skills in discovery scope is not reliable routing.

**Verified facts:** The official [Codex subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents) says subagents are useful for independent parallel work and reducing context pollution. Built-in roles include `explorer`, `worker`, and `default`. Custom project agents can be defined in `.codex/agents/` with a name, description, developer instructions, tool configuration, and sandbox settings. Official examples use narrow read-only explorers/reviewers and a targeted implementation owner.

**Recommendation:** Review roles should be read-only by configuration, not merely told “do not edit.” A mutation role should own a narrowly named set of paths and only the connector required by its assigned engine.

### Claude as a useful cross-client comparison

**Verified facts:** The official Claude Code documentation for [subagents](https://code.claude.com/docs/en/sub-agents), [skills](https://code.claude.com/docs/en/skills), and [agent teams](https://code.claude.com/docs/en/agent-teams) describes separate agent contexts, scoped tools/permissions, optional worktree isolation, hook gates, and skills preloaded into particular roles. Agent teams are experimental, add coordination/token overhead, do not automatically inherit all lead context, and are best for genuinely independent tasks. The docs explicitly warn about same-file conflicts and document limitations around team resumption, status lag, shutdown, and nesting.

**Recommendation:** Treat a “49-agent game studio” as a reference catalog of potential responsibilities, not a runtime organization chart. Instantiate only the roles needed for the current stage.

## Engine and tool landscape

### Unreal Engine

**Verified facts:** Unreal Engine 5.8 includes an experimental [native MCP server](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor). It exposes actors, lighting, material instances, Slate, and automation through focused toolsets. The API and data formats may change. The endpoint is loopback by default and has no authentication, so Epic says it is not designed for remote access. Tool calls execute serially on the game thread, and clients should not issue overlapping calls. The default endpoint is `127.0.0.1:8000/mcp`. Its compact discovery surface uses `list_toolsets`, `describe_toolset`, and `call_tool`.

**Verified facts:** Unreal's [Python editor scripting](https://dev.epicgames.com/documentation/unreal-engine/scripting-the-unreal-editor-using-python) is editor automation, not runtime gameplay code. It supports full-editor execution and a faster commandlet mode. `unreal.ScopedEditorTransaction` can make supported operations undoable, but not all actions are undoable; imports are a documented example. Python runs synchronously and can block the editor UI. The [Python automation testing guide](https://dev.epicgames.com/documentation/unreal-engine/write-editor-tests-with-python-in-unreal-engine) and [Automation Test Framework](https://dev.epicgames.com/documentation/unreal-engine/automation-test-framework-in-unreal-engine) support feature tests, latent actions, screenshots, and screenshot comparison.

Example commandlet invocation:

```bash
/path/to/UnrealEditor-Cmd /path/to/Game.uproject \
  -run=pythonscript -script=/absolute/path/to/script.py
```

**Candidate:** [VibeUE](https://github.com/kevinpbuckley/VibeUE) now extends Unreal 5.8's native MCP toolset and Agent Skill registries. Its live surface is discoverable instead of a static catalog. Its repository was MIT licensed, at revision `24ac69d750c1...`, with about 587 stars and 127 forks when checked. Its current architecture differs from its earlier standalone form, which is direct evidence that engine and adapter compatibility must be pinned and revalidated.

**Candidate:** [quodsoler/unreal-engine-skills](https://github.com/quodsoler/unreal-engine-skills) contains 27 Unreal-focused skills covering C++, gameplay, UI, editor tools, materials/rendering, Niagara, project context, and testing/debugging. It reports a source-level API audit and many corrected inaccuracies. When checked, it was MIT licensed with about 305 stars but only one repository commit. It is a useful audit checklist, not sufficient provenance for wholesale installation.

**Recommendation:** Use Unreal's native MCP as the base for 5.8 projects and evaluate VibeUE by explicit domain. Pin `engine version + project plugin version + adapter commit + skill revision`. Use one editor-writer lease, because Unreal explicitly serializes MCP calls on the game thread. Prefer commandlets for nonvisual validation and the full editor only when a scene, viewport, or editor-only subsystem is required.

### Unity

**Verified facts:** Unity's current [command-line arguments documentation](https://docs.unity3d.com/Manual/EditorCommandLineArguments.html) documents `-batchmode`, `-executeMethod`, `-projectPath`, and `-logFile`. Only one Unity instance can open the same project in batch mode. `-nographics` prevents initialization of a graphics device, which makes it unsuitable for some graphics operations; automated input also depends on window focus. Unity warns that combining `-quit` with `-runTests` can exit before tests complete.

**Verified facts:** The [Unity Test Framework CLI](https://docs.unity3d.com/Packages/com.unity.test-framework@1.3/manual/reference-command-line.html) can emit NUnit XML. The documentation does not define one universal exit-code contract for all components, so orchestration must inspect results and logs, not only the process exit code.

Example test invocation:

```bash
/path/to/Unity \
  -batchmode \
  -projectPath /absolute/path/to/Project \
  -runTests \
  -testPlatform editmode \
  -testResults /absolute/path/to/results.xml \
  -logFile /absolute/path/to/unity.log
```

Do not automatically append `-quit` to this test command.

**Candidate:** [CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp) provides focused operations for assets, scenes, scripts, tests, profiling, and builds. When checked, its repository had about 13,279 stars, 1,406 forks, an MIT license, and defaulted to a `beta` branch at revision `c21bf496bca8...`. Its own documentation recommends pinning a release tag such as `#v10.0.0` instead of following the moving branch.

**Candidate:** `cryptorabea/claude_unity_dev_plugin@unity-architecture` appeared with 135 registry installs, but [its source repository](https://github.com/CryptoRabea/Claude_Unity_dev_plugin) had about three stars and one commit when checked. Its architecture/review topics may still be useful, but the signal is too weak for adoption without a deep content and engine-API audit.

**Recommendation:** Run Unity tests and imports in an isolated project copy or worktree and capture the XML plus full log. Keep visual tests separate from `-nographics`. Treat the live MCP project as a single-writer resource, and pin both the Unity editor and adapter release.

### Godot

**Verified facts:** Godot's [command-line tutorial](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html) supports `--headless`, `--script`, `--check-only`, `--import`, `--export-release`, `--fixed-fps`, and benchmark output. Headless mode uses dummy display/audio drivers and is appropriate for CI and export. The engine's internal `--test` option is available only in an engine build compiled with tests enabled.

**Verified facts:** Godot's [version-control guidance](https://docs.godotengine.org/en/stable/tutorials/best_practices/version_control_systems.html) notes that project files are generally text/merge friendly, recommends ignoring `.godot/`, and recommends Git LFS for large textures, audio, and 3D assets.

Example deterministic/headless operations:

```bash
godot --headless --path /absolute/path/to/project --import
godot --headless --path /absolute/path/to/project \
  --script res://tests/run_suite.gd
godot --headless --path /absolute/path/to/project \
  --fixed-fps 60 --benchmark-file /absolute/path/to/benchmark.json
```

**Candidate:** [hi-godot/godot-ai](https://github.com/hi-godot/godot-ai) provides a live Godot 4.5+ editor integration, hierarchy and scene operations, and test tooling. Its source documents a loopback default; broader `--allow-host` exposure should be replaced by SSH or a private tunnel on untrusted networks. When checked, it was MIT licensed with about 1,500 stars and 95 forks.

**Candidate:** [HKUDS/CLI-Anything](https://github.com/HKUDS/CLI-Anything) contains a Godot harness that invokes Godot 4.x headlessly and reports a focused test suite. The larger repository was Apache-2.0 licensed with about 46,816 stars and 4,359 forks when checked. Its conservative subprocess pattern is useful where a live editor is unnecessary.

**Recommendation:** Godot is the strongest first target for the orchestration/evaluation harness because its scene/script formats are inspectable and its headless/replay controls are straightforward. That is a recommendation about testability, not a claim that Godot is the final flagship engine.

### Rendering, shaders, assets, and Blender

**Verified facts:** [glslang](https://github.com/KhronosGroup/glslang) is Khronos's reference GLSL/ESSL frontend and SPIR-V generator with a command-line tool. Its current README says the HLSL frontend was deprecated in April 2026. [SPIRV-Tools](https://github.com/KhronosGroup/SPIRV-Tools) provides assembly, optimization, and validation for SPIR-V. The [glTF source repository](https://github.com/KhronosGroup/glTF) provides the format specification and validation ecosystem.

**Candidate:** [MCPBlender/blender-mcp](https://github.com/MCPBlender/blender-mcp) offers object, material, scene, and viewport control and can execute arbitrary Python inside Blender. Its own documentation says to save work before use. It may also use external asset and AI-generation providers. When checked, it was MIT licensed with about 25,686 stars and 2,449 forks.

**Recommendation:** Treat Blender automation and arbitrary editor scripting as high-risk capabilities. Run them in an asset-staging file, never the sole production `.blend`; disable unneeded remote providers and telemetry; copy accepted outputs into the repository; and attach source URL, license, author, transformation history, content hash, and generation model/provider details to every imported asset.

**Recommendation:** Shader work requires three different gates:

1. source compile/validation for the relevant target;
2. runtime execution on a supported renderer/device class;
3. visual comparison in representative lighting, motion, camera distance, and performance conditions.

A shader that compiles but is pink, aliased, temporally unstable, illegible in motion, or outside budget is not accepted.

## Ecosystem discovery snapshot

The following entries were visible in `npx skills find` on 2026-08-09. Registry install counts are discovery signals only.

| Area | Registry result | Observed installs | Use in research | Main caution |
|---|---|---:|---|---|
| Unreal | `sickn33/antigravity-awesome-skills@unreal-engine-cpp-pro` | 1.2K | C++ topic map | Aggregated pack; provenance and engine-version audit required |
| Unreal | `quodsoler/unreal-engine-skills@ue-ui-umg-slate` | 772 | UI discipline boundary | Source repository has a very short history |
| Unreal | `quodsoler/unreal-engine-skills@ue-editor-tools` | 737 | Editor tool topics | Verify every API against pinned engine source/docs |
| Unreal | `kevinpbuckley/vibeue@vibeue` | 1 | Current native-MCP extension | Registry count badly understates repository activity |
| Unity | `gamedev-skills/awesome-gamedev-agent-skills@router` | 1K | Cross-engine routing pattern | Router may obscure exactly which instructions run |
| Unity | `rm-yndharis/antigravity-skills@unity-developer` | 2.7K | Topic discovery | Aggregated pack; high count is not a security review |
| Unity | `josiahsiegel/claude-plugin-marketplace@unity-shaders-rendering` | 101 | Shader topic outline | Check render-pipeline/version scope |
| Godot | `gamedev-skills/awesome-gamedev-agent-skills@godot-shaders` | 925 | Godot shader checklist | Audit against target Godot renderer/version |
| Godot | `hkuds/cli-anything@cli-anything-godot` | 406 | Headless CLI pattern | Part of a broad framework, not an Antiky contract |
| Design | `gamedev-skills/awesome-gamedev-agent-skills@game-feel` | 1.5K | Review vocabulary | Must be paired with observable replay evidence |
| Design | `opusgamelabs/game-creator@design-game` | 828 | Brief/design artifact ideas | Product-specific workflow assumptions |
| Art | `jasonjgardner/blockbench-mcp-project@blockbench-texturing` | 662 | Texturing task boundary | External editor and generated-asset provenance |
| Art | `drawcall-ai/skills@materials` | 116 | Material task outline | Validate engine/render-pipeline support |
| Audio | `gamedev-skills/awesome-gamedev-agent-skills@audio-design` | 1.1K | Audio artifact vocabulary | Rights, loudness, looping, and in-game mix still need gates |
| Animation | `omer-metin/skills-for-antigravity@rigging-animation` | 112 | Discipline outline | Rig/retarget compatibility requires fixture evaluation |
| Production | `donchitos/claude-code-game-studios@asset-spec` | 235 | Asset specification format | Avoid importing its full studio hierarchy |

Two larger source catalogs are especially useful as maps:

- [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) contained 67 version-pinned skills spanning engines and cross-engine disciplines when checked. Its router and category structure are useful references. The repository was Apache-2.0 licensed at revision `858c3e58e1f3...`, with about 455 stars.
- [Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) exposed 49 agents and 73 skills with director/lead/specialist layers. It was MIT licensed at revision `984023dd...`, with about 23,724 stars. Its artifact checklists may be valuable, but its always-available hierarchy is not the recommended runtime shape.

## Why runtime and visual evidence are mandatory

**Verified facts:** [GameDevBench](https://github.com/waynchi/gamedevbench) evaluates 333 Godot tasks. Its current results show that visual feedback materially improved one reported GPT-5.4 configuration, from 41.1% to 52.0%, while the best reported method was still 63.7%. Graphics-heavy tasks were harder than straightforward gameplay tasks.

**Verified facts:** [GameCraft-Bench](https://github.com/FreedomIntelligence/gamecraft-bench) evaluates 140 tasks across 15 families using complete Godot projects, replayable input traces, recorded gameplay evidence, hidden rubrics, and multimodal judging. Its [project page](https://tongxuluo.github.io/gamecraft-bench-website/) emphasizes engine grounding, complete artifacts, and interactive verification. The paper reports that agents often produce recognizable mechanics while struggling with content, functional visual feedback, and coherent presentation.

**Candidate pattern:** [PlayableIntelligence/game-creator](https://github.com/PlayableIntelligence/game-creator) checks build/runtime state, replays gameplay actions, captures visual evidence, and uses deterministic time advancement plus a text rendering of game state. It is specific to web game stacks and has product/deployment assumptions, but its “observable state + deterministic time + replay + screenshot” contract is highly reusable.

**Recommendation:** Every Antiky engine adapter should expose equivalents of:

- `inspect_game_state()` or an engine-specific structured state dump;
- `set_seed(seed)`;
- `advance_time(frames_or_seconds)` under a fixed timestep;
- `replay_input(trace)`;
- `capture_viewport(frame, camera, resolution)`;
- `collect_runtime_errors()`;
- `collect_performance_sample()`.

The verifier must launch the project and exercise the acceptance path. A successful build with no replay is an incomplete gate.

## Recommended production cell

### Runtime shape

Do not activate all roles. Compose a cell around the milestone:

| Stage | Typical active roles | Maximum mutation owners |
|---|---|---:|
| Brief and prototype selection | Producer, game designer, art director | 0 |
| Greybox implementation | Producer, engine worker, QA verifier | 1 |
| Gameplay refinement | Game designer, gameplay engineer/engine worker, game-feel reviewer, QA | 1 |
| Visual target | Art director, technical artist/engine worker, performance reviewer | 1 editor writer plus one isolated asset-staging writer |
| Content integration | Producer, engine worker, asset/audio specialist, QA | 1 live project writer |
| Release candidate | Producer, QA, performance/release reviewer, human approver | 0 unless a defect is returned |

Parallelism belongs primarily in read-only research, alternate concept work, independent reviews, and isolated asset staging. It does not belong in concurrent live-editor mutation.

### Role contracts

| Role | Required inputs | Owned outputs | Write capability | Must not do |
|---|---|---|---|---|
| Producer/orchestrator | Product objective, milestone state, risks | Task graph, handoff envelopes, milestone status | Planning artifacts only | Change game/editor assets or approve its own implementation |
| Game designer | Brief, player/audience constraints, references | Mechanics spec, rules, tuning ranges, success/failure states | Design docs and data tables | Invent engine APIs or silently broaden scope |
| Art director | Brief, references with rights, platform constraints | Art-direction board/spec, visual rubric, shot list | Review/art-direction artifacts | Perform final review of art it directly generated |
| UX/accessibility reviewer | Controls, UI flows, supported devices | Input/focus/accessibility checklist and defects | Review artifacts only | Rewrite implementation |
| Engine-context analyst | Project, engine/plugin manifests, source state | `engine-context.json`, capability and compatibility report | Context artifact only | Mutate project or guess an unavailable API |
| Gameplay/engine worker | Approved design, engine context, owned paths | Project changes, change manifest, implementation notes | Assigned project paths; one editor lease | Edit outside ownership or self-approve |
| Technical artist | Art direction, renderer/device budget, assets | Materials, shaders, VFX, LOD/import settings, validation results | Isolated asset paths or editor lease | Pull unlicensed assets or bypass budget |
| Asset/animation/audio specialist | Asset spec and target formats | Source and exported assets, provenance entries | Asset staging only | Write directly into live project without ingest gate |
| QA automation | Build, trace, acceptance criteria | Machine-readable test/replay/perf report | Evidence output directory only | Fix code or change acceptance criteria |
| Visual/game-feel reviewer | Runtime build, traces, rubric, captures | Structured independent review | Review artifacts only | Inspect the expected answer or implementation rationale before judging |
| Release reviewer | All gate reports, manifests, licenses | Release-readiness decision | Release report only | Waive a failed gate without named human approval |

### Explicit role boundaries

**Recommendation:** Separate “author,” “integrator,” and “approver,” even when one person or model performs them at different times. The context must be reset or narrowed between roles.

- A designer defines behavior and acceptance, but does not write engine code in the same handoff.
- An asset specialist produces in staging; the engine worker imports into the live project.
- QA records observed results and defects; it never fixes the game.
- A visual reviewer receives the brief, rubric, build, trace, and capture, but not the author's hidden rationale or an expected score.
- The producer can sequence work and reject incomplete evidence, but cannot declare visual/gameplay quality on behalf of the reviewer or human owner.

This separation limits self-confirming evaluations and makes failures attributable to a contract instead of a vague “studio” persona.

## Artifact contracts

The repository should use stable artifact types instead of chat prose as the source of truth.

| Artifact | Owner | Required contents | Consumed by |
|---|---|---|---|
| `game-brief.yaml` | Producer + human | player, fantasy, pillars, non-goals, platform, milestone, references | All roles |
| `vertical-slice.md` | Producer | slice boundary, expected playtime, entry/exit, acceptance, excluded systems | Designer, worker, QA |
| `mechanics/<id>.yaml` | Game designer | states, rules, inputs, feedback, tuning ranges, edge cases, test scenarios | Worker, QA, game-feel review |
| `art-direction.md` | Art director + human | shape, palette, light, motion, material, typography, reference provenance, “avoid” examples | Art/technical art/reviewer |
| `engine-context.json` | Context analyst | engine/editor version, renderer, plugins, adapter pins, project layout, known constraints | Every implementation role |
| `handoffs/<task>.json` | Producer | task envelope shown below | Assigned role and reviewers |
| `asset-manifest.json` | Asset specialist/integrator | source, license, author, generator/model, transforms, hashes, target path | Integrator, release review |
| `change-manifest.json` | Mutation owner | before/after revisions, files/assets changed, editor operations, migrations, rollback | QA, reviewers, producer |
| `replays/<scenario>.json` | QA/designer | seed, fixed timestep, initial state, input trace, checkpoints, expected observations | Runtime verifier |
| `capture-plan.json` | Art director/QA | viewport only, resolution, frame/time, camera, states, privacy crop, codec/quality | Capture worker/reviewer |
| `qa/<build>.json` | QA | commands, environment, results, logs, replay outcomes, crash/runtime errors | Producer, release review |
| `visual-reviews/<build>.md` | Independent reviewer | rubric scores, timestamped evidence, defects, severity, decision | Producer, artifact owner |
| `performance-budget.yaml` | Producer/tech lead | frame time, memory, asset, shader, load, package budgets by target | Worker, performance review |
| `milestone-status.yaml` | Producer | gate state, evidence links, exceptions, approver | All roles |

### Handoff envelope

Every delegated task should carry a machine-readable envelope similar to:

```json
{
  "schema": "antiky.handoff/v1",
  "task_id": "movement-014",
  "role": "godot-engine-worker",
  "objective": "Implement the approved dash mechanic",
  "engine": {"name": "godot", "version": "4.5.3"},
  "adapter": {
    "name": "antiky-godot-cli",
    "version": "0.2.0",
    "source_revision": "<full-commit-sha>"
  },
  "skills": [
    {"id": "godot-gameplay-change", "version": "0.4.1", "sha256": "<hash>"}
  ],
  "inputs": [
    {"path": "design/mechanics/dash.yaml", "sha256": "<hash>"},
    {"path": "art/art-direction.md", "sha256": "<hash>"}
  ],
  "owned_paths": ["game/player/**", "tests/player/**"],
  "read_only_paths": ["design/**", "art/**"],
  "prohibited_actions": [
    "desktop-capture",
    "network-download",
    "change-acceptance-criteria",
    "edit-outside-owned-paths"
  ],
  "approval_required": ["new-external-asset", "arbitrary-editor-script"],
  "acceptance": ["DASH-01", "DASH-02", "DASH-VIS-01"],
  "commands": ["godot --headless --path game --script res://tests/run_suite.gd"],
  "outputs": [
    "artifacts/change-manifest.json",
    "artifacts/qa/dash.json",
    "artifacts/captures/dash.webm"
  ]
}
```

**Recommendation:** Input artifacts are addressed by path and content hash. Output schemas are versioned. An agent may report a blocked contract, but it may not silently substitute a different engine, asset, acceptance criterion, or capture target.

### Change manifest

The mutation owner should emit at least:

```json
{
  "schema": "antiky.change-manifest/v1",
  "task_id": "movement-014",
  "base_revision": "<git-sha>",
  "changed": [
    {"path": "game/player/player.gd", "kind": "code"},
    {"path": "game/player/player.tscn", "kind": "scene"}
  ],
  "editor_operations": [],
  "generated_files": [],
  "external_inputs": [],
  "known_non_undoable_operations": [],
  "rollback": "revert the task commit; regenerate no imported assets"
}
```

The point is not bureaucracy. It is to let QA know what to retest, let reviewers distinguish a generated artifact from a source asset, and let the producer recover from an editor mutation without reading a long transcript.

## Editor-control safety policy

### Default capability tiers

| Tier | Capability | Default | Examples |
|---|---|---|---|
| 0 | Repository read/inspect | Allowed in scope | manifests, scenes, source, test results |
| 1 | Headless build/test/export in isolated outputs | Allowed for assigned role | Godot headless, Unity tests, Unreal commandlet |
| 2 | Live editor read/inspect/viewport capture | Explicit role assignment | inspect hierarchy, read selection, target-app viewport screenshot |
| 3 | Live editor mutation | Single-writer lease + checkpoint | create actor, change material, import asset |
| 4 | Arbitrary editor code, external downloads, remote exposure | Per-operation human approval | Blender Python, remote MCP host, provider asset download |

### Single-writer lease

**Recommendation:** The project maintains an `editor-lease.json` outside normal content paths. It includes project ID, engine instance, holder task, acquired time, expiry, base revision, and allowed operation classes. Only the orchestrator grants it. A writer must release it before QA opens a second interactive editor. Read-only roles should prefer saved artifacts and headless validation instead of attaching to the same live process.

This is mandatory for Unreal because Epic explicitly says MCP calls run serially on the game thread. It is also prudent for Unity because only one batch-mode instance may open a project and asset-import/editor state is not designed as a multiwriter database.

### Mutation sequence

Every live-editor change follows this sequence:

1. Verify exact project, engine/editor version, current revision, dirty state, and adapter revision.
2. Acquire the editor lease.
3. Save or commit a recoverable checkpoint. For binary source files, work on a staged copy.
4. Inspect current hierarchy/asset state and record stable IDs/paths.
5. Produce a mutation preview listing exact targets and expected outputs.
6. Request approval if the operation crosses the envelope's capability tier.
7. Apply one bounded batch. Use an editor transaction where supported, but do not assume it makes imports or external effects undoable.
8. Save only named assets/scenes. Record every changed/generated item.
9. Run targeted technical checks and inspect runtime errors.
10. Capture the required game/editor viewport evidence, release the lease, and hand off to independent QA/review.

### Privacy and capture

**Recommendation:** Desktop-wide capture is prohibited by default. Capture must target the game window, editor viewport, or a dedicated offscreen render surface. A capture plan specifies the process/window identity, pixel bounds or engine camera, resolution, frame range, and expected overlay policy. It must not include terminal windows, menu bars, account names, shell prompts, home-directory paths, notifications, browser chrome, or unrelated applications.

Before an artifact is published, the capture gate should check:

- frame dimensions and duration;
- focus stayed on the target process;
- no unexpected window/title-bar pixels appeared;
- OCR/text inspection for usernames, absolute home paths, email addresses, tokens, and machine names;
- audio channels for unintended microphone/system audio;
- expected motion and multiple gameplay states are actually present;
- final encoded output remains legible at site display size.

This is a safety boundary, not merely a marketing preference. A “screenshot tool” does not authorize capture of the user's desktop.

### Network, secrets, and arbitrary code

- Keep editor MCP endpoints on loopback unless a documented authenticated tunnel is explicitly approved.
- Keep API keys in connector configuration or process secret stores, never in `SKILL.md`, handoffs, prompts, screenshots, or committed manifests.
- Disable unneeded telemetry and third-party provider access.
- External asset search is read-only discovery. Download/import is a separate approved action with provenance and license capture.
- Arbitrary code execution inside Blender or another editor is disabled by default and runs only in a staged project/file with a reviewed script and rollback.
- Skills and plugins are code/instruction dependencies. Audit their source, pin an immutable revision, and record a content hash before use.

## Review gates and approval loop

### Gate sequence

| Gate | Evidence | Pass owner | Failure returns to |
|---|---|---|---|
| G0 Contract | Brief, slice, mechanics/art contracts, risks, engine context | Producer + human for material scope | Contract owner |
| G1 Project integrity | Clean import/load, no corruption, expected changed paths | Engine worker + automated checker | Engine worker |
| G2 Technical correctness | Compile/static checks/unit and integration results | QA | Implementation owner |
| G3 Deterministic interaction | Launched build, seed, input trace, state checkpoints, runtime errors | QA | Implementation owner or designer if spec ambiguous |
| G4 Visual/runtime evidence | High-quality viewport video/stills at prescribed states | Capture verifier | Implementation/technical art owner |
| G5 Independent quality | Blind game-feel, art-direction, UX/accessibility rubrics | Independent reviewers | Relevant artifact owner |
| G6 Performance/content | Frame time, memory, load, package, rights/provenance | Performance/release reviewer | Worker, asset owner, or producer |
| G7 Milestone approval | All evidence, named exceptions, release notes | Human owner | Producer |

### Runtime evidence requirements

A gameplay feature must demonstrate at least:

- the setup/idle state;
- player input and motion over time;
- success and failure/edge states;
- visible and audible feedback where specified;
- the deterministic state checkpoints from the mechanics contract;
- absence of new runtime errors;
- representative target resolution and frame pacing;
- footage long enough to assess readability and feel.

Multiple screenshots of the same static state are one piece of evidence, not a demo. Motion footage should use a loss-conscious master and a separate site delivery encode. Review the final delivery asset at the real site size, because compression can preserve quality when the source, scaling, and codec settings are correct but cannot rescue a blurry capture.

### Independent review

The reviewer receives only:

- the approved brief and rubric;
- the runnable build or isolated project;
- the replay trace and capture plan;
- generated evidence and runtime logs.

It should not receive an expected score, the author's self-assessment, a diagnosis from an earlier evaluator, or privileged test fixtures. This is the same forward-testing discipline used for reliable skill evaluation: judge the output that a real downstream consumer would see.

Review results should use stable defect fields:

```json
{
  "defect_id": "VIS-023",
  "gate": "G5",
  "severity": "major",
  "rubric": "impact-readability",
  "observed_at": "00:07.233",
  "expected": "dash impact remains readable against the arena floor",
  "observed": "impact flash merges with the floor bloom for three frames",
  "evidence": "captures/dash.webm#t=7.233",
  "owner": "technical-art",
  "retest": ["DASH-VIS-01"]
}
```

Use at most two or three automatic repair/review iterations per defect class. Repeated failure is evidence that the contract, approach, or capability is wrong; it should be escalated, not buried in more autonomous retries.

## Skill-library architecture

### Canonical taxonomy

Use a canonical library separate from client discovery directories:

```text
game-skill-library/
├── catalog.yaml
├── lock.json
├── policies/
│   ├── editor-safety.md
│   ├── capture-privacy.md
│   ├── asset-provenance.md
│   └── review-independence.md
├── skills/
│   ├── core/
│   │   ├── game-brief/
│   │   ├── engine-context/
│   │   ├── handoff-contract/
│   │   └── milestone-gates/
│   ├── engines/
│   │   ├── unreal/
│   │   ├── unity/
│   │   ├── godot/
│   │   └── web/
│   ├── disciplines/
│   │   ├── game-design/
│   │   ├── game-feel/
│   │   ├── level-design/
│   │   ├── ux-accessibility/
│   │   ├── art-direction/
│   │   ├── technical-art/
│   │   ├── shaders-materials/
│   │   ├── assets-textures/
│   │   ├── animation-rigging/
│   │   ├── audio/
│   │   ├── qa-runtime/
│   │   ├── performance/
│   │   ├── production/
│   │   └── release/
│   ├── workflows/
│   │   ├── vertical-slice/
│   │   ├── asset-ingest/
│   │   ├── deterministic-playtest/
│   │   ├── visual-review/
│   │   └── release-candidate/
│   └── genres/
│       └── <only-after-repeated-validated-need>/
├── agents/
│   └── roles/
├── schemas/
│   ├── handoff-v1.schema.json
│   ├── change-manifest-v1.schema.json
│   ├── replay-v1.schema.json
│   └── review-v1.schema.json
├── evals/
│   ├── triggers/
│   ├── tasks/
│   ├── fixtures/
│   ├── rubrics/
│   ├── baselines/
│   └── reports/
└── provenance/
    ├── sources.yaml
    └── licenses/
```

**Recommendation:** Publish a selected, flat set of namespaced skill directories into `.agents/skills`, such as `game-engine-context`, `godot-gameplay-change`, `unreal-material-author`, and `game-visual-review`. Do not assume a client recursively discovers `skills/engines/godot/...`. Codex can consume symlinked skill folders, or a deterministic publish step can copy the locked packages.

### Skill package shape

Each portable package should remain conventional:

```text
godot-gameplay-change/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   ├── verify_context.sh
│   └── run_targeted_tests.sh
├── references/
│   ├── handoff-contract.md
│   ├── godot-4.5.md
│   └── common-failures.md
└── assets/
    └── change-manifest.example.json
```

Rules:

- `SKILL.md` defines one job, triggers, required inputs, outputs, stop conditions, capability tier, and evidence.
- Deterministic validation and repetitive commands belong in reviewed scripts.
- Engine/version details too large for the main instructions belong in one-level references.
- Templates and small fixtures belong in `assets/`.
- Evals remain central so a published runtime skill does not carry its expected answers into the execution context.
- Connector/tool requirements go in client metadata where supported, but the canonical catalog remains authoritative.

### Minimal skill frontmatter

```yaml
---
name: godot-gameplay-change
description: >-
  Implements an approved, bounded gameplay change in a pinned Godot project,
  with owned paths, deterministic tests, a change manifest, and runtime evidence.
  Use only after an engine-context and handoff artifact exist.
license: Apache-2.0
compatibility: Requires Godot 4.5.x and the Antiky handoff v1 schema.
metadata:
  antikylabs.version: "0.4.1"
  antikylabs.status: "beta"
  antikylabs.risk-tier: "3"
  antikylabs.eval-suite: "godot-gameplay-v2"
---
```

**Verified fact:** Agent Skills `metadata` is a map of string keys to string values and recommends reasonably unique keys. The specification does not define dependency resolution, semantic versioning, risk tiers, or provenance.

**Recommendation:** Keep only human-useful discovery/lifecycle hints in frontmatter. The catalog and lockfile carry the exact dependency graph and immutable identity.

### Catalog and lockfile

Recommended catalog record:

```yaml
id: godot-gameplay-change
version: 0.4.1
status: beta
owner: gameplay-systems
source:
  url: <canonical-source-url>
  revision: <full-commit-sha>
license: Apache-2.0
content_sha256: <directory-content-hash>
engines:
  godot: ">=4.5.0 <4.6.0"
schemas:
  - antiky.handoff/v1
  - antiky.change-manifest/v1
capabilities:
  - repo-write-owned-paths
  - headless-engine
risk_tier: 2
requires:
  - id: game-engine-context
    version: ">=0.3.0 <1.0.0"
suggests:
  - id: game-visual-review
    version: ">=0.2.0 <1.0.0"
conflicts:
  - unreal-editor-change
eval_suite: godot-gameplay-v2
last_verified:
  date: 2026-08-09
  engine: 4.5.3
  adapter_revision: <full-commit-sha>
```

The generated lockfile should resolve every selected skill and connector to exact version, source revision, and content hash. It should also record engine/editor version, schema versions, and the eval report that qualified the combination.

Dependency behavior should be intentionally boring:

- `requires` must be present and compatible before activation;
- `suggests` is visible but never silently enabled;
- `conflicts` blocks activation in the same mutation task;
- dependency cycles fail validation;
- routers print the resolved skill/connector plan and reason before mutation;
- nothing auto-installs or updates from a registry during a game task.

### Provenance

For every third-party skill or source-derived instruction, record:

- canonical repository URL and original package path;
- immutable full commit SHA and content hash;
- author/publisher and license text;
- files copied, adapted, or only referenced;
- local modifications and reviewer;
- engine/API versions verified;
- security/tool-capability audit result;
- eval suite/report and promotion decision;
- registry coordinates and observed counts as nonauthoritative metadata.

GitHub stars and skill installs must never be stored as trust decisions. They can support discovery and maintenance triage, but only source audit, capability review, compatibility tests, and task evals can promote a package.

## Evaluation and versioning

### Evaluation layers

1. **Package validation:** frontmatter, directory/name match, reference depth, broken links, script lint, schema validation, license/provenance completeness.
2. **Trigger evaluation:** positive, negative, and ambiguous prompts; explicit-invocation behavior for risky skills; collision tests with similarly named skills.
3. **Procedure evaluation:** missing input, dirty project, unsupported engine version, denied capability, lease conflict, test failure, and rollback behavior.
4. **Engine fixture evaluation:** a clean small project for every supported engine/version with known tasks and adversarial edge cases.
5. **Runtime evaluation:** launch, deterministic trace, state checkpoints, runtime-error collection, and replay repeatability.
6. **Visual/gameplay evaluation:** blind rubric scoring from viewport evidence and, where useful, direct play.
7. **Regression evaluation:** compare no-skill baseline, previous stable skill, candidate skill, and current model/tool combination.
8. **Security evaluation:** prompt injection in project files, malicious skill references, path escape, desktop capture attempt, network download, secret leakage, arbitrary editor code, and remote endpoint exposure.

### Trigger corpus

Each skill needs at least:

- clear positive prompts that should activate it;
- adjacent prompts that should activate a different skill;
- negative prompts where it must stay inactive;
- prompts missing a required artifact, where it should request or report the prerequisite instead of improvising;
- explicit-invocation tests for tier 3/4 skills;
- catalog-collision tests proving deterministic resolution.

### Task fixtures

Fixture tasks should include mechanics, presentation, and content because benchmark evidence shows they fail differently:

- movement state machine with edge/coyote time;
- camera collision and motion readability;
- enemy telegraph and player feedback;
- shader under varied lights, motion, and quality levels;
- material/texture import with provenance and LOD settings;
- UI controller/keyboard focus and accessibility state;
- animation retarget and transition interruption;
- spatial/looping audio with in-game mix budget;
- save/load or scene-transition state;
- broken/corrupt/unsupported asset and rollback;
- intentionally private terminal/desktop data outside the capture target.

Every task should have a clean starting project, public acceptance criteria, hidden checks, deterministic traces, expected artifact schemas, and a blind visual/gameplay rubric. Generated work must be evaluated in a fresh context that has not seen the expected solution.

### Promotion states

| State | Meaning | Allowed use |
|---|---|---|
| `quarantine` | Unreviewed third-party or newly imported | Static audit only |
| `alpha` | Package-valid and passes small trigger/procedure suite | Isolated experiments |
| `beta` | Passes target-engine fixtures, runtime replay, security checks | Supervised project work |
| `stable` | Repeated cross-project success, regression baseline, named owner | Default supported workflow |
| `deprecated` | Replacement announced; migration documented | Existing locked projects only |
| `blocked` | Security, license, compatibility, or quality failure | Not runnable |

Engine, connector, model, or schema upgrades invalidate the compatible combination until smoke and targeted regression suites pass. This should not require changing the skill's public version when only the lockfile combination changes, but a material instruction or behavior change requires a new skill version.

Recommended version rules:

- patch: clarification or backward-compatible reliability improvement;
- minor: new optional capability, engine patch/minor range, or output extension;
- major: trigger semantics, required inputs, capability tier, artifact schema, or behavior breaks;
- stable versions are immutable; republish as a new version instead of moving tags;
- every release records generated content hash and eval report.

## Concrete starter configuration

The following is a conceptual project-agent set, not a request to modify the current Codex configuration.

```text
.codex/agents/
├── game-producer.toml
├── engine-context.toml
├── godot-worker.toml
├── unity-worker.toml
├── unreal-worker.toml
├── qa-verifier.toml
└── visual-reviewer.toml
```

Configuration principles:

- `game-producer`, `engine-context`, and `visual-reviewer` use a read-only sandbox.
- exactly one engine worker is activated for a task, with workspace writes and only its engine connector;
- `qa-verifier` writes only to a designated evidence/output path, not source content;
- a worker's developer instructions repeat owned paths, prohibited capabilities, expected artifacts, and stop conditions from the handoff;
- a normal cell has at most four concurrent roles and one mutation owner;
- alternate concepts can run in isolated worktrees or staging files, but only the selected artifact is integrated by the engine worker.

Example boundary, abbreviated:

```toml
name = "visual-reviewer"
description = "Independently reviews runtime viewport evidence against the approved visual and game-feel rubric."
sandbox_mode = "read-only"
developer_instructions = """
Read the brief, rubric, replay trace, and generated viewport evidence.
Do not edit source or project assets. Do not use desktop-wide capture.
Return only the versioned review artifact with timestamped defects and a pass/fail decision.
"""
```

Use host-supported defaults for model selection unless an eval proves a role-specific configuration. The contract and evidence should survive model changes.

## Anti-patterns to reject

### Organizational

- **Always-on giant studio:** dozens of directors, leads, and specialists create routing cost and context theater. Instantiate only the current cell.
- **Parallel same-project writers:** editor state, imports, binary assets, and serialized scene files are not a collaborative database.
- **Hierarchy without artifacts:** role names do not replace versioned inputs, outputs, acceptance, and evidence.
- **Reviewer-author fusion:** the agent that made the work should not be the only judge of quality.
- **Producer as universal approver:** orchestration is not art direction, playtesting, performance review, or release authority.

### Skill-library

- **Install-by-popularity:** counts and stars do not prove accuracy, safety, license compatibility, or maintenance.
- **Unpinned `main`, `master`, or `beta`:** both VibeUE's architectural evolution and Unity MCP's moving beta branch show why exact pins matter.
- **Monolithic “make a game” skill:** it hides role boundaries, expands tool authority, pollutes context, and cannot be evaluated diagnostically.
- **Opaque router:** a router that does not reveal resolved skills, versions, tools, and reasons prevents provenance and debugging.
- **Hundreds of discoverable skills:** clients may truncate the initial catalog, making activation unreliable.
- **Deep reference mazes:** they defeat progressive disclosure and make audit/eval coverage unclear.
- **Silent dependencies or auto-install:** runtime network and instruction supply-chain changes must never occur during a mutation task.

### Editor and assets

- **Trusting undo as backup:** imports and external effects may be non-undoable. Use source-control/file checkpoints.
- **Arbitrary editor code by default:** broad Python/eval capabilities are escalation tiers, not ordinary tools.
- **Remote unauthenticated MCP:** loopback-only tools must not be exposed directly to a network.
- **Direct external asset insertion:** every asset needs license, source, transformation, and hash before integration.
- **Production-file experimentation:** generated art/animation/material work belongs in staging until accepted.
- **Desktop-wide screen capture:** viewport evidence must not collect terminal names, usernames, paths, notifications, or unrelated applications.

### Quality

- **Green build equals good game:** benchmarks show that mechanical plausibility does not guarantee content, visual feedback, coherence, or feel.
- **Static screenshot as gameplay proof:** moving games need replayable motion footage and state checkpoints.
- **Many nearly identical images:** evidence must cover meaningful states, actions, edge cases, and visual conditions.
- **Generic “make it polished”:** quality needs references, explicit rubric dimensions, platform budgets, and negative examples.
- **Self-reported success:** only generated artifacts, launched runtime evidence, logs, traces, and independent review count.
- **Evaluation leakage:** a reviewer exposed to the expected answer or prior diagnosis is not an independent evaluator.

## Phased implementation roadmap

### Phase 0 — governance and harness

Create the schemas, catalog, lockfile, provenance record, capability tiers, editor lease, capture/privacy policy, and eval runner. Add one tiny Godot fixture capable of seeded fixed-timestep replay, structured state output, viewport capture, and runtime-error collection.

Exit criteria:

- standards validation passes;
- dependency and collision checks pass;
- unsafe skill activation is explicit;
- a malicious capture task cannot collect outside the game viewport;
- a replay produces repeatable checkpoints and evidence hashes;
- a failed gate returns a structured defect.

### Phase 1 — minimum production cell

Build `game-brief`, `engine-context`, `handoff-contract`, `godot-gameplay-change`, `game-runtime-verification`, and `game-visual-review`. Exercise them on several deliberately different small games/mechanics, not one recurring showcase.

Exit criteria:

- three independent fixtures complete the full gate loop;
- the reviewer catches seeded visual/gameplay defects missed by technical tests;
- all changes have path ownership and rollback;
- no author self-approves;
- delivery capture is clear at target site size.

### Phase 2 — engine adapters

Add Unity using pinned editor/Test Framework/adapter combinations. Add Unreal using the 5.8 native MCP base and audited optional VibeUE toolsets. Maintain the same artifact schemas across engines and keep engine-specific references thin.

Exit criteria:

- the same mechanics contract and defect schema work across all three engines;
- each engine has a headless technical path and a visual/runtime path;
- editor lease conflicts fail safely;
- adapter upgrades trigger quarantine and compatibility evals.

### Phase 3 — presentation disciplines

Add technical art, shaders/materials, asset ingest, textures, animation, audio, art direction, UX/accessibility, and game-feel skills. Keep creation in staging and integration in the engine worker.

Exit criteria:

- source compile/format validators run where applicable;
- every asset has provenance/license/hash;
- renderer/device/performance variants are tested;
- motion, light, scale, and final compression are visually reviewed;
- audio/animation/UI evidence is part of the replay, not inspected only in an editor.

### Phase 4 — production and release

Add milestone planning, change impact, performance budgets, packaging, release notes, and release-candidate review. Connect approved evidence to the site/demo publication pipeline only after a named human accepts the milestone.

Exit criteria:

- release artifacts reproduce from the lockfile;
- provenance and license review passes;
- supported target packages launch;
- published footage maps to a released build and replay trace;
- exceptions are explicit, owned, and time-bounded.

## Source audit shortlist

These are the highest-value candidates for focused audits, in order:

1. [Agent Skills specification source](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx) for packaging and validator compatibility.
2. [OpenAI skills repository](https://github.com/openai/skills) for current first-party package patterns; observed revision `49f948faa925...`.
3. [Unreal native MCP documentation](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor) and [VibeUE](https://github.com/kevinpbuckley/VibeUE) for an Unreal 5.8 adapter.
4. [CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp) for a pinned Unity adapter, evaluated against official Unity CLI/Test Framework behavior.
5. [hi-godot/godot-ai](https://github.com/hi-godot/godot-ai) for live Godot control and [HKUDS/CLI-Anything](https://github.com/HKUDS/CLI-Anything) for a conservative headless pattern.
6. [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) for cross-discipline topic coverage, never as a single opaque install.
7. [Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) for artifact/checklist mining, not its full hierarchy.
8. [MCPBlender/blender-mcp](https://github.com/MCPBlender/blender-mcp) only after an arbitrary-code/network/provenance security review.
9. [GameDevBench](https://github.com/waynchi/gamedevbench) and [GameCraft-Bench](https://github.com/FreedomIntelligence/gamecraft-bench) as design inputs for Antiky's replay and visual eval corpus.

No candidate should leave `quarantine` because of a search result or star count.

## Exact verification commands

Package and source checks:

```bash
skills-ref validate ./game-skill-library/skills/core/game-brief
git ls-remote https://github.com/kevinpbuckley/VibeUE.git refs/heads/master
git ls-remote https://github.com/CoplayDev/unity-mcp.git refs/heads/beta
git ls-remote https://github.com/hi-godot/godot-ai.git refs/heads/main
git ls-remote https://github.com/gamedev-skills/awesome-gamedev-agent-skills.git refs/heads/main
```

Do not use `git ls-remote` as a dependency resolver at task time. Resolve and audit ahead of time, then store the immutable full SHA and content hash in `lock.json`.

Engine checks should be represented as templates in the relevant skill reference, with absolute project/output paths supplied by the handoff:

```bash
# Godot import and deterministic test/replay
godot --headless --path /absolute/project --import
godot --headless --path /absolute/project --script res://tests/run_suite.gd

# Unity test run: preserve XML and full log; do not append -quit blindly
/path/to/Unity -batchmode -projectPath /absolute/project \
  -runTests -testPlatform editmode \
  -testResults /absolute/evidence/results.xml \
  -logFile /absolute/evidence/unity.log

# Unreal editor automation commandlet
/path/to/UnrealEditor-Cmd /absolute/project/Game.uproject \
  -run=pythonscript -script=/absolute/scripts/verify.py

# SPIR-V validation after target compilation
spirv-val /absolute/evidence/shader.spv
```

Commands are evidence only when their exact arguments, tool versions, environment, exit status, structured results, and logs are recorded in the QA artifact.

## Decision summary

Antiky should build a compact, artifact-driven game production system, not a theatrical agent org chart. The core abstractions are:

- one accountable owner per artifact;
- one live-editor writer per project;
- explicit, hashed handoff inputs and versioned outputs;
- pinned engines, adapters, skills, schemas, and provenance;
- deterministic launch/replay/state evidence;
- high-quality target-viewport motion capture with privacy boundaries;
- independent technical, visual, game-feel, accessibility, performance, and human approval gates;
- a small portable Agent Skills surface backed by a richer catalog, lockfile, and eval corpus.

The ecosystem already contains useful engine adapters, discipline prompts, and benchmark patterns. It does not provide a ready-made trustworthy studio. The differentiating work is the contract, evidence, safety, and evaluation layer that turns those parts into reproducible game production.
