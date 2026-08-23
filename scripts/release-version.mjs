import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const DEPENDENCY_SECTIONS = Object.freeze([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]);

function fail(message) {
  throw new Error(`[ANTIKY_VERSION_INVALID] ${message}`);
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function portablePath(path) {
  return path.split(sep).join('/');
}

function resolveInside(root, path) {
  if (isAbsolute(path)) fail(`Workspace path must be relative: ${path}.`);
  const destination = resolve(root, path);
  const fromRoot = relative(root, destination);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    fail(`Workspace path leaves the repository: ${path}.`);
  }
  return destination;
}

async function workspaceDirectories(root, patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    fail('The root package must declare at least one workspace.');
  }
  const directories = new Set();
  for (const pattern of patterns) {
    if (typeof pattern !== 'string' || pattern.length === 0) {
      fail('Every workspace pattern must be a non-empty string.');
    }
    const stars = pattern.match(/\*/g)?.length ?? 0;
    if (stars === 0) {
      directories.add(portablePath(pattern.replace(/\/$/, '')));
      continue;
    }
    if (stars !== 1 || !pattern.endsWith('/*')) {
      fail(`Unsupported workspace pattern: ${pattern}.`);
    }
    const parent = pattern.slice(0, -2);
    const parentPath = resolveInside(root, parent);
    const entries = await readdir(parentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const directory = portablePath(`${parent}/${entry.name}`);
      if (await exists(resolveInside(root, `${directory}/package.json`))) {
        directories.add(directory);
      }
    }
  }
  return Array.from(directories).sort();
}

function cargoManifestVersion(source) {
  return source.match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1] ?? null;
}

function setCargoManifestVersion(source, version) {
  const updated = source.replace(
    /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+("\s*)/,
    `$1${version}$2`,
  );
  if (updated === source && cargoManifestVersion(source) !== version) {
    fail('Cargo.toml does not contain the Antiky Studio package version.');
  }
  return updated;
}

function cargoLockVersion(source) {
  const block = source.match(
    /\[\[package\]\]\nname = "antiky-studio"\nversion = "([^"]+)"/,
  );
  return block?.[1] ?? null;
}

function setCargoLockVersion(source, version) {
  const updated = source.replace(
    /(\[\[package\]\]\nname = "antiky-studio"\nversion = ")[^"]+("\n)/,
    `$1${version}$2`,
  );
  if (updated === source && cargoLockVersion(source) !== version) {
    fail('Cargo.lock does not contain the Antiky Studio package version.');
  }
  return updated;
}

function synchronizeDependencies(manifest, internalNames, version) {
  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = manifest[section];
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) continue;
    for (const name of Object.keys(dependencies)) {
      if (internalNames.has(name)) dependencies[name] = version;
    }
  }
}

async function readRepository(root) {
  const rootPackagePath = resolve(root, 'package.json');
  const rootPackage = await readJson(rootPackagePath);
  const workspacePaths = await workspaceDirectories(root, rootPackage.workspaces);
  const packages = [{
    directory: '',
    path: rootPackagePath,
    displayPath: 'package.json',
    manifest: rootPackage,
  }];
  for (const directory of workspacePaths) {
    const path = resolveInside(root, `${directory}/package.json`);
    packages.push({
      directory,
      path,
      displayPath: `${directory}/package.json`,
      manifest: await readJson(path),
    });
  }
  const names = packages.map(({ manifest, displayPath }) => {
    if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
      fail(`${displayPath} has no package name.`);
    }
    return manifest.name;
  });
  if (new Set(names).size !== names.length) fail('Package names must be unique.');

  const paths = {
    packageLock: resolve(root, 'package-lock.json'),
    tauriConfig: resolve(root, 'packages/studio/tauri/tauri.conf.json'),
    cargoManifest: resolve(root, 'packages/studio/tauri/Cargo.toml'),
    cargoLock: resolve(root, 'packages/studio/tauri/Cargo.lock'),
  };
  const [packageLock, tauriConfig, cargoManifest, cargoLock] = await Promise.all([
    readJson(paths.packageLock),
    readJson(paths.tauriConfig),
    readFile(paths.cargoManifest, 'utf8'),
    readFile(paths.cargoLock, 'utf8'),
  ]);
  return {
    root,
    packages,
    internalNames: new Set(names),
    paths,
    packageLock,
    tauriConfig,
    cargoManifest,
    cargoLock,
  };
}

function validateDependencySections(value, internalNames, version, path, issues) {
  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = value?.[section];
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) continue;
    for (const [name, requirement] of Object.entries(dependencies)) {
      if (internalNames.has(name) && requirement !== version) {
        issues.push(`${path} requires ${name} at ${requirement}, expected ${version}`);
      }
    }
  }
}

function validateState(state, expectedTag) {
  const version = state.packages[0].manifest.version;
  if (typeof version !== 'string' || !SEMVER.test(version)) {
    fail(`package.json has invalid semantic version ${String(version)}.`);
  }
  const issues = [];
  for (const package_ of state.packages) {
    if (package_.manifest.version !== version) {
      issues.push(`${package_.displayPath} has version ${package_.manifest.version}, expected ${version}`);
    }
    validateDependencySections(
      package_.manifest,
      state.internalNames,
      version,
      package_.displayPath,
      issues,
    );
    const locked = state.packageLock.packages?.[package_.directory];
    if (!locked) {
      issues.push(`package-lock.json is missing ${package_.directory || 'the root package'}`);
    } else {
      if (locked.version !== version) {
        issues.push(`package-lock.json records ${package_.displayPath} at ${locked.version}, expected ${version}`);
      }
      validateDependencySections(
        locked,
        state.internalNames,
        version,
        `package-lock.json:${package_.directory || '<root>'}`,
        issues,
      );
    }
  }
  if (state.packageLock.version !== version) {
    issues.push(`package-lock.json has version ${state.packageLock.version}, expected ${version}`);
  }
  if (state.tauriConfig.version !== version) {
    issues.push(`tauri.conf.json has version ${state.tauriConfig.version}, expected ${version}`);
  }
  const manifestVersion = cargoManifestVersion(state.cargoManifest);
  if (manifestVersion !== version) {
    issues.push(`Cargo.toml has version ${manifestVersion}, expected ${version}`);
  }
  const lockVersion = cargoLockVersion(state.cargoLock);
  if (lockVersion !== version) {
    issues.push(`Cargo.lock has version ${lockVersion}, expected ${version}`);
  }
  if (expectedTag !== undefined && expectedTag !== `v${version}`) {
    issues.push(`release tag ${expectedTag} does not match v${version}`);
  }
  if (issues.length > 0) fail(issues.join('\n'));
  return Object.freeze({ version, packageCount: state.packages.length });
}

export async function validateRepositoryVersion(root, expectedTag) {
  return validateState(await readRepository(resolve(root)), expectedTag);
}

export async function setRepositoryVersion(root, version) {
  if (typeof version !== 'string' || !SEMVER.test(version)) {
    fail(`Expected a semantic version, received ${String(version)}.`);
  }
  const state = await readRepository(resolve(root));
  for (const package_ of state.packages) {
    package_.manifest.version = version;
    synchronizeDependencies(package_.manifest, state.internalNames, version);
  }
  state.packageLock.version = version;
  for (const package_ of state.packages) {
    const locked = state.packageLock.packages?.[package_.directory];
    if (!locked) fail(`package-lock.json is missing ${package_.directory || 'the root package'}.`);
    locked.version = version;
    synchronizeDependencies(locked, state.internalNames, version);
  }
  state.tauriConfig.version = version;
  state.cargoManifest = setCargoManifestVersion(state.cargoManifest, version);
  state.cargoLock = setCargoLockVersion(state.cargoLock, version);

  await Promise.all([
    ...state.packages.map((package_) => writeFile(package_.path, json(package_.manifest), 'utf8')),
    writeFile(state.paths.packageLock, json(state.packageLock), 'utf8'),
    writeFile(state.paths.tauriConfig, json(state.tauriConfig), 'utf8'),
    writeFile(state.paths.cargoManifest, state.cargoManifest, 'utf8'),
    writeFile(state.paths.cargoLock, state.cargoLock, 'utf8'),
  ]);
  return validateRepositoryVersion(root);
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  const root = process.cwd();
  if (command === 'check') {
    const result = await validateRepositoryVersion(root);
    console.log(`Version ${result.version} is synchronized across ${result.packageCount} packages.`);
    return;
  }
  if (command === 'check-tag') {
    const tag = argument ?? process.env.GITHUB_REF_NAME;
    if (!tag) fail('check-tag needs a tag argument or GITHUB_REF_NAME.');
    const result = await validateRepositoryVersion(root, tag);
    console.log(`Release tag ${tag} matches version ${result.version}.`);
    return;
  }
  if (command === 'set') {
    if (!argument) fail('set needs a semantic version argument.');
    const result = await setRepositoryVersion(root, argument);
    console.log(`Set version ${result.version} across ${result.packageCount} packages.`);
    return;
  }
  fail('Use check, check-tag, or set <version>.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((reason) => {
    console.error(reason instanceof Error ? reason.message : reason);
    process.exitCode = 1;
  });
}
