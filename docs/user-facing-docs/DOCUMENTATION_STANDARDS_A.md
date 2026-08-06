---
publish: false
---

# User documentation standards

These standards apply to documentation for people who use Antiky to make their own games. The
reader should not need to understand this repository, its delivery plan, or the implementation
history before they can use the product.

## Start with the reader's goal

Before writing, answer three questions:

1. Who is reading this page?
2. What are they trying to understand or finish?
3. What is the shortest path to a useful result?

Write from that point of view. Do not organize a page around the order in which the code was built,
the modules that implement it, or the guarantees that mattered during development.

The first paragraph must say what the feature is and why someone would use it. Use plain-language
terms a game developer already knows. Put the smallest working example near the top. Move storage,
validation, protocol, ownership, and renderer boundaries to the section where the reader needs
them.

For example, do not open a point-light page with stable identity, component records, or render
bindings. Open with the visible idea:

> A point light shines from one position in every direction, like a lamp or torch. Use it to light
> a small area around an object or place in your world.

The stable ID and render-integration rules still matter. They belong after the reader understands
the light and can create one.

## Choose one primary page type

Antiky uses the four documentation needs described by
[Diátaxis](https://diataxis.fr/start-here/):

| Page type | Reader need | Shape |
| --- | --- | --- |
| Tutorial | Learn by completing a guided experience | Safe, complete steps with a visible result |
| How-to guide | Finish a specific real-world task | Direct, adaptable actions with no unrelated lecture |
| Reference | Look up accurate facts while working | Predictable tables, signatures, defaults, limits, and errors |
| Explanation | Understand why the system works this way | Context, tradeoffs, relationships, and alternatives |

Choose the primary type before drafting. A page can contain a small supporting section of another
type, but it must not turn into several full documents joined together. Split a page when it starts
serving a second major task. Link to the new page instead of duplicating it.

Examples:

- “Build your first Antiky game” is a tutorial.
- “Change a point light while the game runs” is a how-to guide.
- “Point-light fields” and “MCP tools” are reference material.
- “Why Antiky uses stable entity IDs” is an explanation.

## Use a page shape that matches the job

Most feature and how-to pages should follow this order:

1. A title that names the feature or outcome.
2. A short definition and a familiar reason to use it.
3. The smallest working example or first useful command.
4. The concepts or properties needed for normal use.
5. Common tasks in the order a developer performs them.
6. Limits, failures, security, and integration details.
7. Links to closely related public documentation.

Reference pages should lead with a one-sentence scope and a short usage example, then present a
consistent table or entry format. Tutorials should protect the learner from unnecessary choices.
Explanation pages may explore tradeoffs, but should still define the subject before discussing its
design.

Treat this order as progressive disclosure. A developer who reads the first screen should know
whether the page is relevant. A developer who continues should encounter detail when it becomes
useful, not all at once.

## Write like a person

- Address the reader as “you” when describing their actions.
- Use direct, active sentences: “Run `antiky dev`,” not “The command can be run.”
- Prefer present tense and concrete verbs.
- Use familiar words without making the content less exact.
- Define a necessary technical term on first use. Do not stack several undefined terms in one
  sentence.
- Keep one main idea in each paragraph. Put its most important sentence first.
- Keep sentences short enough to read aloud once without losing the subject.
- Use the same word for the same concept. Do not rotate synonyms for variety.
- Use sentence-style capitalization for headings.
- State a limitation plainly. Do not bury it in promotional language.
- Remove filler such as “simply,” “obviously,” “it is important to note,” and “this page will.”

Technical accuracy does not require an implementation-first voice. Say “the current game process”
before “runtime instance” when the ordinary phrase is enough. If a public type or protocol uses the
technical term, introduce the normal idea first and then name the exact term.

## Make examples earn their space

Examples must be believable, adaptable, and consistent with the shipped interface.

- Show the common path before an advanced path.
- Include the imports, inputs, and setup needed to understand the example.
- Explain any variable that the snippet assumes already exists.
- Use generic game names such as `harborLamp`, not repository demo or planning names.
- Prefer one complete example over several fragments that a reader must assemble mentally.
- Show useful CLI output when it helps the reader recognize success.
- Keep IDs, URLs, ports, field names, and error codes valid.
- Do not present pseudocode as copyable code. Label an intentionally incomplete sketch.
- Re-run or compile examples when the repository provides a practical way to do so.

The first example should prove the feature's basic value. Permission contexts, recovery flows,
event history, and renderer acknowledgements are advanced examples unless they are required for
the basic result.

## Write useful reference material

Use stable, repeatable shapes so readers can scan instead of interpreting prose.

A field table should include the field name, type or format, default when one exists, valid range or
constraint, and what the field changes. A command entry should include its syntax, prerequisites,
arguments, result, and important failures. An MCP tool entry should also say whether it reads or
changes state and when another tool should be called first.

Use public names exactly as the software exposes them. Prefer stable error codes for recovery logic
and explain the human-readable message separately. Verify default values and limits against source
or tests rather than copying an older page.

## Organize the documentation by product and task

The documentation home is `docs/user-facing-docs/README.md`. It provides task-oriented entry points
and groups pages by the public surface a developer recognizes:

- `framework/` for game code and runtime behavior.
- `cli/` for commands a person runs.
- `mcp/` for connecting an MCP client and using MCP tools.
- `studio/` for Studio workflows and integration.

Give each topic one canonical home. A CLI page can show the command that calls an MCP tool, but the
complete MCP setup and tool catalog belong in the MCP section. Cross-link the canonical page at the
point where a reader needs it.

Keep the hierarchy shallow. Add a folder when it represents a durable product area, not one release
or implementation schedule. Do not name public pages or examples after slices, objectives,
milestones, demos, or repository verification runs.

Public documentation must stand on its own. Do not require a reader to follow an ADR, architecture
record, or objective to complete a public task. Internal records may link to public docs, but public
docs should link only to other public docs unless a contributor-only section is clearly labeled.

## Control website publication

Markdown pages in the public product folders are published to the website by default. Add this
frontmatter when a page belongs in the documentation source tree but should remain repository-only:

```yaml
---
publish: false
---
```

An unpublished page must not appear in website navigation, search, the sitemap, Markdown routes, or
`llms.txt`. Do not link to an unpublished page from a published page.

## Keep advanced detail, but put it in the right place

Do not remove constraints just to make a page friendly. Layer them.

- Put the normal case first.
- Put property defaults and limits beside the properties they affect.
- Put recovery guidance beside the operation that can fail.
- Put security guidance beside the exposed boundary.
- Put implementation-independent concepts before adapter-specific mechanics.
- Move long protocol catalogs and architectural rationale to their own reference or explanation
  page.

This ordering lets a new developer succeed without hiding information an experienced developer
needs.

## Review every page

Before merging a user-facing documentation change, check the following:

- The opening defines the subject in ordinary language and gives a reason to use it.
- The first example or action demonstrates the common path.
- The page has one primary reader goal and page type.
- Headings describe tasks or lookup topics, not implementation phases.
- Jargon is removed or defined where it first appears.
- Public names, defaults, limits, outputs, and errors match the source and tests.
- Examples are generic and do not depend on an Antiky repository demo.
- Planning language and internal delivery history do not appear.
- Detailed material has one canonical home, with links instead of copied sections.
- Local links resolve, code fences close, and the affected documentation contract test passes.
- A final read aloud sounds like a capable developer helping another developer.

The documentation contract lives in `packages/cli/tests/user-docs.test.ts`. Extend it when the
public navigation or shipped interface changes. Favor tests for discoverability, valid examples,
links, and public contracts. Do not turn prose style into a large collection of brittle word-count
or grammar assertions.

## Research behind these standards

The requested point-light references share a useful pattern even though their engines and APIs are
different:

| Documentation | Useful pattern |
| --- | --- |
| [Phaser PointLight](https://docs.phaser.io/api-documentation/class/gameobjects-pointlight) | Explains the effect, useful visual cases, and performance tradeoff before the constructor table. |
| [Three.js PointLight](https://threejs.org/docs/pages/PointLight.html) | Defines the light with a bare-lightbulb example, then shows a short code example before the API. |
| [Roblox PointLight](https://create.roblox.com/docs/reference/engine/classes/PointLight) | Keeps inheritance and properties in reference structure and places a creation sample before detailed entries. |
| [Godot PointLight2D](https://docs.godotengine.org/en/stable/classes/class_pointlight2d.html) | Uses a one-line summary, a short description, a tutorial link, and a compact property table. |
| [RealityKit PointLight](https://developer.apple.com/documentation/realitykit/pointlight) | Explains when explicit lighting is useful, what the radius affects, and the scene limit before type relationships. |
| [deck.gl PointLight](https://deck.gl/docs/api-reference/core/point-light) | Moves directly from a plain definition to usage, then documents defaults and attenuation. |
| [Unity light types](https://docs.unity3d.com/2023.2/Documentation/Manual/Lighting.html) | Uses familiar game examples such as lamps, sparks, and explosions to explain when to choose a point light. |
| [Unreal Engine point lights](https://dev.epicgames.com/documentation/en-us/unreal-engine/point-lights-in-unreal-engine) | Starts with a real lightbulb comparison, then makes mobility, performance, and properties visible. |

These pages do not all solve documentation equally well. Roblox's current class page, for example,
is sparse as an introduction. The standard is based on the recurring strengths across the set, not
on copying one site's layout.

The broader writing rules come from three established sources:

- [Diátaxis](https://diataxis.fr/start-here/) separates tutorials, how-to guides, reference, and
  explanation because they serve different reader needs.
- The [Google developer documentation style guide](https://developers.google.com/style) recommends
  project-specific guidance, direct address, scannable paragraphs, and critical information first.
- The [Microsoft Writing Style Guide](https://learn.microsoft.com/en-us/style-guide/welcome/)
  recommends a straightforward, conversational, crisp style with everyday words and short
  sentences.

## A possible documentation skill

Do not add a documentation skill just to duplicate this file. Folder instructions are the reliable
choice now because they apply automatically to every change under `docs/user-facing-docs/`. A skill
is useful later if documentation work develops a repeatable procedure that should load only for
that task.

The [Agent Skills specification](https://agentskills.io/specification) supports that approach:
small discovery metadata can load first, followed by task instructions and only the references the
agent needs. A future Antiky documentation skill should:

1. Trigger narrowly on creating, reorganizing, or reviewing user-facing Antiky documentation.
2. Read this standard as its source of truth instead of copying it.
3. Identify the audience, reader goal, and page type before editing.
4. Check the shipped source and tests for public behavior.
5. Audit the opening, first example, information order, terminology, and canonical topic location.
6. Run the existing documentation contract and relevant package tests.
7. Report factual uncertainty instead of filling gaps with plausible prose.

Start without bundled scripts. Add a script only for a deterministic check that the repository's
normal tests cannot express cleanly. This keeps the skill small, reviewable, and less likely to
become an unused maintenance burden.
