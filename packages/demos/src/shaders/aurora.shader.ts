import { shader, length, vec2, vec3, vec4 } from 'brometal';
import { cosinePalette, fbm2, tonemapACES } from 'brometal/shader-functions';

/**
 * Deliberately short: this shader exists to be read next to the GLSL and the
 * WGSL the compiler emits from it. Both outputs come from these twenty lines.
 */
export default shader({
  attributes: { aPosition: 'vec3', aUv: 'vec2' },
  uniforms: { uTime: 'float', uAspect: 'float' },
  varyings: { vUv: 'vec2' },

  vertex({ aPosition, aUv }, _uniforms, v) {
    v.vUv = aUv;
    return vec4(aPosition, 1);
  },

  fragment({ uTime, uAspect }, { vUv }) {
    const p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5).scale(2.6);
    const drift = vec2(
      fbm2(p.add(vec2(uTime * 0.05, 0)), 4),
      fbm2(p.add(vec2(4.7, 1.3)).add(vec2(0, uTime * 0.04)), 4),
    );
    const n = fbm2(p.add(drift.scale(1.7)), 5);
    const core = 0.75 / (0.42 + length(p) * 0.85);
    const tint = cosinePalette(
      n + uTime * 0.03,
      vec3(0.26, 0.14, 0.20),
      vec3(0.58, 0.34, 0.36),
      vec3(1.0, 1.0, 0.9),
      vec3(0.0, 0.17, 0.42),
    );
    return vec4(tonemapACES(tint.scale(core * (0.35 + n))), 1);
  },
});
