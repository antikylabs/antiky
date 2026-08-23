import { length, shader, smoothstep, texture, vec2, vec3, vec4 } from 'brometal';
import { rotate2 } from 'brometal/shader-functions';

/**
 * Contact shadows, deliberately unlit.
 *
 * These blobs used to be thin dark boxes drawn through `arena-surface`, which meant the key light,
 * the fog and the tone-mapper all acted on them. A shadow that gets brighter when you shine a light
 * on it is why they read as stickers laid on the floor rather than as contact with it.
 *
 * There is no light term here at all, and the shape comes from a radial falloff rather than from
 * the geometry's edges, so the blob has no visible rectangle. Draw with `blend: 'alpha'`, which
 * depth-tests without writing depth.
 *
 * It declares only what it uses: no normal, no camera position, no clock. That is why it has its
 * own batch in `render-batches.ts` instead of borrowing the surface one.
 */
export default shader({
  attributes: { aPosition: 'vec3' },
  instanceAttributes: { iOffset: 'vec3', iScale: 'vec3', iColor: 'vec3' },
  uniforms: { uViewProj: 'mat4', uBillboard: 'sampler2D' },
  varyings: { vLocal: 'vec2', vColor: 'vec3', vRadius: 'float' },

  vertex({ aPosition, iOffset, iScale, iColor }, { uViewProj }, v) {
    // iScale.y carries the rotation, not a height: the quad is flat, so the vertical scale a box
    // needed is free. Keeping the instance layout at three vec3s lets the batch stay simple.
    const rotated = rotate2(aPosition.xz.mul(iScale.xz), iScale.y);
    const world = vec3(rotated.x + iOffset.x, iOffset.y, rotated.y + iOffset.z);
    v.vLocal = aPosition.xz;
    v.vColor = iColor;
    v.vRadius = iScale.x;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uBillboard }, { vLocal, vColor, vRadius }) {
    // 1 at the centre, 0 at the inscribed circle. The quad's corners sit outside it, so the
    // silhouette is an ellipse and the geometry's own edges never show.
    const falloff = smoothstep(1, 0.12, length(vLocal));
    // A cleared instance has scale 0. Without this it would still paint a full-strength dot at the
    // origin, because a zero-size quad still covers the pixel its vertices collapse onto.
    const present = smoothstep(0, 0.02, vRadius);
    // Texture over the analytic falloff, not instead of it. The smoothstep is what guarantees the
    // edge reaches zero at the inscribed circle; the sprite is what stops every contact shadow in
    // the frame being the same perfect ellipse. `vLocal` runs -1..1, so it is already the UV.
    const structure = texture(uBillboard, vLocal.mul(0.5).add(vec2(0.5, 0.5))).w;
    return vec4(vColor, falloff * 0.55 * present * (0.62 + structure * 0.38));
  },
});
