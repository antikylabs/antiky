import { shader, texture, vec4 } from 'brometal';

export default shader({
  attributes: {
    aPosition: 'vec3',
    aUv: 'vec2',
  },
  uniforms: {
    uAtlas: 'sampler2D',
    uOpacity: 'float',
  },
  varyings: {
    vUv: 'vec2',
  },

  vertex({ aPosition, aUv }, _uniforms, v) {
    v.vUv = aUv;
    return vec4(aPosition.x * 0.64, aPosition.y * 0.22 - 0.74, 0, 1);
  },

  fragment({ uAtlas, uOpacity }, { vUv }) {
    const sample = texture(uAtlas, vUv);
    return vec4(sample.xyz, sample.w * uOpacity);
  },
});
