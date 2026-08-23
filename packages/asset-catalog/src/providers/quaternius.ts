import { createCuratedCc0Asset } from './curated.ts';

export const QUATERNIUS_PROVIDER = Object.freeze({
  id: 'quaternius', name: 'Quaternius', url: 'https://quaternius.com',
});

export function createQuaterniusPack(input: Parameters<typeof createCuratedCc0Asset>[1]) {
  return createCuratedCc0Asset(QUATERNIUS_PROVIDER, input);
}
