# Release Versioning

**Status: Proposed Slice 12 direction**

Create the full `slice-12/plan.md` from the
[shared template](SLICE_PLAN_TEMPLATE_A.md) when this slice becomes active.

## Outcome

Give each independently consumed Antiky product an honest version and one repeatable path from a
reviewed change to a stable release.

Do not require an unrelated website, CLI, Framework, or Studio release to move at the same time.
Test compatible products together before promotion.

## Version units

| Product | Public identity | Release rule |
| --- | --- | --- |
| Antiky Framework | `@antiky/framework@X.Y.Z` | Publish when its public package changes. |
| Antiky CLI | `@antiky/cli@X.Y.Z` | Publish when its command or programmatic API changes. |
| Antiky Studio | `studio@X.Y.Z` | Release the installable editor independently. |
| Website and demos | Git commit and deployment ID | Deploy without a public SemVer version. |

The first public preview of each installable product starts at `0.1.0`. Each product reaches `1.0.0`
when its own public contract is stable enough to support.

Before `1.0.0`, use a patch for compatible fixes. Use a minor version for a public feature or a
breaking change. Mark every breaking change in the release notes. After `1.0.0`, use normal Semantic
Versioning rules.

Do not create one suite version. A coordinated Antiky launch can record the tested component
versions without forcing them to share a number.

## Compatibility

Product versions identify artifacts. They do not define connection compatibility.

- Keep the development protocol, project format, config schema, and message schemas versioned at
  their own boundaries.
- Advertise supported schema versions and capabilities during connection setup.
- Use product versions for diagnostics and release records only.
- Release readers that accept old and new contracts before a writer starts the new contract.
- Remove old contract support only in a documented breaking release.

A Studio release can connect to a different CLI version when both products support the same Antiky
protocol and schemas. A CLI package declares its compatible Framework dependency range.

## Release path

Use Changesets in independent-package mode. Do not configure fixed or linked version groups.

```text
change and changeset
  -> reviewed release pull request
  -> candidate artifacts
  -> package and compatibility checks
  -> approved immutable release
  -> stable channel
```

- Add one changeset when a pull request changes a published product contract.
- Do not require a changeset for website-only, demo-only, test-only, or private internal work.
- Publish npm candidates with a unique prerelease version under the `next` distribution tag.
- Publish Studio candidates through a `preview` updater channel.
- Promote npm stable releases through `latest` and Studio releases through `stable`.
- Use component Git tags such as `@antiky/framework@0.4.0`, `@antiky/cli@0.6.1`, and
  `studio@0.3.0`. Do not create a generic `v0.6.1` monorepo tag.
- Keep versions and Git tags immutable. Fix a bad release with a new version.
- Publish npm packages from CI with trusted publishing. Do not store a long-lived publish token.
- Sign Studio artifacts and publish them through immutable releases.
- Record the website Git commit in each production deployment.

The stable release must use the final staged artifact that passed the release checks. Promotion must
not rebuild different code. A preview prerelease does not become stable by renaming it.

## Slice deliverables

- Make the Framework and CLI into installable, built npm packages.
- Add independent package versions, changelogs, and Changesets configuration.
- Report the real CLI version through `antiky --version` and MCP server information.
- Add the Studio version to its application metadata, About view, and updater contract when Studio
  exists.
- Add the website commit and deployment ID to its operational build information.
- Add candidate and stable release workflows with explicit approval boundaries.
- Add package-install, independent-bump, internal-dependency, tag, and promotion tests.
- Add compatibility tests at the oldest and newest supported protocol and schema boundaries.
- Document stable and preview installation for developers.

## Non-goals

- Do not declare any product `1.0.0` in this slice.
- Do not add a new shared protocol package only to hold version numbers.
- Do not add long-lived release branches.
- Do not version the website for marketing symmetry.
- Do not publish or promote production artifacts without the required owner authority.

## Completion checks

- [ ] Framework, CLI, and Studio versions can change independently.
- [ ] A dependency change bumps each affected consumer and keeps installable ranges valid.
- [ ] Candidate publication does not move a stable channel.
- [ ] Promotion uses the tested artifact and creates component-specific immutable tags.
- [ ] CLI, Studio, and Framework reject incompatible contracts with a stable, actionable error.
- [ ] Website and product diagnostics identify their exact source revision and product versions.
- [ ] Release credentials are short-lived and release artifacts are signed or attested.
- [ ] One clean verification command proves packaging, compatibility, and release dry runs.

## References

- [Semantic Versioning](https://semver.org/)
- [Changesets](https://github.com/changesets/changesets)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm staged publishing](https://docs.npmjs.com/staged-publishing/)
- [Tauri updater](https://v2.tauri.app/plugin/updater/)
- [GitHub immutable releases](https://docs.github.com/en/enterprise-cloud@latest/code-security/concepts/supply-chain-security/immutable-releases)
