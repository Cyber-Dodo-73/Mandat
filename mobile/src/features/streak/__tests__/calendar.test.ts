import { addDays, isoWeekday, keptCount, milestoneProgress, monthGrid, monthStart, statusMap, weekStrip } from '../calendar';

const statuses = statusMap([
  { date: '2026-10-17', status: 'active' },
  { date: '2026-10-18', status: 'frozen' },
  { date: '2026-10-19', status: 'active' },
  { date: '2026-10-20', status: 'missed' },
]);

describe('streak calendar', () => {
  it('handles local dates without any timezone shift', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // European DST change
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(isoWeekday('2026-10-19')).toBe(0); // Monday
    expect(isoWeekday('2026-10-25')).toBe(6); // Sunday
  });

  it('builds the week from Monday, marking today and the future', () => {
    const week = weekStrip('2026-10-21', statuses);
    expect(week.map((day) => day.date)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(week.map((day) => day.status)).toEqual(['active', 'missed', 'today', 'future', 'future', 'future', 'future']);
  });

  it('keeps the server status for today once played', () => {
    expect(weekStrip('2026-10-19', statuses)[0]?.status).toBe('active');
  });

  it('pads the month grid to full weeks, Monday first', () => {
    const grid = monthGrid('2026-10-01', '2026-10-20', statuses);
    // October 2026 starts on a Thursday: three blank cells.
    expect(grid[0]?.slice(0, 3)).toEqual([null, null, null]);
    expect(grid[0]?.[3]?.date).toBe('2026-10-01');
    expect(grid.every((week) => week.length === 7)).toBe(true);
    const cells = grid.flat();
    expect(cells.filter(Boolean)).toHaveLength(31);
    expect(cells.find((day) => day?.date === '2026-10-18')?.status).toBe('frozen');
    expect(cells.find((day) => day?.date === '2026-10-05')?.status).toBe('none');
    expect(cells.find((day) => day?.date === '2026-10-31')?.status).toBe('future');
    expect(keptCount(cells)).toBe(3);
  });

  it('goes back months across a year boundary', () => {
    expect(monthStart('2026-01-15', 1)).toBe('2025-12-01');
    expect(monthStart('2026-10-19')).toBe('2026-10-01');
  });

  it('measures progress from the previous milestone', () => {
    const milestones = [3, 7, 14, 30];
    expect(milestoneProgress(1, 3, milestones)).toBeCloseTo(1 / 3);
    expect(milestoneProgress(5, 7, milestones)).toBeCloseTo(0.5);
    expect(milestoneProgress(14, 30, milestones)).toBe(0);
  });
});
