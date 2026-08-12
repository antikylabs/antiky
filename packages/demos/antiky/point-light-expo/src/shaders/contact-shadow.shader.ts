import { length, shader, smoothstep, vec3, vec4 } from 'brometal';
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
export default shader({
  attributes: { aPosition: 'vec3' },
  instanceAttributes: { iOffset: 'vec3', iScale: 'vec3', iColor: 'vec3' },
  uniforms: { uViewProj: 'mat4' },
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

  fragment({}, { vLocal, vColor, vRadius }) {
    // 1 at the centre, 0 at the inscribed circle, so the quad's corners fall outside the shape.
    const falloff = smoothstep(1, 0.12, length(vLocal));
    // A cleared slot has radius 0; without this gate its collapsed quad still paints a dot.
    const present = smoothstep(0, 0.02, vRadius);
    return vec4(vColor, falloff * 0.6 * present);
  },
});
