import { EXPO_LIGHT_DEFINITIONS } from './lights.ts';
import type { ReliquaryModelBatch } from './reliquary-models.ts';
import { RELAY_RENDER_SLOTS, renderSlot } from './render-profile.ts';

export const RELAY_SHRINE_PROFILES = Object.freeze([
  Object.freeze({
    rockHeights: Object.freeze([0.18, 0.76, 0.18] as const),
    rockScales: Object.freeze([0.62, 0.68, 0.62] as const),
    stumpScale: 1.5,
  }),
  Object.freeze({
    rockHeights: Object.freeze([0.18, 0.8, 1.42] as const),
    rockScales: Object.freeze([0.8, 0.66, 0.52] as const),
    stumpScale: 1.25,
  }),
  Object.freeze({
    rockHeights: Object.freeze([0.18, 0.46, 0.18] as const),
    rockScales: Object.freeze([0.6, 0.76, 0.6] as const),
    stumpScale: 1.62,
  }),
]);

function setupTrunkArches(batch: ReliquaryModelBatch): void {
  batch.clear();
  for (let arch = 0; arch < RELAY_RENDER_SLOTS.organic.backArchCrowns.count; arch += 1) {
    const center = (arch - 1) * 4.25;
    for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
      const side = sideIndex === 0 ? -1 : 1;
      const index = arch * 2 + sideIndex;
      batch.setValues(
        renderSlot(RELAY_RENDER_SLOTS.organic.backArchPillars, index),
        center + side * 1.48, 1.03, -5.05,
        0.86, 0, side * 0.08, Math.PI / 2 + side * 0.07,
        1.04, 1.08, 0.96,
        0.02, 0,
      );
    }
    batch.setValues(
      renderSlot(RELAY_RENDER_SLOTS.organic.backArchCrowns, arch),
      center, 2.38, -5.05,
      1.03, 0, 0, arch % 2 === 0 ? 0.04 : -0.04,
      1.04, 1.08, 0.96,
      0.02, 0,
    );
  }
  batch.upload();
}

function setupRocks(batch: ReliquaryModelBatch): void {
  batch.clear();
  for (let relayIndex = 0; relayIndex < EXPO_LIGHT_DEFINITIONS.length; relayIndex += 1) {
    const light = EXPO_LIGHT_DEFINITIONS[relayIndex]!;
    const profile = RELAY_SHRINE_PROFILES[relayIndex]!;
    const base = relayIndex * 3;
    for (let part = 0; part < 3; part += 1) {
      let x = light.transform.position[0];
      let y = profile.rockHeights[part]!;
      let z = light.transform.position[2];
      let scale = profile.rockScales[part]!;
      let rotationY = relayIndex * 0.82 + part * 1.86;
      if (relayIndex === 0) {
        x += (part - 1) * 0.58;
        z += part === 1 ? -0.12 : 0.16;
      } else if (relayIndex === 1) {
        x += part % 2 === 0 ? -0.08 : 0.11;
        rotationY = part * 1.2;
      } else {
        const angle = -0.8 + part * 0.8;
        x += Math.cos(angle) * 0.56;
        z += Math.sin(angle) * 0.62;
      }
      batch.setValues(
        renderSlot(RELAY_RENDER_SLOTS.rocks.relayMassing, base + part),
        x, y, z,
        scale, 0, rotationY, part === 1 ? 0.04 : -0.02,
        0.94, 1.02, 0.9,
        -0.06, 0.018,
      );
    }
  }

  for (let index = 0; index < RELAY_RENDER_SLOTS.rocks.forgeMassing.count; index += 1) {
    const angle = index / RELAY_RENDER_SLOTS.rocks.forgeMassing.count * Math.PI * 2 + 0.2;
    const radius = index % 2 === 0 ? 1.22 : 1.5;
    batch.setValues(
      renderSlot(RELAY_RENDER_SLOTS.rocks.forgeMassing, index),
      Math.cos(angle) * radius, 0.04 + (index % 3) * 0.09, Math.sin(angle) * radius,
      0.56 + (index % 3) * 0.08,
      index % 2 === 0 ? 0.04 : -0.05, -angle + index * 0.17, 0,
      1.02, 0.96, 0.82,
      -0.04, index % 2 === 0 ? 0.025 : 0.01,
    );
  }

  for (let index = 0; index < RELAY_RENDER_SLOTS.rocks.ruinClusters.count; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const x = row === 4 ? side * 3.2 : side * (6.45 - (row % 2) * 0.28);
    const z = row === 4 ? -4.45 : -3.75 + row * 2.08;
    batch.setValues(
      renderSlot(RELAY_RENDER_SLOTS.rocks.ruinClusters, index),
      x, -0.02 + (row % 2) * 0.08, z,
      0.78 + (row % 3) * 0.14,
      side * 0.04, side * (0.42 + row * 0.55), row % 2 === 0 ? 0.03 : -0.05,
      row % 3 === 0 ? 0.82 : 0.94,
      row % 3 === 0 ? 1.02 : 0.95,
      row % 3 === 0 ? 0.78 : 0.86,
      -0.02, 0,
    );
  }
  batch.upload();
}

function setupStumps(batch: ReliquaryModelBatch): void {
  batch.clear();
  for (let index = 0; index < EXPO_LIGHT_DEFINITIONS.length; index += 1) {
    const light = EXPO_LIGHT_DEFINITIONS[index]!;
    batch.setValues(
      renderSlot(RELAY_RENDER_SLOTS.stumps.relayShrines, index),
      light.transform.position[0], 0.05 + index * 0.04, light.transform.position[2],
      RELAY_SHRINE_PROFILES[index]!.stumpScale,
      index === 2 ? 0.08 : 0, index * 1.37, index === 0 ? -0.04 : 0.03,
      1.04, 1.02, 0.9,
      -0.05, 0.02,
    );
  }
  batch.setValues(
    renderSlot(RELAY_RENDER_SLOTS.stumps.forgeHeart, 0),
    0, 0.08, 0,
    2.18, 0, 0.36, 0,
    1.08, 0.96, 0.78,
    -0.08, 0.035,
  );

  const anchorX = [-6.3, 6.4, -6.45, 6.5] as const;
  const anchorZ = [-3.92, -3.84, 3.55, 3.42] as const;
  for (let index = 0; index < RELAY_RENDER_SLOTS.stumps.ruinAnchors.count; index += 1) {
    batch.setValues(
      renderSlot(RELAY_RENDER_SLOTS.stumps.ruinAnchors, index),
      anchorX[index]!, 0, anchorZ[index]!,
      1.55 + (index % 2) * 0.2,
      index % 2 === 0 ? 0.04 : -0.05, index * 1.18, 0,
      index % 2 === 0 ? 0.88 : 1.02,
      0.98,
      index % 2 === 0 ? 0.78 : 0.9,
      -0.02, 0,
    );
  }
  batch.upload();
}

export function setupReliquaryModels(
  trunks: ReliquaryModelBatch,
  rocks: ReliquaryModelBatch,
  stumps: ReliquaryModelBatch,
): void {
  setupTrunkArches(trunks);
  setupRocks(rocks);
  setupStumps(stumps);
}
