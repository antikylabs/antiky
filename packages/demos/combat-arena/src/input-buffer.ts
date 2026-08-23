import { createLatchedAction, type LatchedAction } from '@antiky/framework';

/** The combat action: one dash or one mark per press, not one per frame held. */
export type CombatActionBuffer = LatchedAction;

export const createCombatActionBuffer = createLatchedAction;
