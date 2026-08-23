import { createLatchedAction } from '@antiky/framework';

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
  // Two latches rather than two `||=` flags: a held jump is one jump, which the raw flags did not
  // guarantee. The continuous fields below are level-sampled and want no latching at all.
  const jump = createLatchedAction();
  const retry = createLatchedAction();

  return Object.freeze({
    capture(input): void {
      semanticInput.horizontal = input.horizontal;
      semanticInput.active = input.active;
      semanticInput.brake = input.brake === true;
      jump.capture(input.jump === true);
      retry.capture(input.retry === true);
    },
    read(): TraversalInput {
      semanticInput.jump = jump.read();
      semanticInput.retry = retry.read();
      return semanticInput;
    },
    consume(completedSteps): void {
      jump.consume(completedSteps);
      retry.consume(completedSteps);
    },
  });
}
