import { createProgram, type BroMetalProgram, type Renderer } from 'brometal';

import traversalHudShader from './shaders/traversal-hud.shader.gen.ts';

/**
 * Segments the HUD can draw.
 *
 * The letterforms dominate: the progress and storm labels are drawn as grids of small cells, 50 and
 * 52 of them, so the text alone needs a hundred slots. A first pass at 48 threw on the fifty-first
 * cell and the demo failed to start at all — a bounds check doing exactly its job.
 */
export const HUD_CAPACITY = 128;

export type HudBatch = Readonly<{
  program: BroMetalProgram;
  capacity: number;
  drawCalls: number;
  uploadBytes: number;
  setFrame(): void;
  clear(): void;
  set(
    index: number,
    centerX: number, centerY: number,
    halfWidth: number, halfHeight: number,
    color: readonly [number, number, number],
    fill: number, opacity: number, rotation?: number,
  ): void;
  upload(): void;
  draw(): void;
  dispose(): void;
}>;

/**
 * The flat HUD layer, drawn last and in screen space.
 *
 * One quad instanced per segment. Coordinates are normalised device coordinates — (-1, -1) is the
 * bottom left of the frame — so a bar sits where it is put regardless of aspect ratio, camera or
 * field of view.
 */
export function createHudBatch(
  renderer: Renderer,
  programFactory: (target: Renderer) => BroMetalProgram = (target) => createProgram(
    target,
    traversalHudShader,
    // Alpha blended. BroMetal has no depth-test toggle, but blended programs test depth without
    // writing it, and the vertex shader emits clip z = 0 — the near plane — so every HUD fragment
    // passes the test against anything the scene drew. Drawing the batch last keeps the ordering
    // among HUD segments themselves right.
    { blend: 'alpha' },
  ),
): HudBatch {
  const program = programFactory(renderer);
  try {
    // A unit quad as two triangles. Small enough that indices would cost more than they save.
    program.attributes.aCorner!.set(new Float32Array([
      0, 0, 1, 0, 1, 1,
      0, 0, 1, 1, 0, 1,
    ]));
  } catch (cause: unknown) {
    program.dispose();
    throw cause;
  }

  const rects = new Float32Array(HUD_CAPACITY * 4);
  const colors = new Float32Array(HUD_CAPACITY * 3);
  const params = new Float32Array(HUD_CAPACITY * 3);
  const rotations = new Float32Array(HUD_CAPACITY);

  return Object.freeze({
    program,
    // Reported like every other batch so the render profile stays derived rather than hand-counted.
    capacity: HUD_CAPACITY,
    drawCalls: 1,
    uploadBytes: rects.byteLength + colors.byteLength + params.byteLength + rotations.byteLength,
    /** No-op: a screen-space HUD has nothing to do with the camera, which is the whole point. */
    setFrame(): void {},
    clear(): void {
      // Zero half-extents collapse a segment to nothing, which is how an unused slot draws nothing
      // without needing a per-frame instance count.
      rects.fill(0);
      params.fill(0);
      rotations.fill(0);
    },
    set(index, centerX, centerY, halfWidth, halfHeight, color, fill, opacity, rotation = 0): void {
      if (!Number.isInteger(index) || index < 0 || index >= HUD_CAPACITY) {
        throw new RangeError(`HUD segment ${index} is outside a capacity of ${HUD_CAPACITY}.`);
      }
      const at = index * 4;
      rects[at] = centerX;
      rects[at + 1] = centerY;
      rects[at + 2] = halfWidth;
      rects[at + 3] = halfHeight;
      const colorAt = index * 3;
      colors[colorAt] = color[0];
      colors[colorAt + 1] = color[1];
      colors[colorAt + 2] = color[2];
      params[colorAt] = fill;
      params[colorAt + 1] = opacity;
      params[colorAt + 2] = 0.35;
      rotations[index] = rotation;
    },
    upload(): void {
      program.instanceAttributes.iRect!.set(rects);
      program.instanceAttributes.iColor!.set(colors);
      program.instanceAttributes.iParams!.set(params);
      program.instanceAttributes.iRotation!.set(rotations);
    },
    draw(): void {
      program.draw();
    },
    dispose(): void {
      program.dispose();
    },
  });
}
