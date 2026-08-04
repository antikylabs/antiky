/* Authored sprite art, stored as primitives rather than pixels.
 *
 * Each character is a short list of rectangles on a 16x24 grid. A deterministic
 * compiler turns that list into an atlas: outlines first, then fills, then the
 * whole strip uploaded once as a nearest-filtered texture. It is the same shape
 * as the voxel pipeline next door — authored primitives in, a validated
 * artifact out, nothing hand-placed at the pixel level. */

export const CELL_W = 16;
export const CELL_H = 24;

type Part = {
  x: number;
  y: number;
  w: number;
  h: number;
  c: string;
  /** Mirror this rectangle about the cell's vertical centre line. */
  mirror?: boolean;
  /** Give it a one-pixel dark border. */
  edge?: boolean;
};

const INK = '#12101a';

const TRAVELER: Part[] = [
  { x: 4, y: 8, w: 8, h: 10, c: '#c4502a', edge: true }, // cloak
  { x: 7, y: 9, w: 2, h: 9, c: '#8d3419' }, // fold
  { x: 5, y: 2, w: 6, h: 7, c: '#d4602f', edge: true }, // hood
  { x: 6, y: 6, w: 4, h: 3, c: '#e8b48c' }, // face
  { x: 6, y: 7, w: 1, h: 1, c: INK, mirror: true }, // eyes
  { x: 4, y: 12, w: 8, h: 1, c: '#6d2a12' }, // belt
  { x: 5, y: 18, w: 2, h: 4, c: '#2c2733', mirror: true, edge: true }, // legs
  { x: 4, y: 21, w: 3, h: 2, c: '#4b4256', mirror: true, edge: true }, // boots
];

const KNIGHT: Part[] = [
  { x: 4, y: 8, w: 8, h: 9, c: '#8d97ab', edge: true }, // cuirass
  { x: 5, y: 9, w: 6, h: 3, c: '#aeb8cc' }, // chest highlight
  { x: 5, y: 3, w: 6, h: 6, c: '#9aa4b8', edge: true }, // helm
  { x: 6, y: 6, w: 4, h: 2, c: '#1b1b26' }, // visor
  { x: 7, y: 1, w: 2, h: 3, c: '#c4502a', edge: true }, // crest
  { x: 2, y: 9, w: 3, h: 6, c: '#3f6bb5', edge: true }, // shield
  { x: 3, y: 11, w: 1, h: 2, c: '#e8b93c' }, // shield boss
  { x: 12, y: 4, w: 1, h: 13, c: '#d8dce8', edge: true }, // blade
  { x: 5, y: 17, w: 2, h: 5, c: '#5b6377', mirror: true, edge: true }, // greaves
];

const MAGE: Part[] = [
  { x: 4, y: 9, w: 8, h: 10, c: '#5a3d9a', edge: true }, // robe
  { x: 4, y: 15, w: 8, h: 2, c: '#3b2668' }, // hem
  { x: 5, y: 2, w: 6, h: 6, c: '#6f4bb8', edge: true }, // hat
  { x: 7, y: 0, w: 2, h: 3, c: '#6f4bb8', edge: true }, // point
  { x: 6, y: 7, w: 4, h: 3, c: '#dcb28e' }, // face
  { x: 6, y: 8, w: 1, h: 1, c: INK, mirror: true }, // eyes
  { x: 12, y: 3, w: 1, h: 15, c: '#7a5a3a', edge: true }, // staff
  { x: 11, y: 1, w: 3, h: 3, c: '#e8b93c', edge: true }, // focus stone
  { x: 5, y: 19, w: 2, h: 3, c: '#2c2733', mirror: true, edge: true }, // feet
];

const CREATURE: Part[] = [
  { x: 3, y: 10, w: 10, h: 8, c: '#4a7a3a', edge: true }, // body
  { x: 5, y: 12, w: 6, h: 4, c: '#5f9349' }, // belly
  { x: 4, y: 5, w: 8, h: 6, c: '#4a7a3a', edge: true }, // head
  { x: 5, y: 7, w: 2, h: 2, c: '#e8e2d0', mirror: true }, // eyes
  { x: 6, y: 8, w: 1, h: 1, c: INK, mirror: true }, // pupils
  { x: 4, y: 3, w: 2, h: 3, c: '#d8d2c0', mirror: true, edge: true }, // horns
  { x: 2, y: 12, w: 2, h: 4, c: '#3c6630', mirror: true, edge: true }, // arms
  { x: 4, y: 18, w: 3, h: 4, c: '#3c6630', mirror: true, edge: true }, // legs
];

export const SPRITES: readonly Part[][] = [TRAVELER, KNIGHT, MAGE, CREATURE];
export const SPRITE_CELLS = SPRITES.length;

function paint(ctx: CanvasRenderingContext2D, part: Part, originX: number, inflate: number, color: string) {
  const draw = (x: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(originX + x - inflate, part.y - inflate, part.w + inflate * 2, part.h + inflate * 2);
  };
  draw(part.x);
  if (part.mirror) draw(CELL_W - part.x - part.w);
}

/**
 * Compiles the primitive lists into one strip. Outlines are a first pass over
 * every part, so a later part's fill can sit flush against an earlier part's
 * border instead of punching a hole in it.
 */
export function buildSpriteAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CELL_W * SPRITE_CELLS;
  canvas.height = CELL_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable — the sprite atlas cannot be compiled.');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  SPRITES.forEach((parts, index) => {
    const originX = index * CELL_W;
    for (const part of parts) if (part.edge) paint(ctx, part, originX, 1, INK);
    for (const part of parts) paint(ctx, part, originX, 0, part.c);
  });

  return canvas;
}
