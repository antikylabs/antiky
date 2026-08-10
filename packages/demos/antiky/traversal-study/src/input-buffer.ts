import type { TraversalInput } from './simulation.ts';

export type TraversalInputBuffer = Readonly<{
  capture(input: TraversalInput): void;
  read(): TraversalInput;
  consume(completedSteps: number): void;
}>;

/** Retains one-frame actions until Framework reports that a fixed step consumed them. */
export function createTraversalInputBuffer(): TraversalInputBuffer {
  let continuous: TraversalInput = Object.freeze({
    horizontal: 0,
    active: false,
    jump: false,
    brake: false,
    retry: false,
  });
  let pendingJump = false;
  let pendingRetry = false;

  return Object.freeze({
    capture(input): void {
      continuous = Object.freeze({
        horizontal: input.horizontal,
        active: input.active,
        jump: false,
        brake: input.brake === true,
        retry: false,
      });
      pendingJump ||= input.jump === true;
      pendingRetry ||= input.retry === true;
    },
    read(): TraversalInput {
      return Object.freeze({
        ...continuous,
        jump: pendingJump,
        retry: pendingRetry,
      });
    },
    consume(completedSteps): void {
      if (completedSteps <= 0) return;
      pendingJump = false;
      pendingRetry = false;
    },
  });
}
