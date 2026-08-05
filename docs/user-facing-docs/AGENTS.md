# User-facing documentation guidance

## Audience and scope

This folder is standalone product documentation for developers integrating Antiky into their own
games. Write for a reader who has the framework and CLI but no knowledge of this repository's
delivery plan or demo projects.

Read and follow [the user documentation standards](DOCUMENTATION_STANDARDS_A.md) before creating,
reorganizing, or substantially rewriting a page in this folder.

- Describe behavior that a developer can use from the released CLI, framework, or Studio boundary.
- Use generic, adaptable examples. A repository demo may be labeled as an example, but it must not
  define the product contract.
- Lead with the normal development path, then explain integration details, security boundaries,
  failure behavior, and cleanup where they matter.
- Prefer public names, stable errors, and observable behavior over internal implementation details.
- Keep command, config, MCP tool, and API names synchronized with the source.

## Keep planning language internal

Do not use slice, objective, checkpoint, or evidence terminology in these docs. Internal planning,
delivery status, and repository verification records belong under `docs/objectives/` and related
engineering records.

## Verification

Update the documentation contract in `packages/cli/tests/user-docs.test.ts` whenever a public name
or workflow changes. Run that test and the affected package tests before committing.
