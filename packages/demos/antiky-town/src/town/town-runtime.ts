import type { Renderer } from 'brometal';
import type {
  CaptureFixtureController,
  GameHostContext,
  GameInstance,
  GameMovementInput,
} from '@antiky/framework/game';
import type { TownDemoOptions } from './practical-light-input.ts';

/** Game-module data plus the game-owned BroMetal render driver. */
export type TownGameSetup = GameHostContext & Readonly<{
  captureFixture?: CaptureFixtureController;
  renderer: Renderer;
}>;

/** Private update/render seam used by Antiky Town's fixed-step host. */
export type TownRuntime = Readonly<{
  update(deltaSeconds: number, movement: GameMovementInput): void;
  render(): void;
  readStateDigest(): string;
  dispose(): void;
}>;

export type TownRuntimeFactory = (
  setup: TownGameSetup,
) => TownRuntime | Promise<TownRuntime>;

export type TownRuntimeBuilder = (
  options: TownDemoOptions,
) => TownRuntimeFactory;
