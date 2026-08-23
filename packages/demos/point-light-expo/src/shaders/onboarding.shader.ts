import {
  max,
  mix,
  pow,
  shader,
  step,
  texture,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';

export default shader({
  attributes: {
    aPosition: 'vec3',
    aUv: 'vec2',
  },
  uniforms: {
    uAtlas: 'sampler2D',
    uOpacity: 'float',
    uScale: 'vec2',
    uOffset: 'vec2',
  },
  varyings: {
    vUv: 'vec2',
  },

  vertex({ aPosition, aUv }, { uScale, uOffset }, v) {
    v.vUv = aUv;
    return vec4(
      aPosition.x * uScale.x + uOffset.x,
      aPosition.y * uScale.y + uOffset.y,
      0,
      1,
    );
  },

  fragment({ uAtlas, uOpacity }, { vUv }) {
    // Neither decoded nor encoded, deliberately.
    //
    // This overlay is authored display-space art and it is composited onto a display-space buffer,
    // so passing it through unchanged is the identity — which is what UI wants. Decoding it and
    // encoding it again would compute the same answer twice as slowly and lose precision doing it,
    // and `pipeline-invariants.test.mjs` classifies `uAtlas` as authored for exactly this reason.
    //
    // This is not a second rule. The rule is that the lit pipeline is linear from sample to write;
    // the UI layer never enters that pipeline. When 06-02 gives the lit passes a shared HDR target,
    // this shader stays outside it.
    const sample = texture(uAtlas, vUv);
    return vec4(sample.xyz, sample.w * uOpacity);
  },
});
