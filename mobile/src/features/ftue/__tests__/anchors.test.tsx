import { renderHook } from '@testing-library/react-native';
import type { RefObject } from 'react';

import { getAnchor, measureAnchor, registerAnchor, useFtueAnchor } from '../anchors';

type Measurable = Parameters<typeof registerAnchor>[1] extends RefObject<infer T> ? NonNullable<T> : never;

const fakeNode = (rect: [number, number, number, number]) =>
  ({
    measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(...rect),
  }) as unknown as Measurable;

describe('ftue anchors', () => {
  it('registers a hook ref while mounted and removes it on unmount', async () => {
    const { result, unmount } = await renderHook(() => useFtueAnchor('home.open'));
    expect(getAnchor('home.open')).toBe(result.current);
    await unmount();
    expect(getAnchor('home.open')).toBeUndefined();
  });

  it('registers nothing for a null id', async () => {
    await renderHook(() => useFtueAnchor(null));
    expect(getAnchor('missions.daily')).toBeUndefined();
  });

  it('keeps the newest ref when a screen remounts before the old one cleans up', () => {
    const first = { current: fakeNode([0, 0, 10, 10]) };
    const second = { current: fakeNode([5, 5, 10, 10]) };
    const releaseFirst = registerAnchor('play.quiz', first);
    const releaseSecond = registerAnchor('play.quiz', second);
    releaseFirst();
    expect(getAnchor('play.quiz')).toBe(second);
    releaseSecond();
    expect(getAnchor('play.quiz')).toBeUndefined();
  });

  it('measures the registered view in window coordinates, null when hidden or missing', async () => {
    const release = registerAnchor('collection.progress', { current: fakeNode([12, 300, 360, 140]) });
    await expect(measureAnchor('collection.progress')).resolves.toEqual({ x: 12, y: 300, width: 360, height: 140 });
    release();
    const releaseHidden = registerAnchor('collection.progress', { current: fakeNode([0, 0, 0, 0]) });
    await expect(measureAnchor('collection.progress')).resolves.toBeNull();
    releaseHidden();
    await expect(measureAnchor('pack.booster')).resolves.toBeNull();
  });
});
