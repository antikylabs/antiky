# Understand Antiky agent skills

An agent skill is a small set of task instructions that a compatible coding agent can load when it
needs a specific way of working. Use a skill when a procedure should remain consistent across
projects without copying the same prompt into every repository.

## What a skill contains

Every skill has a `SKILL.md` file with a name, a routing description, and the instructions the agent
must follow. A skill can also carry focused reference pages, scripts, tests, and third-party notices.
The agent reads those supporting files only when the selected procedure needs them.

Some skills provide one job. Others provide named subcommands for related jobs. For example,
`write-docs` can classify, write, audit, or split documentation while keeping the same writing rules.

## Why the instructions are portable

The public Antiky skills do not depend on Antiky source paths. You can install them into another
project and keep the project as the working directory. Scripts resolve their own supporting files
from the installed skill directory.

This portability has a cost: a skill teaches a procedure, but it does not replace the current API,
types, tests, or repository instructions for your project. The agent must still inspect the target
before it changes anything.

## Compatibility boundary

Antiky skills follow the [Agent Skills specification](https://agentskills.io/specification) and use
the open [`skills` command-line interface](https://github.com/vercel-labs/skills) for discovery and
installation. The receiving agent must support that format or provide a compatible adapter.

The public catalog includes reviewed skills with usable instructions. It excludes internal skills
and frontmatter-only placeholders. A skill provides a procedure, but it does not replace
project-specific review or guarantee that every coding agent will make the same judgment.

## Source and review point

The canonical source is the [Antiky Labs skills repository](https://github.com/antikylabs/skills).
The website catalog was reviewed at commit
[`c5970383cde4e90588ba7d039f7a665ebe3443fd`](https://github.com/antikylabs/skills/tree/c5970383cde4e90588ba7d039f7a665ebe3443fd).
Use the repository for newer changes and each skill's complete instructions.

## Related documentation

- [Install and manage Antiky skills](install.md).
- Use the [Antiky skills reference](reference.md) while choosing a skill or subcommand.
- Browse the [public Skills library](/resources/skills) for the reviewed catalog.
