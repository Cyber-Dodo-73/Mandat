/**
 * "The finger is a blade": a swipe that crosses the top strip of the pack tears it, wherever the
 * touch started (even outside the pack). Pure worklet functions so the gesture runs on the UI
 * thread and the geometry stays unit-testable.
 */

export type TearArea = {
  /** Pack rectangle in the gesture area's coordinates. */
  left: number;
  top: number;
  width: number;
  /** Y of the seam inside the pack. */
  seamY: number;
  /** Vertical distance from the seam that still counts as cutting it. */
  tolerance: number;
};

export type TearState = {
  /** 1 once the finger has entered the strip band and is cutting. */
  active: number;
  /** Cut extent along the seam, in pack coordinates (0 … width). */
  from: number;
  to: number;
  /** Last finger position, in pack coordinates; NaN before the first sample. */
  lastX: number;
  /** +1 when cutting left → right, -1 right → left, 0 not decided yet. */
  direction: number;
};

/** Share of the pack width that must be cut on release, otherwise the strip springs back. */
export const TEAR_COMMIT = 0.6;
/** Cutting this far finishes the tear right away, without waiting for the release. */
export const TEAR_COMPLETE = 0.95;
/** Once cutting, the finger may drift this many tolerances away from the seam. */
const DRIFT = 2;

export function initialTearState(): TearState {
  'worklet';
  return { active: 0, from: 0, to: 0, lastX: Number.NaN, direction: 0 };
}

export function tearTolerance(packHeight: number): number {
  'worklet';
  return Math.max(36, Math.round(packHeight * 0.1));
}

/** Feeds one finger sample (gesture-area coordinates); returns the next state. */
export function tearStep(state: TearState, x: number, y: number, area: TearArea): TearState {
  'worklet';
  const localX = x - area.left;
  const distance = Math.abs(y - area.top - area.seamY);
  const clampedX = Math.max(0, Math.min(area.width, localX));
  const previous = state.lastX;

  if (state.active === 0) {
    const crossesBand = distance <= area.tolerance;
    const insidePack = localX >= 0 && localX <= area.width;
    // A fast swipe can jump over the pack edge between two samples: enter at that edge.
    const jumpedIn =
      !Number.isNaN(previous) && ((previous < 0 && localX >= 0) || (previous > area.width && localX <= area.width));
    if (crossesBand && (insidePack || jumpedIn)) {
      let entry = clampedX;
      if (jumpedIn) entry = previous < 0 ? 0 : area.width;
      return { active: 1, from: Math.min(entry, clampedX), to: Math.max(entry, clampedX), lastX: localX, direction: 0 };
    }
    return { ...state, lastX: localX };
  }

  if (distance > area.tolerance * DRIFT) {
    // Too far from the seam: the blade lifts, the cut so far stays.
    return { ...state, lastX: localX };
  }
  const direction = state.direction !== 0 ? state.direction : clampedX > state.to ? 1 : clampedX < state.from ? -1 : 0;
  return {
    active: 1,
    from: Math.min(state.from, clampedX),
    to: Math.max(state.to, clampedX),
    lastX: localX,
    direction,
  };
}

/** Cut share of the pack width, 0 … 1. */
export function tearCoverage(state: TearState, width: number): number {
  'worklet';
  if (state.active === 0 || width <= 0) return 0;
  return Math.max(0, Math.min(1, (state.to - state.from) / width));
}

/** What releasing the finger does with the current cut. */
export function tearRelease(state: TearState, width: number): 'complete' | 'snapBack' | 'none' {
  'worklet';
  if (state.active === 0) return 'none';
  return tearCoverage(state, width) >= TEAR_COMMIT ? 'complete' : 'snapBack';
}
