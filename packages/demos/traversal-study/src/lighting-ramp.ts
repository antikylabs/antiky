import { createTexture3D, type BroMetalTexture, type Renderer } from 'brometal';

import { TRAVERSAL_LIGHTING_RAMP } from './lighting-ramp.gen.ts';

/**
 * Upload the lighting ramp as a 1D lookup.
 *
 * It is a 3D texture because that is BroMetal's only raw-buffer upload — `createTexture` takes a
 * `TexImageSource`, so handing it a byte array would mean building a canvas first. A ramp is one
 * dimensional, so height and depth are 1 and the shader samples at the middle of both.
 *
 * `wrap: 'clamp'` matters: a surface at exactly full light samples the very edge of the ramp, and
 * repeating would wrap it back to the shadow colour — a bright highlight flashing dark, which is
 * the kind of defect that only shows on the one frame nobody screenshots.
 */
export function createLightingRamp(renderer: Renderer): BroMetalTexture {
  const width = TRAVERSAL_LIGHTING_RAMP.length;
  const data = new Uint8Array(width * 4);
  for (let step = 0; step < width; step += 1) {
    const colour = TRAVERSAL_LIGHTING_RAMP[step]!;
    for (let channel = 0; channel < 3; channel += 1) {
      data[step * 4 + channel] = Math.max(0, Math.min(255, Math.round(colour[channel]! * 255)));
    }
    data[step * 4 + 3] = 255;
  }
  return createTexture3D(renderer, { width, height: 1, depth: 1, data }, {
    wrap: 'clamp',
    filter: 'smooth',
  });
}
