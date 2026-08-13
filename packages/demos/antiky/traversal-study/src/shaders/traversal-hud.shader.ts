import { clamp, cos, max, min, shader, sin, vec2, vec4 } from 'brometal';

/**
 * Flat HUD, drawn in screen space.
 *
 * What this replaces: the progress and storm meters were **cubes in the world**, positioned by
 * `hudAnchorX`/`hudAnchorY` against the camera target so they chased the camera around the level.
 * The project's own audit called them "a cluster of coloured 3D boxes floating in the sky at
 * upper-left" that "reads as broken geometry", which is exactly right — a meter chasing a camera
 * through a world it is not part of is a meter with a bug, not a design.
 *
 * A meter is interface, not scenery. This draws each segment as a rectangle in normalised device
 * coordinates, so it is the same size and the same colour wherever it lands and whatever the camera
 * is doing.
 *
 * **No view-projection uniform at all.** That is the point: the vertex position *is* the clip
 * position, which is what makes this immune to every camera decision the demo makes later.
 */
export default shader({
  attributes: {
    // A unit quad, 0..1 on both axes.
    aCorner: 'vec2',
  },
  instanceAttributes: {
    /** Rectangle in normalised device coordinates: centre xy, half-extent zw. */
    iRect: 'vec4',
    iColor: 'vec3',
    /** x is fill 0..1, y is opacity, z is the corner radius as a fraction of the short side. */
    iParams: 'vec3',
    /** Rotation in radians. The parcel pips and the outcome mark are diamonds and crosses. */
    iRotation: 'float',
  },
  varyings: {
    vLocal: 'vec2',
    vColor: 'vec3',
    vParams: 'vec3',
  },

  vertex({ aCorner, iRect, iColor, iParams, iRotation }, {}, v) {
    // -1..1 across the rectangle, so the fragment can measure its own edges without knowing the
    // rectangle's size in pixels.
    const local = aCorner.scale(2).sub(vec2(1, 1));
    v.vLocal = local;
    v.vColor = iColor;
    v.vParams = iParams;
    // Rotated about the rectangle's own centre, in screen space, so a diamond stays a diamond
    // whatever the camera is doing.
    const spin = cos(iRotation);
    const tilt = sin(iRotation);
    const scaledX = local.x * iRect.z;
    const scaledY = local.y * iRect.w;
    // Straight to clip space. Depth 0 with w = 1 puts it in front of everything the scene drew.
    return vec4(
      iRect.x + scaledX * spin - scaledY * tilt,
      iRect.y + scaledX * tilt + scaledY * spin,
      0,
      1,
    );
  },

  fragment({}, { vLocal, vColor, vParams }) {
    // Fill runs left to right, so a partly-charged segment is a partly-filled bar rather than a
    // dimmer one — a shape a player reads without having to compare brightnesses.
    const fill = clamp(vParams.x, 0, 1);
    const filled = 1 - clamp((vLocal.x * 0.5 + 0.5 - fill) * 24, 0, 1);

    // Chamfered corners, cut with a diagonal rather than a rounded distance field: this is a HUD in
    // a demo whose whole visual language is bevelled panels, and a chamfer costs one `max`.
    const chamfer = clamp(vParams.z, 0, 0.5);
    const corner = max(vLocal.x, 0 - vLocal.x) + max(vLocal.y, 0 - vLocal.y);
    const inside = 1 - clamp((corner - (2 - chamfer)) * 12, 0, 1);

    // A darker rail behind the fill, so an empty segment still reads as a segment that is empty
    // rather than as nothing at all.
    const rail = 0.16;
    const brightness = rail + filled * (1 - rail);
    // A thin bright edge along the top, which is what stops a flat bar looking like a sticker.
    const edge = clamp((vLocal.y - 0.62) * 6, 0, 1) * filled * 0.5;

    const opacity = clamp(vParams.y, 0, 1) * inside;
    return vec4(vColor.scale(brightness).add(vColor.scale(edge)), min(opacity, 1));
  },
});
