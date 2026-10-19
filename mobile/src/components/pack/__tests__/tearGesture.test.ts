import {
  initialTearState,
  tearCoverage,
  tearRelease,
  tearStep,
  type TearArea,
  type TearState,
} from '../tearGesture';

const AREA: TearArea = { left: 50, top: 100, width: 200, seamY: 40, tolerance: 36 };
const SEAM = AREA.top + AREA.seamY;

function swipe(points: [number, number][], area = AREA): TearState {
  return points.reduce((state, [x, y]) => tearStep(state, x, y, area), initialTearState());
}

describe('tear gesture (finger as a blade)', () => {
  it('starts cutting when a swipe that began outside the pack enters the strip', () => {
    const state = swipe([
      [0, SEAM + 10],
      [30, SEAM + 8],
      [70, SEAM + 5],
      [150, SEAM],
    ]);
    expect(state.active).toBe(1);
    // Entered at the left edge between two samples, then cut up to x = 100 in pack coordinates.
    expect(state.from).toBe(0);
    expect(state.to).toBe(100);
    expect(state.direction).toBe(1);
  });

  it('ignores swipes that never cross the seam band', () => {
    const state = swipe([
      [0, SEAM + 120],
      [300, SEAM + 120],
    ]);
    expect(state.active).toBe(0);
    expect(tearCoverage(state, AREA.width)).toBe(0);
    expect(tearRelease(state, AREA.width)).toBe('none');
  });

  it('accepts a generous vertical tolerance around the cut line', () => {
    const state = swipe([
      [40, SEAM - 30],
      [140, SEAM + 34],
      [240, SEAM - 20],
    ]);
    expect(state.active).toBe(1);
    expect(tearCoverage(state, AREA.width)).toBeCloseTo(0.95, 2);
  });

  it('works right to left', () => {
    const state = swipe([
      [320, SEAM],
      [200, SEAM],
      [60, SEAM],
    ]);
    expect(state.from).toBe(10);
    expect(state.to).toBe(200);
    expect(state.direction).toBe(-1);
  });

  it('springs back below 60 % of the width and completes above', () => {
    const short = swipe([
      [40, SEAM],
      [120, SEAM],
      [160, SEAM],
    ]);
    expect(tearCoverage(short, AREA.width)).toBeCloseTo(0.55, 2);
    expect(tearRelease(short, AREA.width)).toBe('snapBack');

    const long = swipe([
      [40, SEAM],
      [200, SEAM],
    ]);
    expect(tearCoverage(long, AREA.width)).toBeCloseTo(0.75, 2);
    expect(tearRelease(long, AREA.width)).toBe('complete');
  });

  it('keeps the cut but stops progressing when the finger drifts far from the seam', () => {
    const state = swipe([
      [40, SEAM],
      [150, SEAM],
      [250, SEAM + 200],
    ]);
    expect(state.to).toBe(100);
  });
});
