# Antiky skills reference

This reference lists the public skills in the Antiky Labs skills repository at commit
`c5970383cde4e90588ba7d039f7a665ebe3443fd`. Use the exact name with `npx skills add
antikylabs/skills --skill <name>`.

| Skill | Purpose | Supported subcommands |
| --- | --- | --- |
| `anti-slop` | Find false evidence in code, tests, scripts, and prose with deterministic checks. | `install`, `code`, `prose`, `structure` |
| `brometal-patching` | Update or locally patch BroMetal, send the fix upstream, and retire accepted patches. | `update`, `patch`, `pr` |
| `engineering` | Use a read-only principal-engineer sidekick to challenge a plan or technical judgment. | `gut-check`, `talk-it-out`, `plan-it`, `grill-it` |
| `show-me` | Explain the current topic with the smallest useful diagram or focused visual artifact. | Bare invocation |
| `simplified-technical-english` | Write, audit, or correct documentation against ASD-STE100 Issue 9. | `write`, `audit`, `fix` |
| `wait-what` | Re-pitch an explanation that did not land. This skill is human-invoked only. | Bare invocation, `init` |
| `write-adrs` | Write or suggest a five-part Architecture Decision Record. | `write`, `suggest` |
| `write-docs` | Classify, write, audit, or split user-facing documentation with Diátaxis. | `classify`, `write`, `audit`, `split` |
| `write-objectives` | Run the research, planning, goal execution, review, and archive lifecycle. | `init`, `create-research`, `create-plan`, `create-goals`, `execute`, `audit`, `complete-goal`, `complete-objective` |

## Invocation rules

A bare skill invocation uses the default route described by that skill. When a skill exposes a
subcommand, include the subcommand and target so the agent can choose the matching procedure.

`wait-what` disables automatic model invocation. A person must name it explicitly. `engineering`
is read-only: it can review and challenge work, but it does not implement a recommendation.

## Catalog scope

The reviewed snapshot contains nine public skills. The catalog excludes internal skills and
frontmatter-only placeholders.

## Related documentation

- [Install and manage Antiky skills](install.md).
- [Understand the skill format and compatibility boundary](overview.md).
- Inspect the [pinned source snapshot](https://github.com/antikylabs/skills/tree/c5970383cde4e90588ba7d039f7a665ebe3443fd).
