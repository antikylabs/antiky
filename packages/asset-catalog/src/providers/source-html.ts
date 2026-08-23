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
  const normalizedKey = key.toLocaleLowerCase();
  for (const meta of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = new Map<string, string>();
    for (const attribute of meta[0].matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gi)) {
      attributes.set(attribute[1]!.toLocaleLowerCase(), attribute[3] ?? '');
    }
    const identity = attributes.get('name') ?? attributes.get('property');
    if (identity?.toLocaleLowerCase() === normalizedKey) return decodeHtml(attributes.get('content') ?? '');
  }
  return '';
}

export function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => decodeHtml(value).trim().toLocaleLowerCase()).filter(Boolean))];
}

export function slugFromUrl(url: string): string {
  const segment = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '';
  return segment.replace(/\.html$/, '').toLocaleLowerCase();
}
