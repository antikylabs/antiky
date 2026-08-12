import { length, shader, smoothstep, texture, vec2, vec3, vec4 } from 'brometal';
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
    return vec4(vColor, falloff * 0.6 * present * (0.62 + structure * 0.38));
  },
});
