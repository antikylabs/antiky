import {
  cos,
  dot,
  max,
  mix,
  normalize,
  pow,
  shader,
  sin,
  step,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';

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
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'float',
    iColor: 'vec3',
    iPower: 'float',
    iPhase: 'float',
    iMotion: 'float',
  },
  uniforms: {
    uBillboard: 'sampler2D',
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vColor: 'vec3',
    vPower: 'float',
  },

  vertex(
    { aPosition, aNormal, iOffset, iScale, iColor, iPower, iPhase, iMotion },
    { uViewProj, uTime },
    v,
  ) {
    const drift = vec3(
      sin(uTime * (0.42 + iMotion) + iPhase) * 0.42 * iMotion,
      sin(uTime * (0.68 + iMotion * 0.5) + iPhase * 1.7) * 0.34 * iMotion,
      cos(uTime * (0.36 + iMotion) + iPhase) * 0.28 * iMotion,
    );
    const world = aPosition.scale(iScale).add(iOffset).add(drift);
    v.vWorld = world;
    v.vNormal = aNormal;
    v.vColor = iColor;
    v.vPower = iPower * (1 + sin(uTime * 2.2 + iPhase) * 0.18 * iMotion);
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition, uBillboard }, { vWorld, vNormal, vColor, vPower }) {
    const view = normalize(uCameraPosition.sub(vWorld));
    const rim = pow(1 - max(dot(normalize(vNormal), view), 0), 2.4);
    const strength = (0.3 + rim * 2.2) * (0.35 + vPower * 0.2);
    // Structure, so a cluster of relays reads as a cluster of things rather than as copies of one
    // circle. These glows are spheres and carry no `vUv`, so the view-facing normal is the texture
    // coordinate: `normal.xy` maps the visible hemisphere onto the sprite and reaches its rim, where
    // the alpha is already zero, exactly at the silhouette — so the edge softens instead of ending.
    const surfaceNormal = normalize(vNormal);
    const structure = texture(uBillboard, vec2(surfaceNormal.x * 0.5 + 0.5, surfaceNormal.y * 0.5 + 0.5)).w;
    const textured = 0.55 + structure * 0.45;
    return vec4(encodeSrgb(vColor.scale(strength * textured)), (0.32 + rim * 0.55) * textured);
  },
});
