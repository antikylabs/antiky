import {
  type EngineControlResult,
  type EngineFrameResult,
  type EnginePauseReason,
  type EngineSession,
  type EngineSessionStatus,
} from '@antiky/framework';

import type { DemoInstance, MovementInput } from '../../../runtime.ts';
import type { TownRuntime } from '../../brometal-town/town-runtime.ts';

export type TownSemanticInput = Readonly<{
  movement: Readonly<{
    x: number;
    z: number;
    active: boolean;
  }>;
}>;

export type AntikyTownGameHost = Readonly<{
  present(platformTimeSeconds: number): EngineFrameResult;
  pause(reason: EnginePauseReason): EngineControlResult;
  resume(reason: EnginePauseReason): EngineControlResult;
  step(expectedCompletedStepCount: number): EngineControlResult;
  readStatus(): EngineSessionStatus;
}>;

const HOST_BY_INSTANCE = new WeakMap<DemoInstance, AntikyTownGameHost>();

export function captureTownSemanticInput(movement: Readonly<MovementInput>): TownSemanticInput {
  const enabled = movement.active === true;
  const rawX = enabled && Number.isFinite(movement.x) ? movement.x : 0;
  const rawZ = enabled && Number.isFinite(movement.z) ? movement.z : 0;
  const length = Math.hypot(rawX, rawZ);
  const scale = length > 1 ? 1 / length : 1;
  const active = enabled && length > 0.01;
  const x = active ? rawX * scale : 0;
  const z = active ? rawZ * scale : 0;
  return Object.freeze({
    movement: Object.freeze({
      x,
      z,
      active,
    }),
  });
}

export function createAntikyTownGameHost(
  session: EngineSession<TownSemanticInput>,
  runtime: TownRuntime,
  movement: Readonly<MovementInput>,
): AntikyTownGameHost {
  let previousPlatformTime: number | null = null;

  const present = (platformTimeSeconds: number): EngineFrameResult => {
    let elapsedSeconds = platformTimeSeconds;
    if (Number.isFinite(platformTimeSeconds) && platformTimeSeconds >= 0) {
      elapsedSeconds = previousPlatformTime === null || platformTimeSeconds <= previousPlatformTime
        ? 0
        : platformTimeSeconds - previousPlatformTime;
      previousPlatformTime = platformTimeSeconds;
    }
    const result = session.advance(elapsedSeconds, captureTownSemanticInput(movement));
    if (result.code === 'ADVANCED') runtime.render();
    return result;
  };

  const pause = (reason: EnginePauseReason): EngineControlResult => {
    const result = session.pause(reason);
    if (result.code === 'PAUSED' || result.code === 'NO_OP') previousPlatformTime = null;
    return result;
  };

  const resume = (reason: EnginePauseReason): EngineControlResult => {
    const result = session.resume(reason);
    if (result.code === 'RESUMED' || result.code === 'NO_OP') previousPlatformTime = null;
    return result;
  };

  const step = (expectedCompletedStepCount: number): EngineControlResult => {
    const result = session.step(
      expectedCompletedStepCount,
      captureTownSemanticInput(movement),
    );
    if (result.renderRequested) runtime.render();
    return result;
  };

  return Object.freeze({
    present,
    pause,
    resume,
    step,
    readStatus: () => session.readStatus(),
  });
}

export function registerAntikyTownGameHost(
  instance: DemoInstance,
  host: AntikyTownGameHost,
): void {
  HOST_BY_INSTANCE.set(instance, host);
}

export function getAntikyTownGameHost(instance: DemoInstance | null): AntikyTownGameHost | null {
  return instance === null ? null : HOST_BY_INSTANCE.get(instance) ?? null;
}
