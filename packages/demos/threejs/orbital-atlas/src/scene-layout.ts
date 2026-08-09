export interface ShardOrbit {
  readonly phase: number;
  readonly radius: number;
  readonly speed: number;
  readonly height: number;
  readonly scale: number;
  readonly tilt: number;
}

export function createShardOrbits(count: number): readonly ShardOrbit[] {
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const band = index % 3;
    const slot = Math.floor(index / 3);
    const radialStep = (slot % 60) / 59;
    return Object.freeze({
      phase: index * 2.399963229728653 + band * 0.43,
      radius: 2.4 + radialStep * 5.25 + band * 0.12,
      speed: 0.07 + band * 0.022 + (index % 11) * 0.0017,
      height: (((index * 31) % 100) / 100 - 0.5) * 1.05 + (band - 1) * 0.18,
      scale: 0.34 + (index % 7) * 0.045,
      tilt: (((index * 19) % 100) / 100 - 0.5) * 0.3,
    });
  }));
}
