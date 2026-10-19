import { describe, expect, it } from 'vitest';
import { pageviewWindow } from '../src/pageviews.ts';

describe('pageviewWindow', () => {
  it('runs from July 2015 to the last full month before the reference date', () => {
    expect(pageviewWindow(new Date('2026-10-19T00:00:00Z'))).toEqual({ start: '2015070100', end: '2026093000' });
  });

  it('handles January and leap years', () => {
    expect(pageviewWindow(new Date('2025-01-05T00:00:00Z'), { year: 2024, month: 1 })).toEqual({ start: '2024010100', end: '2024123100' });
    expect(pageviewWindow(new Date('2024-03-01T00:00:00Z'), { year: 2024, month: 2 })).toEqual({ start: '2024020100', end: '2024022900' });
  });
});
