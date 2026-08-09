const entities: Readonly<Record<string, string>> = Object.freeze({
  amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
});

export function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => entities[name.toLowerCase()] ?? match)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function metaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  return decodeHtml(patterns.map((pattern) => pattern.exec(html)?.[1]).find(Boolean) ?? '');
}

export function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => decodeHtml(value).trim().toLocaleLowerCase()).filter(Boolean))];
}

export function slugFromUrl(url: string): string {
  const segment = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '';
  return segment.replace(/\.html$/, '').toLocaleLowerCase();
}
