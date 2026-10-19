import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import type { View } from 'react-native';

import type { FtueAnchorId } from './steps';

export type FtueRect = { x: number; y: number; width: number; height: number };

type ViewRef = ComponentRef<typeof View>;
type Measurable = Pick<ViewRef, 'measureInWindow'>;

const anchors = new Map<FtueAnchorId, RefObject<Measurable | null>>();

export function registerAnchor(id: FtueAnchorId, ref: RefObject<Measurable | null>): () => void {
  anchors.set(id, ref);
  return () => {
    // A screen remounting may have registered a newer ref meanwhile: only remove our own.
    if (anchors.get(id) === ref) anchors.delete(id);
  };
}

export function getAnchor(id: FtueAnchorId): RefObject<Measurable | null> | undefined {
  return anchors.get(id);
}

/**
 * Marks a view as a tour target: `<View ref={useFtueAnchor('home.open')}>`.
 * Passing null registers nothing (e.g. the weekly missions group).
 */
export function useFtueAnchor(id: FtueAnchorId | null): RefObject<ViewRef | null> {
  const ref = useRef<ViewRef | null>(null);
  useEffect(() => (id ? registerAnchor(id, ref) : undefined), [id]);
  return ref;
}

export function measureAnchor(id: FtueAnchorId): Promise<FtueRect | null> {
  const node = anchors.get(id)?.current;
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
  });
}

const MEASURE_EVERY_MS = 400;

/**
 * Window rect of an anchor, re-measured while the step is on screen (layouts move with
 * scrolling and entrance animations). null while the target is not mounted.
 */
export function useAnchorRect(id: FtueAnchorId | undefined): FtueRect | null {
  // Tagged with the anchor it belongs to, so a stale rect is never returned for another id.
  const [measured, setMeasured] = useState<{ id: FtueAnchorId; rect: FtueRect | null } | null>(null);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    const measure = () => {
      void measureAnchor(id).then((next) => {
        if (!alive) return;
        setMeasured((previous) => (previous?.id === id && sameRect(previous.rect, next) ? previous : { id, rect: next }));
      });
    };
    measure();
    const timer = setInterval(measure, MEASURE_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);

  return id && measured?.id === id ? measured.rect : null;
}

function sameRect(a: FtueRect | null, b: FtueRect | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}
