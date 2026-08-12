export type WorkspaceSplitAxis = 'column' | 'row';

type WorkspaceBounds = Readonly<{
  height: number;
  left: number;
  top: number;
  width: number;
}>;

export const DEFAULT_WORKSPACE_SPLITS = Object.freeze({
  column: 69,
  row: 64,
});

export const WORKSPACE_SPLIT_LIMITS = Object.freeze({
  column: Object.freeze({ max: 80, min: 25 }),
  row: Object.freeze({ max: 75, min: 25 }),
});

function clampWorkspaceSplit(axis: WorkspaceSplitAxis, value: number): number {
  const limits = WORKSPACE_SPLIT_LIMITS[axis];
  return Math.min(limits.max, Math.max(limits.min, value));
}

export function resizeWorkspaceSplit(
  axis: WorkspaceSplitAxis,
  pointerPosition: number,
  bounds: WorkspaceBounds,
): number {
  const start = axis === 'column' ? bounds.left : bounds.top;
  const size = axis === 'column' ? bounds.width : bounds.height;
  if (size <= 0) return DEFAULT_WORKSPACE_SPLITS[axis];

  const percentage = ((pointerPosition - start) / size) * 100;
  return clampWorkspaceSplit(axis, percentage);
}

export function stepWorkspaceSplit(
  axis: WorkspaceSplitAxis,
  current: number,
  key: string,
): number {
  if (key === 'Home') return DEFAULT_WORKSPACE_SPLITS[axis];

  const decrease = axis === 'column' ? key === 'ArrowLeft' : key === 'ArrowUp';
  const increase = axis === 'column' ? key === 'ArrowRight' : key === 'ArrowDown';
  if (!decrease && !increase) return current;

  return clampWorkspaceSplit(axis, current + (decrease ? -2 : 2));
}
