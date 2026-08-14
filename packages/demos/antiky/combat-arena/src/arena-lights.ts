export type ArenaLight = Readonly<{
  position: readonly [number, number, number];
  color: readonly [number, number, number];
  power: number;
  radius: number;
}>;

/**
 * The floodlights posted around the arena rim.
 *
 * The arena is lit by a key light and Earth's bounce, both of which arrive from one side and neither
 * of which belongs to the arena itself. Without local sources the deck reads as a lit *object* in
 * space rather than as a place with lighting rigged around it, and nothing in the frame says the
 * structure has power.
 *
 * Six posts on the perimeter, alternating the demo's two signal colours so the ring reads as
 * deliberate rig rather than as decoration. Kept just outside the play radius (8.25 is where the
 * cable posts sit) so they light the deck edges and the wall inner faces without washing the centre,
 * where the ships need to stay readable against a dark floor.
 *
 * Radius is generous relative to power: a tight falloff on a large deck gives six bright discs, and
 * what this wants is six gradients that overlap.
 */
export const ARENA_LIGHTS: readonly ArenaLight[] = Object.freeze([0, 1, 2, 3, 4, 5].map((index) => {
  const angle = index / 6 * Math.PI * 2 + Math.PI / 6;
  const warm = index % 2 === 1;
  // §6.2's "two coloured practicals at the goal ends, for spatial orientation": the posts nearest
  // the two z extremes carry the team colours — hot red at one end, team cyan at the other — so a
  // player reads which way the arena runs from the light alone. The other four keep the amber/cyan
  // rig alternation.
  const teamEnd = index === 1 ? 'red' : index === 4 ? 'cyan' : undefined;
  return Object.freeze({
    position: Object.freeze([Math.cos(angle) * 8.6, 1.85, Math.sin(angle) * 8.6] as const),
    // The demo's own cyan and amber, at the strength they read as light rather than as paint.
    // §6.2's palette: a cool *neutral* stadium with the saturation owned by the team signals. The
    // first pass tinted the working posts full amber and the deck's whole mid range joined one
    // orange hue cluster at 70% of the chromatic frame — the exact "everything is one colour"
    // failure the hue budget exists to catch. Warm-neutral keeps the luminance without the wash.
    color: Object.freeze(teamEnd === 'red' ? [1, 0.3, 0.24] as const
      : teamEnd === 'cyan' ? [0.3, 0.85, 1] as const
        : warm ? [1, 0.84, 0.62] as const : [0.8, 0.88, 0.96] as const),
    // Six lights sum. At 2.6 each the deck blew to white — the arena is roughly 16 across and every
    // point on it is inside two or three of these, so the useful figure is roughly a sixth of what a
    // single light would want.
    //
    // Goal 08 doubled the warm posts and raised the cool ones: the §7.1 row for this demo asks for
    // a p95 of 0.88 and the frame measured 0.62 — the brightest large surfaces are the flood-lit
    // wall faces, so this is the lever that actually moves that number. The warm posts lead the
    // cool ones on purpose: the frame's chromatic mass was 82% one blue cluster, and amber is the
    // counterweight that pulls the deck's mids warm without touching the team signals.
    power: teamEnd !== undefined ? 1.0 : warm ? 1.12 : 0.92,
    // Tight enough that each stays near its own post. A radius spanning the whole deck turns six
    // lights into one flat fill, which is the opposite of what posting lights around a space does.
    radius: 7.0,
  });
}));

/** Flattened for upload: BroMetal's DSL has no array uniforms, so each light is its own binding. */
export function arenaLightUniforms(): Readonly<Record<string, readonly number[] | number>> {
  const uniforms: Record<string, readonly number[] | number> = {};
  ARENA_LIGHTS.forEach((light, index) => {
    uniforms[`uLightPosition${index}`] = light.position;
    // Colour premultiplied by power, and the inverse square radius alongside it, so the shader does
    // one multiply and one subtract per light rather than a divide.
    uniforms[`uLightColor${index}`] = [
      light.color[0] * light.power,
      light.color[1] * light.power,
      light.color[2] * light.power,
    ];
    uniforms[`uLightFalloff${index}`] = 1 / (light.radius * light.radius);
  });
  return Object.freeze(uniforms);
}
