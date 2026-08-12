/**
 * Decides when the drawing buffer actually needs reallocating.
 *
 * The trap this exists to close: comparing `canvas.width` against `canvas.clientWidth`. Those are
 * different units — device pixels against CSS pixels — and with `setPixelRatio(2)` they can never
 * be equal, so the guard never fires and `setSize` reallocates the drawing buffer on every frame.
 *
 * Sizes are held in CSS pixels, which is what the caller measures and what `setSize(w, h, false)`
 * expects, so the comparison and the assignment are always in the same unit.
 */
export function createResizeGuard(
  apply: (width: number, height: number) => void,
  fallbackWidth = 1280,
  fallbackHeight = 720,
): (clientWidth: number, clientHeight: number) => void {
  let renderWidth = 0;
  let renderHeight = 0;
  return (clientWidth: number, clientHeight: number): void => {
    const width = Math.max(1, clientWidth || fallbackWidth);
    const height = Math.max(1, clientHeight || fallbackHeight);
    if (renderWidth === width && renderHeight === height) return;
    renderWidth = width;
    renderHeight = height;
    apply(width, height);
  };
}
