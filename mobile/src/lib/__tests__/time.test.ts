import { parseInstant } from '../time';

describe('parseInstant', () => {
  it('parses Java instants with micro or nanosecond precision', () => {
    expect(parseInstant('2026-10-19T12:28:34.364285043Z')).toBe(Date.UTC(2026, 9, 19, 12, 28, 34, 364));
    expect(parseInstant('2026-10-19T13:57:22.977658Z')).toBe(Date.UTC(2026, 9, 19, 13, 57, 22, 977));
    expect(parseInstant('2026-10-19T22:00:00Z')).toBe(Date.UTC(2026, 9, 19, 22, 0, 0));
  });

  it('returns null for garbage', () => {
    expect(parseInstant('not a date')).toBeNull();
  });
});
