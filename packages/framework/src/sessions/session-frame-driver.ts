import {
  MAX_FRAME_ELAPSED_SECONDS,
  type EngineControlResult,
  type EngineFrameResult,
  type EngineFrameResultCode,
} from './engine-session/contract.ts';

/**
 * Turning a host's presentation clock into a session advance, once.
 *
 * Four demos derived elapsed time from `platformTimeSeconds` themselves, identically but for one
 * divergence, and each then repeated `previousPlatformTime = null` in three inspection-control
 * methods — nine identical bodies restating a framework invariant inside game code. The invariant
 * is that the clock is discontinuous after a pause, a resume or a manual step, so the next frame
 * must not bill the gap as elapsed time.
 *
 * Three things this fixes rather than moves:
 *
 * - **A clamp that read as live and was dead.** One demo clamped at `Math.min(0.1, …)`, which is
 *   looser than the session's own `MAX_FRAME_ELAPSED_SECONDS` of 0.05 — so the session clamped
 *   first and the demo's number never applied to anything.
 * - **`advance()`'s result code was dropped everywhere.** All eight codes, `SESSION_FAULTED`
 *   included. A faulted session presented as a frozen picture with no diagnostic anywhere in the
 *   repository. The driver routes any non-`ADVANCED` code to a fault channel the host supplies.
 * - **Presentation still happens on a bad frame.** Dropping the frame as well as the diagnostic
 *   would turn a recoverable pause into a black screen.
 */

export type SessionFrameFault = Readonly<{
  code: EngineFrameResultCode;
  result: EngineFrameResult;
}>;

export type SessionFrameDriverOptions<TInput> = Readonly<{
  advance(elapsedSeconds: number, input: TInput): EngineFrameResult;
  /** Read once per frame, immediately before advancing. */
  input(): TInput;
  /**
   * Draw the frame. `alpha` blends the previous completed step toward the newest one.
   *
   * Called on every frame, including one whose advance failed: a stalled simulation should look
   * stalled, not absent.
   */
  present(alpha: number): void;
  /** How far through a step the presentation clock sits. Defaults to showing the newest state. */
  presentationAlpha?(result: EngineFrameResult): number;
  /** Somewhere for a non-`ADVANCED` frame to go. Without one, the code is dropped as it was before. */
  onFault?(fault: SessionFrameFault): void;
}>;

export type SessionFrameDriver = Readonly<{
  /** Advance and present one host frame. */
  frame(platformTimeSeconds: number): EngineFrameResult;
  /**
   * Forget the last platform time, because the clock is about to jump.
   *
   * Call after any control operation that suspends or single-steps the session. The next frame then
   * bills zero elapsed time instead of the whole wall-clock gap.
   */
  resetClock(): void;
  /** `resetClock()` and present the newest state exactly, for a tool-driven step. */
  presentStep(result: EngineControlResult): EngineControlResult;
}>;

export function createSessionFrameDriver<TInput>(
  options: SessionFrameDriverOptions<TInput>,
): SessionFrameDriver {
  let previousPlatformTime: number | null = null;

  const elapsedSince = (platformTimeSeconds: number): number => {
    // A first frame, a rewound clock and a repeated timestamp all mean "no time has passed". The
    // session clamps the upper end at MAX_FRAME_ELAPSED_SECONDS, so no second clamp belongs here —
    // that is exactly how one demo ended up with a 0.1 that never fired.
    if (previousPlatformTime === null || platformTimeSeconds <= previousPlatformTime) return 0;
    return platformTimeSeconds - previousPlatformTime;
  };

  return Object.freeze({
    frame(platformTimeSeconds: number): EngineFrameResult {
      const elapsed = elapsedSince(platformTimeSeconds);
      previousPlatformTime = platformTimeSeconds;
      const result = options.advance(elapsed, options.input());
      if (result.code !== 'ADVANCED') {
        options.onFault?.(Object.freeze({ code: result.code, result }));
      }
      options.present(options.presentationAlpha?.(result) ?? 1);
      return result;
    },
    resetClock(): void {
      previousPlatformTime = null;
    },
    presentStep(result: EngineControlResult): EngineControlResult {
      previousPlatformTime = null;
      // Alpha 0 is the state the step just produced, shown exactly. Blending toward a next step
      // that has not been asked for would show a frame the simulation never occupied.
      options.present(0);
      return result;
    },
  });
}

export { MAX_FRAME_ELAPSED_SECONDS };
