import { shader, texture, vec4 } from 'brometal';

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
    const sample = texture(uAtlas, vUv);
    return vec4(sample.xyz, sample.w * uOpacity);
  },
});
