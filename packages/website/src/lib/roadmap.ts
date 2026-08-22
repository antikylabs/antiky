import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type RoadmapSubitem = Readonly<{
  title: string;
  description: string;
}>;

export type RoadmapDelivery = Readonly<{
  title: string;
  description: string;
  subitems: readonly RoadmapSubitem[];
}>;

export type Roadmap = Readonly<{
  title: string;
  intro: string;
  notice: string;
  deliveries: readonly RoadmapDelivery[];
}>;

export type RoadmapErrorCode =
  | 'ROADMAP_TABS'
  | 'ROADMAP_UNKNOWN_FIELD'
  | 'ROADMAP_DUPLICATE_FIELD'
  | 'ROADMAP_MISSING_FIELD'
  | 'ROADMAP_FIELD_VALUE'
  | 'ROADMAP_INDENTATION'
  | 'ROADMAP_DEPTH'
  | 'ROADMAP_ITEM_BEFORE_STAGES'
  | 'ROADMAP_SUBITEM_BEFORE_DELIVERY'
  | 'ROADMAP_ITEM_TITLE'
  | 'ROADMAP_ITEM_DESCRIPTION'
  | 'ROADMAP_EMPTY_STAGES';

export class RoadmapParseError extends Error {
  readonly code: RoadmapErrorCode;
  readonly line: number;

  constructor(code: RoadmapErrorCode, line: number, message: string) {
    super(`${code} at line ${line}: ${message}`);
    this.name = 'RoadmapParseError';
    this.code = code;
    this.line = line;
  }
}

const REQUIRED_FIELDS = ['title', 'intro', 'notice', 'stages'] as const;
type Field = (typeof REQUIRED_FIELDS)[number];

function fail(code: RoadmapErrorCode, line: number, message: string): never {
  throw new RoadmapParseError(code, line, message);
}

function parseItem(source: string, line: number): { title: string; description: string } {
  if (!source.startsWith('- ')) fail('ROADMAP_INDENTATION', line, 'items must start with "- "');
  const value = source.slice(2);
  const colon = value.indexOf(':');
  if (colon < 0) fail('ROADMAP_ITEM_DESCRIPTION', line, 'item description is missing');
  const title = value.slice(0, colon).trim();
  const description = value.slice(colon + 1).trim();
  if (!title) fail('ROADMAP_ITEM_TITLE', line, 'item title is empty');
  if (!description) fail('ROADMAP_ITEM_DESCRIPTION', line, 'item description is empty');
  return { title, description };
}

export function parseRoadmap(source: string): Roadmap {
  const lines = source.split(/\r?\n/);
  const fields = new Map<Field, string>();
  const deliveries: Array<{ title: string; description: string; subitems: RoadmapSubitem[] }> = [];
  let stagesLine: number | undefined;
  let currentDelivery: (typeof deliveries)[number] | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = index + 1;
    const raw = lines[index] ?? '';
    if (!raw.trim()) continue;
    if (raw.includes('\t')) fail('ROADMAP_TABS', line, 'tabs are not allowed');

    const indent = raw.length - raw.trimStart().length;
    if (indent === 0) {
      const colon = raw.indexOf(':');
      const name = colon < 0 ? raw : raw.slice(0, colon);
      if (!REQUIRED_FIELDS.includes(name as Field)) {
        fail('ROADMAP_UNKNOWN_FIELD', line, `unknown top-level field "${name}"`);
      }
      const field = name as Field;
      if (fields.has(field)) fail('ROADMAP_DUPLICATE_FIELD', line, `field "${field}" is duplicated`);
      const value = colon < 0 ? '' : raw.slice(colon + 1).trim();
      if (field === 'stages') {
        if (value) fail('ROADMAP_FIELD_VALUE', line, 'stages cannot have an inline value');
        fields.set(field, '');
        stagesLine = line;
      } else {
        if (!value) fail('ROADMAP_FIELD_VALUE', line, `field "${field}" is empty`);
        fields.set(field, value);
      }
      currentDelivery = undefined;
      continue;
    }

    if (indent >= 6) fail('ROADMAP_DEPTH', line, 'only delivery and subitem levels are allowed');
    if (indent !== 2 && indent !== 4) {
      fail('ROADMAP_INDENTATION', line, 'items must use two or four spaces');
    }
    if (stagesLine === undefined) fail('ROADMAP_ITEM_BEFORE_STAGES', line, 'item appears before stages');

    const item = parseItem(raw.slice(indent), line);
    if (indent === 2) {
      currentDelivery = { ...item, subitems: [] };
      deliveries.push(currentDelivery);
    } else {
      if (!currentDelivery) {
        fail('ROADMAP_SUBITEM_BEFORE_DELIVERY', line, 'subitem appears before a delivery');
      }
      currentDelivery.subitems.push(Object.freeze(item));
    }
  }

  const eofLine = lines.length + 1;
  for (const field of REQUIRED_FIELDS) {
    if (!fields.has(field)) fail('ROADMAP_MISSING_FIELD', eofLine, `field "${field}" is missing`);
  }
  if (deliveries.length === 0) {
    fail('ROADMAP_EMPTY_STAGES', stagesLine ?? eofLine, 'stages must contain at least one delivery');
  }

  return Object.freeze({
    title: fields.get('title')!,
    intro: fields.get('intro')!,
    notice: fields.get('notice')!,
    deliveries: Object.freeze(deliveries.map((delivery) => Object.freeze({
      title: delivery.title,
      description: delivery.description,
      subitems: Object.freeze(delivery.subitems),
    }))),
  });
}

export async function loadRoadmap(): Promise<Roadmap> {
  const sourcePath = resolve(process.cwd(), 'content/roadmap.txt');
  const source = await readFile(sourcePath, 'utf8');
  return parseRoadmap(source);
}
