import type { Renderer } from 'brometal';
import type {
  StudioGameContext,
  StudioGameInstance,
  StudioGameMovement,
} from '../studio-game.ts';
import type { TownDemoOptions } from './practical-light-input.ts';

/** Game-module data plus the game-owned BroMetal render driver. */
export type TownGameSetup = StudioGameContext & Readonly<{
  renderer: Renderer;
}>;

/** Private update/render seam used by Town Study's platform-time adapter. */
export type TownRuntime = Readonly<{
  update(deltaSeconds: number, movement: StudioGameMovement): void;
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

export type TownGameFactory = (
  setup: TownGameSetup,
) => StudioGameInstance | Promise<StudioGameInstance>;
