# Research page copy

Page type: Explanation

Reader: a technically skeptical builder who wants to see what Antiky Labs has studied, what is active
now, and which ideas are still untested.

Primary action: inspect the public research and runnable evidence.

## Metadata

Title: Antiky Labs Research | Games, agents, and rendering

Description: Antiky Labs uses focused research gyms and working game artifacts to test rendering,
agent guidance, and AI-native game-development questions in public.

Canonical: `/research`

## Hero

Status: One completed study · active experiments · open questions

Headline: Evidence before adjectives.

Lead:

Antiky Labs uses focused research gyms to test one game-development question at a time. A gym is a
standalone experiment or game build with a narrow problem, a runnable artifact, and a path for
useful findings to return to Framework, Studio, CLI, or the games.

Primary action: Explore the research repository

Secondary action: Run the current Framework studies

## What a research gym is

Section label: Method

Headline: Isolate the question. Keep the result connected to real work.

Body:

A research gym creates enough space to investigate one idea, problem, engine mechanic, or game
mechanic without turning the main product into an experiment. It can move quickly, fail clearly,
and preserve the conditions that produced the result.

Gyms use Antiky Framework's host boundary and project setup when that serves the question. That
keeps the research close to the real development path and exposes weaknesses in our own tools. The
experiment remains standalone in the research repository. A useful result can inform the product;
it does not become a Framework feature automatically.

Gym principle: Focused enough to answer one question. Real enough to teach the product something.

## Completed research

Status: Completed study · public report

Headline: Ahead-of-time shader compilation, compared.

Body:

The first completed study compares approaches to ahead-of-time shader compilation across BroMetal,
TypeGPU, WESL, and Three.js. The report belongs in the research repository with the code and setup
that produced it.

The page should describe only conclusions the published report supports. “Completed” means the
study ran and has a report; it does not make every measured difference a general performance claim.

Primary action: Read the shader compilation report

Supporting action: Inspect the experiment source

Media option: a real chart or report page exported from the completed study

Alt text: Results from the Antiky Labs ahead-of-time shader compilation comparison, with the tested
approaches and measurement labels visible.

Caption: Completed research · see the public report for method, versions, measurements, and limits.

Implementation note: The research README currently names a different report filename from the file
in `reports/`. Fix that source link or point this action at the repository index before publishing.

## Active research

Headline: Three questions are being worked now.

Status: Active

Title: Skills that give agents better guidance

Copy: We are testing how compact, task-specific instructions, references, deterministic tools, and
evaluation cases help agents handle engineering and game-development work more reliably. The public
skills repository is a working output of that research.

Action: Explore the skills library

Status: Active

Title: An AI-native game-development pipeline

Copy: We are mapping the full loop from human intent through implementation, runtime observation,
feedback, verification, and approval. The question is not whether an agent can produce code. It is
which context, interfaces, and evidence help the agent make a change a person can trust.

Status: Active gym

Title: High-quality voxel rendering for a Studio mini app

Copy: The current gym tests voxel-rendering techniques inside a focused app-shaped workspace. It
also tests the boundary between a standalone research artifact, Framework hosting, and a future
Studio mini app.

Media: real capture from the current voxel-rendering experiment

Alt text: Current Antiky Labs voxel-rendering experiment showing the rendered voxel scene produced
by the active research gym.

Caption: Active gym · a current experiment, not a shipped Studio mini app.

## Research ahead

Section label: Future questions

Headline: Planned work is a queue of questions, not a feature list.

Intro:

These studies have direction but do not have published results. They receive dates or product
commitments only when a bounded plan and proving case exist.

Planned gym: Voxel editor

Question: Which editing, selection, preview, and validation boundaries make voxel authoring useful
to both a person and an agent?

Planned gym: Model viewer

Question: What semantic inspection, material information, provenance, and capture tools make a 3D
model understandable inside the development loop?

Planned gym: Terrain generator

Question: How should generation inputs, repeatability, editing, and evidence work when terrain is
created for a real game rather than a showcase image?

Planned gym: Sprite generator

Question: Can an image-to-video-to-slicer workflow produce usable sprite animation while preserving
frame continuity, provenance, review, and human art direction?

Research question: Models trained on BroMetal shaders

Copy: Test whether focused training or adaptation improves useful shader work under a published
task set, baseline, configuration, and evaluation. No trained-model result is claimed today.

Research question: Models trained on Antiky Framework

Copy: Test whether Framework-specific training or adaptation improves bounded game-development
tasks compared with the same model using current documentation and tools. No efficiency or quality
result is claimed today.

## How a question becomes a claim

Section label: Publication standard

Headline: Show the method. Publish the limits.

Body:

A research claim should carry enough detail for another builder to understand and challenge it.
That means publishing the task, baseline, model or implementation versions, configuration, success
criteria, time and compute where relevant, result, failures, and limitations.

A runnable artifact can prove that one thing worked under stated conditions. It cannot prove a
general outcome on its own. Until the method and result are public, smaller-model efficiency,
training gains, generated-asset quality, and generalized creator-agent workflows remain questions.

Checklist labels:

- Question and hypothesis
- Baseline and comparison
- Versions and configuration
- Runnable method or artifact
- Success criteria and measurements
- Result and failures
- Limitations and next question

## How research returns to Antiky

Section label: Product boundary

Headline: Research can change the roadmap without becoming the roadmap.

Body:

A gym can reveal a reusable system, disprove an assumption, improve a skill, or show that a product
boundary is wrong. The finding returns to the relevant Framework, Studio, CLI, library, or game plan
with its evidence attached.

Promotion is a separate decision. The product still needs a real use case, an owned interface,
tests, documentation, and a release boundary. That separation lets research stay candid without
making the public product unstable.

Supporting action: See what is planned on the roadmap

## Closing action

Headline: Read the work. Run what can be run. Challenge the conclusion.

Body: The research repository holds the experiments and reports. The demos show current product
evidence. Discord is where builders can compare methods, report failures, and help shape the next
bounded question.

Primary action: Explore the research repository

Secondary action: Run current evidence

Tertiary action: Challenge a question on Discord

## Alternatives

These are deliberate alternatives, not additional headings to ship.

- **Turn open questions into runnable evidence.** More action-led and direct; weaker as a durable
  Antiky line than the approved headline.
- **Research for games, agents, and the tools between them.** More descriptive for an unfamiliar
  visitor; less distinctive and better suited to metadata or a navigation description.

CTA alternatives:

- **Read the completed research** — use when the completed-report destination is stable.
- **Inspect the active experiments** — use when the repository offers a maintained experiments
  index rather than a generic source view.

## Editorial notes

- Keep the gym definition in the first screen; it is the page's clearest original concept and gives
  the active-work list a coherent shape.
- Link the AOT study only after the report filename and README agree. Do not summarize a winner or
  performance result from memory.
- “Current” is reserved for visible work that exists. Planned gyms and both model-training ideas
  stay Future or Research question.
- A real experiment capture may illustrate the page. Generated concept art cannot stand in for a
  result.
