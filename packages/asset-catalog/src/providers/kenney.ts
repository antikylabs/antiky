import { createCuratedCc0Asset } from './curated.ts';

export const KENNEY_PROVIDER = Object.freeze({
  id: 'kenney', name: 'Kenney', url: 'https://kenney.nl',
});

export function createKenneyPack(input: Parameters<typeof createCuratedCc0Asset>[1]) {
  return createCuratedCc0Asset(KENNEY_PROVIDER, input);
}
