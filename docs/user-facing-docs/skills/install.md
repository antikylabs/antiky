# Install and manage Antiky skills

Install Antiky skills with the `skills` command-line interface when you want a compatible coding
agent to use the same reviewed procedure in your project. Run these commands from the project that
should receive the skills.

## Prerequisites

Install a current Node.js release with `npx`. Your coding agent must support the Agent Skills
format. Commit or otherwise preserve project changes before you update or remove an existing skill.

## Inspect the available skills

List the canonical current set before you install anything:

```bash
npx skills add antikylabs/skills --list
```

The command should report nine skills for the source snapshot reviewed on 2026-08-21. Review the
names and descriptions before selecting one.

## Install one skill

Use `--skill` with the exact skill name:

```bash
npx skills add antikylabs/skills --skill write-adrs
```

Follow the command's agent and scope prompts. The installation is complete when the command reports
the selected agent and `npx skills list` shows `write-adrs` in the project.

## Install several skills

Repeat `--skill` and select an agent when you want a bounded set:

```bash
npx skills add antikylabs/skills -a claude-code \
  --skill write-adrs \
  --skill write-objectives
```

Replace `claude-code` with a supported agent identifier for your environment.

## Install every public skill

Use `--all` only when every Ready skill belongs in the project:

```bash
npx skills add antikylabs/skills --all
```

This shorthand selects all discovered skills and agents and skips confirmation. Use a bounded
`--skill` command when you do not want that scope.

## Install for your user account

Add `-g` to install outside one project:

```bash
npx skills add antikylabs/skills --skill write-docs -g
```

A global skill can affect work in several repositories. Prefer project installation when a
procedure belongs to one codebase or needs project review.

## Use a skill without installing it

Pipe one skill's generated prompt to a compatible agent:

```bash
npx skills use antikylabs/skills@write-adrs | claude
```

This is useful for one bounded session. It does not create a durable project installation.

## Verify the installation

List project skills after installation:

```bash
npx skills list
```

Use `npx skills list -g` for global skills. You are finished when the intended skill appears at the
intended scope and the receiving agent can discover its name and description.

## Update or remove skills safely

Inspect local changes before an update, then update project skills with:

```bash
npx skills update -p -y
```

Review the changed skill files and run the target project's normal checks before accepting the
update. To remove one project skill, run:

```bash
npx skills remove write-adrs -y
```

Add `-g` only when you intend to update or remove the global installation. Do not delete agent
directories by hand; the command-line interface also maintains its installation records and links.

## Related documentation

- [Understand Antiky agent skills](overview.md).
- Use the [Ready skills reference](reference.md) to find names and subcommands.
- Inspect the [canonical source repository](https://github.com/antikylabs/skills).
