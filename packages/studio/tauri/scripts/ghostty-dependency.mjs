export const GHOSTTY_DEPENDENCY = Object.freeze({
  ghosttyRevision: 'f948d4207655f31ae9b95fa039e73524df43cd13',
  ghosttyArchiveSha256: 'd7051e56f4edbca4a316c9785265e06ce0776f74004026a2395bb881c009fa99',
  zigVersion: '0.16.0',
  zigArchiveSha256: 'b23d70deaa879b5c2d486ed3316f7eaa53e84acf6fc9cc747de152450d401489',
  target: 'macos-arm64',
});

const DEPENDENCY_KEYS = Object.freeze(Object.keys(GHOSTTY_DEPENDENCY));

export function cacheMatchesDependency(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  const keys = Object.keys(candidate);
  return keys.length === DEPENDENCY_KEYS.length
    && DEPENDENCY_KEYS.every((key) => candidate[key] === GHOSTTY_DEPENDENCY[key]);
}

