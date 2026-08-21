export const HUD_DEPTH = 1.35;
export const HUD_BAR_HALF_WIDTH = 1.28;
export const HUD_BAR_HALF_HEIGHT = 0.12;
export const HUD_BAR_GAP = 0.3;
export const HUD_METER_CENTER_X_OFFSET = 0.55;
export const HUD_METER_HALF_WIDTH = 0.62;
export const HUD_LABEL_CENTER_X_OFFSET = -0.85;
export const HUD_LABEL_CELL_HALF_WIDTH = 0.018;
export const HUD_LABEL_CELL_HALF_HEIGHT = 0.022;
export const HUD_LANDSCAPE_X_OFFSET = 4.45;
export const HUD_PORTRAIT_X_OFFSET = 2.25;
export const HUD_LANDSCAPE_Y_OFFSET = 3.65;
export const HUD_PORTRAIT_Y_OFFSET = 4.15;

export const HAZARD_SPIKE_SCALE = Object.freeze([1.75, 1.75, 1.8] as const);
export const HAZARD_TELEGRAPH_DEPTH = -0.34;
export const HAZARD_TELEGRAPH_HALF_HEIGHT = 0.09;
export const HAZARD_TELEGRAPH_HALF_DEPTH = 0.42;

type HudLabelCell = readonly [x: number, y: number];

const PIXEL_GLYPHS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  E: Object.freeze(['111', '100', '110', '100', '111']),
  M: Object.freeze(['101', '111', '111', '101', '101']),
  O: Object.freeze(['111', '101', '101', '101', '111']),
  R: Object.freeze(['110', '101', '110', '101', '101']),
  S: Object.freeze(['111', '100', '111', '001', '111']),
  T: Object.freeze(['111', '010', '010', '010', '010']),
  U: Object.freeze(['101', '101', '101', '101', '111']),
});

function createLabelCells(label: string): readonly HudLabelCell[] {
  const cells: HudLabelCell[] = [];
  const width = label.length * 4 - 1;
  for (let glyphIndex = 0; glyphIndex < label.length; glyphIndex += 1) {
    const glyph = PIXEL_GLYPHS[label[glyphIndex]!]!;
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row]!.length; column += 1) {
        if (glyph[row]![column] !== '1') continue;
        cells.push(Object.freeze([
          (glyphIndex * 4 + column - (width - 1) * 0.5) * 0.047,
          (2 - row) * 0.053,
        ] as const));
      }
    }
  }
  return Object.freeze(cells);
}

export const HUD_LABEL_CELLS = Object.freeze({
  progress: createLabelCells('ROUTE'),
  storm: createLabelCells('STORM'),
});

export const HUD_LABEL_CELL_COUNT = HUD_LABEL_CELLS.progress.length + HUD_LABEL_CELLS.storm.length;

export function hudAnchorX(targetX: number, aspect: number): number {
  return targetX - (aspect < 0.9 ? HUD_PORTRAIT_X_OFFSET : HUD_LANDSCAPE_X_OFFSET);
}

export function hudAnchorY(targetY: number, aspect: number): number {
  return targetY + (aspect < 0.9 ? HUD_PORTRAIT_Y_OFFSET : HUD_LANDSCAPE_Y_OFFSET);
}

export function hazardTelegraphHalfWidth(hazardWidth: number): number {
  return (hazardWidth + 0.3) * 0.5;
}
