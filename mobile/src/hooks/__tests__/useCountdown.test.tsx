import { act, renderHook } from '@testing-library/react-native';

import { useCountdown } from '../useCountdown';

describe('useCountdown', () => {
  beforeEach(() => jest.useFakeTimers({ now: Date.UTC(2026, 9, 19, 12, 0, 0) }));
  afterEach(() => jest.useRealTimers());

  it('counts down a nanosecond server instant and fires onElapsed once', async () => {
    const onElapsed = jest.fn();
    const { result } = await renderHook(() => useCountdown('2026-10-19T12:00:02.123456789Z', onElapsed));
    expect(result.current).toBe(2);
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(result.current).toBe(0);
    expect(onElapsed).toHaveBeenCalledTimes(1);
  });

  it('never fires for a date already in the past', async () => {
    const onElapsed = jest.fn();
    const { result } = await renderHook(() => useCountdown('2026-10-19T11:59:00.5Z', onElapsed));
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(0);
    expect(onElapsed).not.toHaveBeenCalled();
  });
});
