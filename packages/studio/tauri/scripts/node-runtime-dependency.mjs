export const NODE_RUNTIME_DEPENDENCY = Object.freeze({
  version: '24.19.0',
  archive: 'node-v24.19.0-darwin-arm64.tar.gz',
  archiveSha256: '8294b7aa9b03997481c06babf1e8b270c859358f27da57a11509afe537ac381d',
  target: 'darwin-arm64',
});

const DEPENDENCY_KEYS = Object.freeze(Object.keys(NODE_RUNTIME_DEPENDENCY));

export function cacheMatchesNodeRuntimeDependency(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  const keys = Object.keys(candidate);
  return keys.length === DEPENDENCY_KEYS.length
    && DEPENDENCY_KEYS.every((key) => candidate[key] === NODE_RUNTIME_DEPENDENCY[key]);
}
