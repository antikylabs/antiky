# Package and release Antiky Studio

Use this guide to build a macOS arm64 package or prepare a tagged GitHub release. The release
workflow creates a draft. It does not publish npm packages or make the GitHub release public.

## Build a package locally

Install the locked dependencies and run the release checks:

```sh
npm ci
npm run version:check
npm run check
npm run package:studio
```

The build writes the application bundle under
`packages/studio/tauri/target/release/bundle/macos/` and the disk image under
`packages/studio/tauri/target/release/bundle/dmg/`.

The first Studio build downloads the pinned Ghostty source, Zig toolchain, and official Node.js
runtime. Each download is checked against its recorded SHA-256 digest and then cached under the
ignored `packages/studio/tauri/.native/` directory.

The local build uses an ad-hoc signature. It is not Apple-notarized, so macOS can require approval
in Privacy & Security when the package comes from another computer.

## Prepare a release version

Set one version across the root package, every workspace, the npm lockfile, Tauri, and Cargo:

```sh
npm run version:set -- 0.1.0
npm run version:check
npm run check
```

Review and commit all version changes together. Do not edit one manifest by hand; CI rejects a
version that differs anywhere in the release set.

## Create the draft release

Create a tag that exactly matches the committed version and push it:

```sh
npm run release:check -- v0.1.0
git tag v0.1.0
git push origin v0.1.0
```

The `Release` GitHub Actions workflow repeats the checks, builds the arm64 application and disk
image, and attaches them to a draft named for the tag. Inspect the draft assets and generated notes
before you publish the release from GitHub.
