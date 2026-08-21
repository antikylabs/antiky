import { createLatchedAction, type LatchedAction } from '@antiky/framework';

/** The relay interaction: one click, one deposit, however long the pointer stays down. */
export type RelayInteractionBuffer = LatchedAction;

export const createRelayInteractionBuffer = createLatchedAction;
