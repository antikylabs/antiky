import {
  length,
  max,
  mix,
  pow,
  shader,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { rotate2 } from 'brometal/shader-functions';

/**
 * Contact shadows, deliberately unlit.
 *
 * These used to be thin dark boxes drawn through `foundry`, the demo's full PBR material. Three
 * point lights, an ambient term, a fog term and the tone-mapper all acted on them, so walking a
 * light towards a creature made its own shadow glow. That is why the blobs read as stickers on the
 * floor rather than as contact with it.
 *
 * There is no light term here. The shape comes from a radial falloff, not from the geometry's
 * edges. Draw with `blend: 'alpha'`, which depth-tests without writing depth.
 */
/**
 * Linear to sRGB, applied once when a final pixel is written.
 *
 * The exact inverse of `decodeSrgb`. BroMetal never configures an sRGB canvas format —
 * `context.configure` takes `gpu.getPreferredCanvasFormat()`, which returns `bgra8unorm` or
 * `rgba8unorm` and never an `-srgb` variant — so nothing encodes for us and the encode has to live
 * in the shader, for the same reason the decode does.
 *
 * Goal 04 added the decode without this, which left every lit surface computed on correct numbers
 * and then written to the screen as though it were already display-encoded. That is why this demo's
 * luminance p95 fell from 0.090 to 0.050.
 *
 * The piecewise curve, not the 2.2 approximation: the two differ most below 0.0031308, and a scene
 * this dark spends its time there. `max` guards the toe because `pow` of a negative is undefined and
 * a tone-mapped value can land fractionally below zero.
 *
 * Declared here rather than imported: the BroMetal MVP resolves only module-level helpers declared
 * above their first use. `pipeline-invariants.test.mjs` asserts every copy is identical.
 */
function channelToDisplay(channel: number): number {
  const safe = max(channel, 0);
  const low = safe * 12.92;
  // 1 / 2.4, written out rather than divided. `brometal prod` constant-folds the division and
  // `brometal dev` does not, so a division here makes the committed `.gen.ts` depend on which mode
  // last ran — which `shader-output-parity` correctly refuses.
  const high = pow(safe, 0.4166666666666667) * 1.055 - 0.055;
  // `pow` and `step` are scalar-only here, so the curve is applied one component at a time.
  return mix(low, high, step(0.0031308, safe));
}

function encodeSrgb(color: Vec3): Vec3 {
  return vec3(channelToDisplay(color.x), channelToDisplay(color.y), channelToDisplay(color.z));
}

export default shader({
  attributes: { aPosition: 'vec3' },
  instanceAttributes: { iOffset: 'vec3', iScale: 'vec3', iColor: 'vec3' },
  uniforms: { uViewProj: 'mat4', uBillboard: 'sampler2D' },
  varyings: { vLocal: 'vec2', vColor: 'vec3', vRadius: 'float' },

  vertex({ aPosition, iOffset, iScale, iColor }, { uViewProj }, v) {
    // iScale.y carries yaw rather than a height: the quad is flat, so a vertical scale is free.
    const rotated = rotate2(aPosition.xz.mul(iScale.xz), iScale.y);
    const world = vec3(rotated.x + iOffset.x, iOffset.y, rotated.y + iOffset.z);
    v.vLocal = aPosition.xz;
    v.vColor = iColor;
    v.vRadius = iScale.x;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uBillboard }, { vLocal, vColor, vRadius }) {
    // 1 at the centre, 0 at the inscribed circle, so the quad's corners fall outside the shape.
    const falloff = smoothstep(1, 0.12, length(vLocal));
    // A cleared slot has radius 0; without this gate its collapsed quad still paints a dot.
    const present = smoothstep(0, 0.02, vRadius);
    // Texture over the analytic falloff, not instead of it.
    //
    // The smoothstep above is already softer than any 256-pixel sprite and it stays, because it is
    // what guarantees the edge reaches zero exactly at the inscribed circle. What the sprite adds is
    // *variation*: without it every contact shadow in the frame is the same perfect ellipse, which
    // is what makes a crowd of them read as decals rather than as shadows.
    //
    // `vLocal` runs -1..1 across the quad, so it is already the texture coordinate.
    const structure = texture(uBillboard, vLocal.mul(0.5).add(vec2(0.5, 0.5))).w;
    return vec4(encodeSrgb(vColor), falloff * 0.6 * present * (0.62 + structure * 0.38));
  },
});
