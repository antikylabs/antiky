import type { TraversalInput } from './simulation.ts';

export type TraversalInputBuffer = Readonly<{
  capture(input: TraversalInput): void;
  read(): TraversalInput;
  consume(completedSteps: number): void;
}>;

export type TraversalSessionInputCapture = (
  input: TraversalInput,
) => Readonly<TraversalInput> | null;

export function createTraversalSessionInputCapture(): TraversalSessionInputCapture {
  return (input): Readonly<TraversalInput> | null => {
    if (!Number.isFinite(input.horizontal)) return null;
    // EngineSession retains this value in lastCompletedStep, so each accepted
    // capture needs a distinct immutable value rather than a mutable or accessor view.
    return Object.freeze({
      horizontal: Math.max(-1, Math.min(1, input.horizontal)),
      active: input.active === true,
      jump: input.jump === true,
      brake: input.brake === true,
      retry: input.retry === true,
    });
  };
}

/** Retains one-frame actions until Framework reports that a fixed step consumed them. */
export function createTraversalInputBuffer(): TraversalInputBuffer {
  const semanticInput = {
    horizontal: 0,
    active: false,
    jump: false,
    brake: false,
    retry: false,
  };
  let pendingJump = false;
  let pendingRetry = false;

  return Object.freeze({
    capture(input): void {
      semanticInput.horizontal = input.horizontal;
      semanticInput.active = input.active;
      semanticInput.brake = input.brake === true;
      pendingJump ||= input.jump === true;
      pendingRetry ||= input.retry === true;
    },
    read(): TraversalInput {
      semanticInput.jump = pendingJump;
      semanticInput.retry = pendingRetry;
      return semanticInput;
    },
    consume(completedSteps): void {
      if (completedSteps <= 0) return;
      pendingJump = false;
      pendingRetry = false;
    },
  });
}
