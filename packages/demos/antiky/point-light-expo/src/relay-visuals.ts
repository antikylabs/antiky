import { EXPO_LIGHT_DEFINITIONS } from './lights.ts';
import { RELAY_PRESENTATION } from './presentation.ts';
import {
  createRingBatch,
  createContactShadowBatch,
  createGlowBatch,
  createSurfaceBatch,
  type Vec3,
} from './render-batches.ts';
import { RELAY_RENDER_SLOTS, renderSlot } from './render-profile.ts';
import { authoritativeRelayRegionRadii, type RelaySnapshot } from './simulation.ts';

const {
  bone: BONE,
  contactShadow: CONTACT_SHADOW,
  danger: DANGER,
  darkStone: DARK_STONE,
  forge: FORGE,
  integrity: INTEGRITY,
  oldBrass: OLD_BRASS,
  player: PLAYER,
  shade: SHADE,
  verdigris: VERDIGRIS,
} = RELAY_PRESENTATION.palette;

type SurfaceBatch = ReturnType<typeof createSurfaceBatch>;
type RingBatch = ReturnType<typeof createRingBatch>;
type GlowBatch = ReturnType<typeof createGlowBatch>;
type ContactShadowBatch = ReturnType<typeof createContactShadowBatch>;

export type RelayVisualBatches = Readonly<{
  forms: SurfaceBatch;
  creatures: SurfaceBatch;
  contacts: ContactShadowBatch;
  orbs: SurfaceBatch;
  rings: RingBatch;
  glows: GlowBatch;
}>;

function colorForRelay(index: number): Vec3 {
  return EXPO_LIGHT_DEFINITIONS[index]!.pointLight.color;
}

function setSurface(
  batch: SurfaceBatch,
  index: number,
  x: number, y: number, z: number,
  scaleX: number, scaleY: number, scaleZ: number,
  color: Vec3,
  roughness: number, metallic: number, emissive: number,
  yaw = 0,
): void {
  batch.setValues(
    index,
    x, y, z,
    scaleX, scaleY, scaleZ,
    color[0], color[1], color[2],
    roughness, metallic, emissive,
    yaw,
  );
}

/**
 * sRGB to linear, for colours authored as display values in the palette.
 *
 * `contact-shadow` and `foundry-glow` write their instance colour straight to the screen with no
 * lighting, and every shader now encodes on output. Handing them a display-authored colour would
 * encode it a second time and wash it out, so it is converted here, where it enters the pipeline.
 * Encode(linear(c)) returns exactly c, which is the point.
 *
 * The lit shaders are deliberately not routed through this: their palette entries are albedo
 * multiplied by light, and changing those changes the lighting rather than the transfer function.
 * That gap is real and belongs to a later step, not to this one.
 *
 * Same piecewise curve as `decodeSrgb` in the shaders, and `packages/demos/tests` asserts they
 * agree.
 */
function channelToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function srgbToLinear(color: Vec3): Vec3 {
  return [channelToLinear(color[0]), channelToLinear(color[1]), channelToLinear(color[2])];
}

function setGlow(
  batch: GlowBatch,
  index: number,
  x: number, y: number, z: number,
  scale: number,
  color: Vec3,
  power: number,
  phase = 0,
  motion = 0,
): void {
  const linear = srgbToLinear(color);
  batch.setValues(index, x, y, z, scale, linear[0], linear[1], linear[2], power, phase, motion);
}

/** The contact-shadow colour, converted once. See `srgbToLinear`. */
const LINEAR_CONTACT_SHADOW = srgbToLinear(CONTACT_SHADOW);

function populateFormsAndOrbs(
  batches: RelayVisualBatches,
  state: RelaySnapshot,
  powers: readonly [number, number, number],
): void {
  const { forms, creatures, contacts, orbs } = batches;
  const chargeColor = state.player.charge.relayIndex === null
    ? BONE
    : colorForRelay(state.player.charge.relayIndex);
  const playerColor = state.dangerPulse > 0.55 || state.status === 'lost' ? DANGER : PLAYER;

  forms.clear();
  const playerScaleX = state.status === 'lost' ? 0.58 : 0.5;
  const playerScaleY = state.status === 'lost' ? 0.16 : 0.72;
  const playerScaleZ = state.status === 'lost' ? 0.58 : 0.5;
  setSurface(
    forms,
    renderSlot(RELAY_RENDER_SLOTS.forms.player, 0),
    state.player.x, 0.36, state.player.z,
    playerScaleX, playerScaleY, playerScaleZ,
    playerColor,
    0.24, 0.42, 0.16 + state.player.charge.value * 0.42 + state.dangerPulse * 0.2,
    -Math.atan2(state.player.facingX, state.player.facingZ),
  );
  forms.upload();

  creatures.clear();
  for (let index = 0; index < state.shades.length; index += 1) {
    const shade = state.shades[index]!;
    const retreat = shade.mode === 'retreat';
    const facingX = retreat ? shade.x - state.player.x : state.player.x - shade.x;
    const facingZ = retreat ? shade.z - state.player.z : state.player.z - shade.z;
    setSurface(
      creatures,
      renderSlot(RELAY_RENDER_SLOTS.creatures.shades, index),
      shade.x, 0.12 + Math.sin(state.time * 2.1 + shade.phase) * 0.015, shade.z,
      retreat ? 0.48 : 0.64, retreat ? 0.58 : 0.74, retreat ? 0.48 : 0.64,
      SHADE,
      0.62, 0.04, retreat ? 0.16 : 0.3,
      Math.atan2(facingX, -facingZ),
    );
  }
  creatures.upload();

  orbs.clear();
  contacts.clear();
  contacts.setValues(
    renderSlot(RELAY_RENDER_SLOTS.contacts.player, 0),
    state.player.x, -0.375, state.player.z,
    0.52, 0, 0.38,
    LINEAR_CONTACT_SHADOW[0], LINEAR_CONTACT_SHADOW[1], LINEAR_CONTACT_SHADOW[2],
  );
  for (let index = 0; index < state.shades.length; index += 1) {
    const shade = state.shades[index]!;
    contacts.setValues(
      renderSlot(RELAY_RENDER_SLOTS.contacts.shades, index),
      shade.x, -0.375, shade.z,
      0.72, 0, 0.54,
      LINEAR_CONTACT_SHADOW[0], LINEAR_CONTACT_SHADOW[1], LINEAR_CONTACT_SHADOW[2],
    );
  }
  setSurface(
    orbs,
    renderSlot(RELAY_RENDER_SLOTS.orbs.playerCore, 0),
    state.player.x, 0.64, state.player.z,
    0.21, 0.21, 0.21,
    chargeColor,
    0.16, 0.35, 0.8 + state.player.charge.value,
  );

  const facingLength = Math.max(0.001, Math.hypot(state.player.facingX, state.player.facingZ));
  const forwardX = state.player.facingX / facingLength;
  const forwardZ = state.player.facingZ / facingLength;
  const rightX = -forwardZ;
  const rightZ = forwardX;
  for (let index = 0; index < RELAY_PRESENTATION.playerPrismMarkers.length; index += 1) {
    const marker = RELAY_PRESENTATION.playerPrismMarkers[index]!;
    const offsetX = rightX * marker.right + forwardX * marker.forward;
    const offsetZ = rightZ * marker.right + forwardZ * marker.forward;
    const isNose = marker.forward > 0;
    setSurface(
      orbs,
      renderSlot(RELAY_RENDER_SLOTS.orbs.playerPrismMarkers, index),
      state.player.x + offsetX, marker.height, state.player.z + offsetZ,
      marker.scale[0], marker.scale[1], marker.scale[2],
      isNose ? BONE : PLAYER,
      0.22, 0.18, isNose ? 1.1 : 0.42,
    );
  }
  for (let index = 0; index < state.shades.length; index += 1) {
    const shade = state.shades[index]!;
    setSurface(
      orbs,
      renderSlot(RELAY_RENDER_SLOTS.orbs.shadeCores, index),
      shade.x, 0.46, shade.z,
      0.12, 0.12, 0.12,
      DANGER,
      0.16, 0.2, shade.mode === 'threaten' ? 1.65 : 0.32,
    );
  }
  for (let index = 0; index < EXPO_LIGHT_DEFINITIONS.length; index += 1) {
    const light = EXPO_LIGHT_DEFINITIONS[index]!;
    const relayColor = colorForRelay(index);
    setSurface(
      orbs,
      renderSlot(RELAY_RENDER_SLOTS.orbs.relayCores, index),
      light.transform.position[0], light.transform.position[1], light.transform.position[2],
      0.22, 0.22, 0.22,
      relayColor,
      0.14, 0.22, 1.8 + powers[index]! * 0.26,
    );
  }
  setSurface(
    orbs,
    renderSlot(RELAY_RENDER_SLOTS.orbs.forgeCore, 0),
    0, 0.76, 0,
    0.34, 0.34, 0.34,
    state.rejectPulse > 0 ? DANGER : FORGE,
    0.22, 0.86, 0.06 + state.forgePulse * 0.5 + state.rejectPulse * 1.3,
  );
  for (let index = 0; index < RELAY_RENDER_SLOTS.orbs.forgeSockets.count; index += 1) {
    const angle = index / RELAY_RENDER_SLOTS.orbs.forgeSockets.count * Math.PI * 2 - Math.PI / 2;
    const deposited = state.deposits[index]!;
    const socketScaleXz = deposited ? 0.18 : 0.14;
    setSurface(
      orbs,
      renderSlot(RELAY_RENDER_SLOTS.orbs.forgeSockets, index),
      Math.cos(angle) * 0.72, 0.72, Math.sin(angle) * 0.72,
      socketScaleXz, deposited ? 0.28 : 0.14, socketScaleXz,
      deposited ? colorForRelay(index) : DARK_STONE,
      0.22, 0.62, deposited ? 1.2 : 0.01,
    );
  }
  let identityIndex = 0;
  for (let relayIndex = 0; relayIndex < EXPO_LIGHT_DEFINITIONS.length; relayIndex += 1) {
    const light = EXPO_LIGHT_DEFINITIONS[relayIndex]!;
    const count = relayIndex + 1;
    for (let marker = 0; marker < count; marker += 1) {
      const angle = count === 1 ? -Math.PI / 2 : marker / count * Math.PI * 2 - Math.PI / 2;
      setSurface(
        orbs,
        renderSlot(RELAY_RENDER_SLOTS.orbs.relayIdentityMarkers, identityIndex),
        light.transform.position[0] + Math.cos(angle) * 0.92,
        0.08 + relayIndex * 0.045,
        light.transform.position[2] + Math.sin(angle) * 0.92,
        0.1, 0.1 + relayIndex * 0.025, 0.1,
        BONE,
        0.72, 0.08, 0.035,
      );
      identityIndex += 1;
    }
  }
  for (let index = 0; index < RELAY_RENDER_SLOTS.orbs.ambience.count; index += 1) {
    const angle = index / RELAY_RENDER_SLOTS.orbs.ambience.count * Math.PI * 2 + 0.12;
    const radius = 6.55 + (index % 3) * 0.34;
    const scaleXz = 0.12 + (index % 2) * 0.05;
    const ambienceColor = index % 4 === 0 ? VERDIGRIS : BONE;
    setSurface(
      orbs,
      renderSlot(RELAY_RENDER_SLOTS.orbs.ambience, index),
      Math.cos(angle) * radius, 0.2 + (index % 4) * 0.16, Math.sin(angle) * radius * 0.68,
      scaleXz, 0.18 + (index % 3) * 0.04, scaleXz,
      ambienceColor,
      0.72, index % 4 === 0 ? 0.56 : 0.05, 0.005,
    );
  }
  orbs.upload();
  // Written above alongside the orbs; without this the contact-shadow program is drawn with empty
  // instance buffers and BroMetal refuses the draw, taking the whole demo down with it.
  contacts.upload();
}

function populateRings(
  rings: RingBatch,
  state: RelaySnapshot,
  powers: readonly [number, number, number],
  chargeColor: Vec3,
): void {
  rings.clear();
  // Goal 08: the rings are light now, not pipe — an additive soft band per instance. Intensity
  // replaces the old surface material triple; the radii and their animations are unchanged,
  // because the radius is the message.
  for (let index = 0; index < EXPO_LIGHT_DEFINITIONS.length; index += 1) {
    const light = EXPO_LIGHT_DEFINITIONS[index]!;
    const field = authoritativeRelayRegionRadii(index, powers[index]!);
    const relayColor = colorForRelay(index);
    rings.setValues(
      renderSlot(RELAY_RENDER_SLOTS.rings.relaySafe, index),
      light.transform.position[0], -0.28, light.transform.position[2],
      field.safe,
      relayColor[0], relayColor[1], relayColor[2],
      0.7,
    );
    rings.setValues(
      renderSlot(RELAY_RENDER_SLOTS.rings.relayCharge, index),
      light.transform.position[0], -0.26, light.transform.position[2],
      field.charge,
      relayColor[0], relayColor[1], relayColor[2],
      state.deposits[index] ? 0.35 : 1.6,
    );
  }
  for (let index = 0; index < RELAY_PRESENTATION.forgeRingScales.length; index += 1) {
    const scale = RELAY_PRESENTATION.forgeRingScales[index]!;
    const rejectExpansion = state.rejectPulse * 0.08;
    const expandedScale = scale + rejectExpansion;
    const ringColor = state.rejectPulse > 0
      ? DANGER
      : index === 0 ? OLD_BRASS : index === 1 ? VERDIGRIS : DARK_STONE;
    rings.setValues(
      renderSlot(RELAY_RENDER_SLOTS.rings.forge, index),
      0, -0.17 + index * 0.035, 0,
      expandedScale,
      ringColor[0], ringColor[1], ringColor[2],
      0.6 + state.forgePulse * 1.6 + state.rejectPulse * 2.8,
    );
  }
  for (let index = 0; index < RELAY_RENDER_SLOTS.rings.forgeSockets.count; index += 1) {
    const angle = index / RELAY_RENDER_SLOTS.rings.forgeSockets.count * Math.PI * 2 - Math.PI / 2;
    const socketColor = state.deposits[index] ? colorForRelay(index) : DARK_STONE;
    rings.setValues(
      renderSlot(RELAY_RENDER_SLOTS.rings.forgeSockets, index),
      Math.cos(angle) * 0.72, 0.48, Math.sin(angle) * 0.72,
      0.24,
      socketColor[0], socketColor[1], socketColor[2],
      state.deposits[index] ? 2.6 : 0.5,
    );
  }
  const playerScale = 0.5 + state.player.charge.value * 0.2;
  rings.setValues(
    renderSlot(RELAY_RENDER_SLOTS.rings.player, 0),
    state.player.x, -0.3, state.player.z,
    playerScale,
    chargeColor[0], chargeColor[1], chargeColor[2],
    1.0 + state.player.charge.value * 2.4 + state.dangerPulse * 1.1,
  );
  for (let index = 0; index < state.shades.length; index += 1) {
    const shade = state.shades[index]!;
    const scale = shade.mode === 'threaten' ? 0.58 : 0.32;
    const shadeColor = shade.mode === 'threaten' ? DANGER : SHADE;
    rings.setValues(
      renderSlot(RELAY_RENDER_SLOTS.rings.shades, index),
      shade.x, -0.27, shade.z,
      scale,
      shadeColor[0], shadeColor[1], shadeColor[2],
      shade.mode === 'threaten' ? 2.0 : 0.6,
    );
  }
  const terminalX = state.status === 'lost' ? state.player.x : 0;
  const terminalZ = state.status === 'lost' ? state.player.z : 0;
  for (let index = 0; index < RELAY_RENDER_SLOTS.rings.terminal.count; index += 1) {
    const visible = state.status === 'playing' ? 0 : 1;
    const scale = visible * (0.75 + index * 0.52 + Math.sin(state.time * 2 + index) * 0.08);
    const terminalColor = state.status === 'won' ? colorForRelay(index) : DANGER;
    rings.setValues(
      renderSlot(RELAY_RENDER_SLOTS.rings.terminal, index),
      terminalX, 0.12 + index * 0.22, terminalZ,
      scale,
      terminalColor[0], terminalColor[1], terminalColor[2],
      visible * 2.4,
    );
  }
  for (let index = 0; index < RELAY_RENDER_SLOTS.rings.ambience.count; index += 1) {
    const angle = index / RELAY_RENDER_SLOTS.rings.ambience.count * Math.PI * 2 + 0.28;
    const scale = 0.34 + (index % 3) * 0.16;
    const ambienceColor = index % 2 === 0 ? VERDIGRIS : OLD_BRASS;
    rings.setValues(
      renderSlot(RELAY_RENDER_SLOTS.rings.ambience, index),
      Math.cos(angle) * 4.7, -0.29, Math.sin(angle) * 3.5,
      scale,
      ambienceColor[0], ambienceColor[1], ambienceColor[2],
      0.05,
    );
  }
  rings.upload();
}

function populateGlows(glows: GlowBatch, state: RelaySnapshot, powers: readonly number[]): void {
  const chargeColor = state.player.charge.relayIndex === null
    ? BONE
    : colorForRelay(state.player.charge.relayIndex);
  glows.clear();
  for (let index = 0; index < state.particles.length; index += 1) {
    const particle = state.particles[index]!;
    const visible = Math.max(0, particle.life);
    setGlow(
      glows,
      renderSlot(RELAY_RENDER_SLOTS.glows.particles, index),
      particle.x, particle.y, particle.z,
      (0.035 + visible * 0.09) * Math.min(1, visible * 5),
      particle.kind === 2 ? DANGER : colorForRelay(particle.relayIndex),
      visible * (particle.kind === 1 ? 2.1 : 1.35),
      index * 0.31,
    );
  }
  for (let index = 0; index < EXPO_LIGHT_DEFINITIONS.length; index += 1) {
    const light = EXPO_LIGHT_DEFINITIONS[index]!;
    setGlow(
      glows,
      renderSlot(RELAY_RENDER_SLOTS.glows.relays, index),
      light.transform.position[0], light.transform.position[1], light.transform.position[2],
      0.42 + powers[index]! * 0.035,
      colorForRelay(index),
      powers[index]!,
      index * 2.1,
    );
  }
  for (let index = 0; index < RELAY_RENDER_SLOTS.glows.integrity.count; index += 1) {
    const angle = index / RELAY_RENDER_SLOTS.glows.integrity.count * Math.PI * 2 + state.time * 0.35;
    const alive = state.integrity * RELAY_RENDER_SLOTS.glows.integrity.count > index + 0.05;
    setGlow(
      glows,
      renderSlot(RELAY_RENDER_SLOTS.glows.integrity, index),
      state.player.x + Math.cos(angle) * 0.58, 0.42, state.player.z + Math.sin(angle) * 0.58,
      alive ? 0.055 : 0.018,
      alive ? INTEGRITY : DANGER,
      alive ? 1.2 : 0.08,
      index,
    );
  }
  for (let index = 0; index < RELAY_RENDER_SLOTS.glows.charge.count; index += 1) {
    const angle = index / RELAY_RENDER_SLOTS.glows.charge.count * Math.PI * 2 - state.time * 0.42;
    const charged = state.player.charge.value * RELAY_RENDER_SLOTS.glows.charge.count > index + 0.01;
    setGlow(
      glows,
      renderSlot(RELAY_RENDER_SLOTS.glows.charge, index),
      state.player.x + Math.cos(angle) * 0.38, 0.93, state.player.z + Math.sin(angle) * 0.38,
      charged ? 0.047 : 0.014,
      chargeColor,
      charged ? 1.45 : 0.04,
      index * 0.5,
    );
  }
  for (let index = 0; index < RELAY_RENDER_SLOTS.glows.forgeSockets.count; index += 1) {
    const angle = index / RELAY_RENDER_SLOTS.glows.forgeSockets.count * Math.PI * 2 - Math.PI / 2;
    setGlow(
      glows,
      renderSlot(RELAY_RENDER_SLOTS.glows.forgeSockets, index),
      Math.cos(angle) * 0.72, 0.76, Math.sin(angle) * 0.72,
      state.deposits[index] ? 0.2 : 0.045,
      colorForRelay(index),
      state.deposits[index] ? 2.2 : 0.1,
      index,
    );
  }
  for (let index = 0; index < state.shades.length; index += 1) {
    const shade = state.shades[index]!;
    setGlow(
      glows,
      renderSlot(RELAY_RENDER_SLOTS.glows.shades, index),
      shade.x, 0.46, shade.z,
      shade.mode === 'threaten' ? 0.13 : 0.06,
      DANGER,
      shade.mode === 'threaten' ? 1.9 : 0.3,
      shade.phase,
    );
  }
  for (let index = 0; index < RELAY_RENDER_SLOTS.glows.ambience.count; index += 1) {
    const angle = index * 2.39996;
    const radius = 2.8 + (index % 5) * 1.15;
    setGlow(
      glows,
      renderSlot(RELAY_RENDER_SLOTS.glows.ambience, index),
      Math.cos(angle) * radius, 0.35 + (index % 4) * 0.48, Math.sin(angle) * radius * 0.7,
      0.025 + (index % 3) * 0.008,
      index % 3 === 0 ? colorForRelay(index % 3) : BONE,
      0.34,
      index * 0.73,
      0.15,
    );
  }
  glows.upload();
}

export function populateRelayVisuals(
  batches: RelayVisualBatches,
  state: RelaySnapshot,
  powers: readonly [number, number, number],
): void {
  populateFormsAndOrbs(batches, state, powers);
  const chargeColor = state.player.charge.relayIndex === null
    ? BONE
    : colorForRelay(state.player.charge.relayIndex);
  populateRings(batches.rings, state, powers, chargeColor);
  populateGlows(batches.glows, state, powers);
}
