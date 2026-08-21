import {
  clamp,
  dot,
  length,
  max,
  mix,
  normalize,
  pow,
  shader,
  sin,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { rotate2, shadowFactor } from 'brometal/shader-functions';

export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iColor: 'vec3',
    iMaterial: 'vec3',
  },
  uniforms: {
    uSunDirection: 'vec3',
    uShadowMap: 'sampler2D',
    uLightViewProj: 'mat4',
    uLightPosition: 'vec3',
    uShadowRange: 'float',
    uBillboard: 'sampler2D',
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vColor: 'vec3',
    vMaterial: 'vec3',
    vPulse: 'float',
  },

  vertex({ aPosition, aNormal, iOffset, iScale, iColor, iMaterial }, { uViewProj, uTime }, v) {
    const rotatedPosition = rotate2(aPosition.xy.mul(iScale.xy), iMaterial.z);
    const rotatedNormal = rotate2(aNormal.xy, iMaterial.z);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      rotatedPosition.y + iOffset.y,
      aPosition.z * iScale.z + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, rotatedNormal.y, aNormal.z));
    v.vColor = iColor;
    v.vMaterial = iMaterial;
    v.vPulse = 0.74 + sin(uTime * 3.6 + iOffset.x * 0.28 + iOffset.y) * 0.26;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({
    uSunDirection,
    uShadowMap,
    uLightViewProj,
    uLightPosition,
    uShadowRange, uCameraPosition, uBillboard }, { vWorld, vNormal, vColor, vMaterial, vPulse }) {
    const normal = normalize(vNormal);
    // Same key light as traversal-model, which is where the value comes from: the model shader
    // lights what the player watches, and this surface is what its shadows land on. Repeated
    // rather than shared because the BroMetal MVP cannot read a module-level constant from a
    // shader body; `pipeline-invariants.test.mjs` fails if the two copies drift apart.
    const light = normalize(vec3(-0.38, 0.84, 0.48));
    // The sun's shadow, and the only cast shadow on the course.
    //
    // Softness, bias and the shadow texel are literals rather than uniforms, agreed across both
    // material shaders. 0.00048828125 is 1 / 2048, which is `SHADOW_MAP_SIZE` in `src/sun.ts` — a
    // texel size that does not match the map silently resizes the penumbra rather than failing.
    //
    // The bias is larger than the reference's 0.03 because this map covers a moving 28-unit slice
    // rather than a fixed room, so one depth step is 0.028 world units rather than 0.016.
    const shadowSoftness = 2.5;
    const shadowBias = 0.05;
    const sunVisibility = shadowFactor(
      uShadowMap,
      uLightViewProj,
      vWorld,
      normal,
      uLightPosition,
      uShadowRange,
      0.00048828125,
      shadowSoftness,
      shadowBias,
    );
    const view = normalize(uCameraPosition.sub(vWorld));
    // Key term only — see the note in `traversal-model.shader.ts`.
    const rawLight = max(dot(normal, light), 0) * sunVisibility;
    const litBand = smoothstep(0.18, 0.24, rawLight) * 0.28
      + smoothstep(0.58, 0.64, rawLight) * 0.48;
    const rim = pow(1 - max(dot(normal, view), 0), 2.2);
    const base = vColor.scale(0.48 + litBand)
      .add(vec3(0.16, 0.2, 0.18).scale(0.12 + normal.y * 0.08));
    const emissive = vColor.scale(vMaterial.x * (0.16 + vPulse * 0.24));
    const highlight = vec3(1.05, 0.83, 0.48).scale(clamp(vMaterial.y, 0, 1) * (0.16 + rim * 0.3));
    // Matched to traversal-model's range for the same reason. Was 20..58 here against 22..58
    // there, so the ground began fading two metres before the props standing on it did.
    const depth = smoothstep(22, 58, length(uCameraPosition.sub(vWorld)));
    // `heightHaze` and the second sky colour it tinted are deleted here, which goal 07 asks for by
    // name: hand-rolled fake aerial perspective, superseded by real fog. It faded low geometry
    // toward a warmer blue than the sky behind it, which is a platform receding into a colour that
    // is not there. Deleting it is most of this packet's 15.4/255 drift on the platforms, and that
    // is a deliberate change rather than a tone-map error — see the region table in the summary.
    // Structure on the contact shadow, which is the only thing this shader still draws — the HUD
    // moved to a flat screen-space batch, which is what freed this shader to be textured at all.
    //
    // The blob is a sphere with no UVs, so the view-facing normal is the coordinate: it reaches the
    // sprite's rim, where alpha is already zero, exactly at the silhouette. Without it every contact
    // shadow in the frame is the same perfect ellipse.
    const surfaceNormal = normalize(vNormal);
    const structure = texture(uBillboard, vec2(surfaceNormal.x * 0.5 + 0.5, surfaceNormal.z * 0.5 + 0.5)).w;
    const textured = 0.6 + structure * 0.4;
    const composed = base.add(emissive).add(highlight).scale(textured);
    // Linear HDR, and nothing else. Exposure, the tone-map and the encode all happen once in
    // `post.shader.ts`.
    //
    // **One sky.** This demo used to render three in a single frame: this shader faded to
    // (0.55, 0.65, 0.66), `traversal-surface` to (0.52, 0.63, 0.65), and the canvas cleared to
    // (0.38, 0.57, 0.68). A platform receding into a colour the sky behind it is not is the kind of
    // thing nobody sees and everybody feels. The clear colour won because it is what most of the
    // frame actually is.
    //
    // The value is linear because the target is: the post pass exposes, tone-maps and encodes it
    // along with the geometry, so it has to enter in the same space.
    return vec4(mix(composed, vec3(0.096296, 0.190755, 0.284863), depth * 0.5), 1);
  },
});
