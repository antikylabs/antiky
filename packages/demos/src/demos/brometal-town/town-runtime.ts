import type { DemoSetup, MovementInput } from '../../runtime.ts';
import type { TownDemoOptions } from './practical-light-input.ts';

/** Private update/render seam shared by the Town Study adapter and Antiky Town. */
export type TownRuntime = Readonly<{
  update(deltaSeconds: number, movement: Readonly<MovementInput>): void;
  render(): void;
  readStateDigest(): string;
  dispose(): void;
}>;

export type TownRuntimeFactory = (
  setup: DemoSetup,
) => TownRuntime | Promise<TownRuntime>;

export type TownRuntimeBuilder = (
  options: TownDemoOptions,
) => TownRuntimeFactory;
