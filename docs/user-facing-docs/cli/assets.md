# Install a catalog asset

Use `antiky asset install` to add an install-verified asset to an Antiky project. The command checks
the published file sizes and hashes before it writes anything into your project.

Run the command with the asset's `provider:slug` ID:

```sh
antiky asset install poly-haven:forest-floor --project path/to/harbor-lights.antiky
```

Antiky reads the asset record from `https://assets.antikylabs.com`, downloads the selected files
from their original provider, and writes them under `assets/<provider>/<asset>/`. It also records
the source, license, hashes, and installed files in `assets/antiky-assets.json`.

The command installs only records marked `install-verified`. Other catalog records remain available
for discovery, but they do not contain the selected files and hashes required by the installer.

## Use the GitHub fallback

If the Antiky asset site is unavailable, the command returns `ANTIKY_CATALOG_UNAVAILABLE` without
contacting GitHub. Run it again with explicit fallback approval:

```sh
antiky asset install poly-haven:forest-floor \
  --project path/to/harbor-lights.antiky \
  --allow-github-fallback
```

The command still tries `assets.antikylabs.com` first. It reads the versioned installable-asset
snapshot from `raw.githubusercontent.com` only when the primary request cannot complete. The flag
does not bypass an invalid catalog response or turn an unknown asset ID into a valid one.

## Handle failures

The command reports one of these stable errors:

- `ANTIKY_ARGUMENT_INVALID`: the asset ID or option is invalid.
- `ANTIKY_CATALOG_UNAVAILABLE`: neither the selected catalog source nor the approved fallback can
  provide a response.
- `ANTIKY_CATALOG_INVALID`: the remote JSON has an unsupported version, invalid fields, or a record
  that does not match the requested asset ID.
- `ANTIKY_ASSET_NOT_FOUND`: the selected catalog source does not contain the requested asset.
- `ANTIKY_ASSET_INSTALL_FAILED`: the record is not install-verified, a download fails validation,
  or the files cannot be written safely.

An installation uses a temporary directory. Antiky checks every relative path, byte count, and
published hash before it replaces an existing installation of the same asset.
