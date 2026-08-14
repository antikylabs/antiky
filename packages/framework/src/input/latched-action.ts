/**
 * A one-shot action captured at display rate and consumed at simulation rate.
 *
 * The host samples input every rendered frame; the simulation advances in fixed steps and may
 * complete none, one, or several in a frame. A press that lands between steps has to survive until
 * a step actually consumes it, and a press that is *held* has to count exactly once.
 *
 * Three demos wrote this independently. One added rising-edge detection and the other two kept
 * `pending ||= pressed`, which re-arms on every frame the button stays down — so a held pointer
 * fired the action continuously. The fix existed in the repository for as long as the bug did and
 * never reached the copies beside it.
 *
 * Edge detection lives inside, not at the call site. A caller cannot express the level-triggered
 * version through this interface, which is the point: the bug is unrepresentable rather than fixed.
 */

export type LatchedAction = Readonly<{
  /** Sample the button's current state. Call once per rendered frame, held or not. */
  capture(pressed: boolean): void;
  /** Whether an action is waiting to be consumed. */
  read(): boolean;
  /**
   * Clear the action if the simulation actually advanced.
   *
   * A frame that completes no step must not swallow the press, or an action landing in a render-only
   * frame is silently dropped.
   */
  consume(completedSteps: number): void;
}>;

export function createLatchedAction(): LatchedAction {
  let pending = false;
  // Rearmed only by seeing the button up. This is the whole fix.
  let armed = true;

  return Object.freeze({
    capture(pressed: boolean): void {
      if (!pressed) {
        armed = true;
        return;
      }
      if (!armed) return;
      pending = true;
      armed = false;
    },
    read(): boolean {
      return pending;
    },
    consume(completedSteps: number): void {
      if (completedSteps > 0) pending = false;
    },
  });
}
