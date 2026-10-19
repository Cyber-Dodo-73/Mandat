import type { FriendStreak, FriendStreaksView } from '../api';
import {
  friendStreakLink,
  friendStreakToday,
  markCelebrated,
  milestonesToCelebrate,
  nudgeButton,
  readCelebrated,
} from '../friendStreakView';

const friend = (code: string) => ({ nickname: code, friendCode: code, avatarId: 'avatar.default' });

const streak = (overrides: Partial<FriendStreak> = {}): FriendStreak => ({
  id: 'fs-1',
  friend: friend('AAAA1111'),
  current: 7,
  best: 7,
  meDoneToday: true,
  friendDoneToday: true,
  nextMilestone: 14,
  since: '2026-10-01T10:00:00Z',
  ...overrides,
});

describe('friend streak view model', () => {
  it('says who still has to play today', () => {
    expect(friendStreakToday(streak())).toBe('bothDone');
    expect(friendStreakToday(streak({ friendDoneToday: false }))).toBe('waitingFriend');
    expect(friendStreakToday(streak({ meDoneToday: false }))).toBe('waitingMe');
    expect(friendStreakToday(streak({ meDoneToday: false, friendDoneToday: false }))).toBe('neither');
    expect(friendStreakToday(streak({ current: 0, meDoneToday: false }))).toBe('broken');
  });

  it('shows Relancer only for inactive friends, disabled once sent', () => {
    expect(nudgeButton({ activeToday: true, nudgedToday: false })).toBe('hidden');
    expect(nudgeButton({ activeToday: false, nudgedToday: false })).toBe('available');
    expect(nudgeButton({ activeToday: false, nudgedToday: true })).toBe('sent');
  });

  it('knows the friend streak state of each friend and the limit', () => {
    const view: FriendStreaksView = {
      streaks: [streak({ friend: friend('ACTIVE00') })],
      incoming: [{ id: 'i', friend: friend('INCOMING'), at: '2026-10-19T10:00:00Z' }],
      outgoing: [{ id: 'o', friend: friend('OUTGOING'), at: '2026-10-19T10:00:00Z' }],
      maxFriendStreaks: 5,
    };
    expect(friendStreakLink(view, 'ACTIVE00')).toBe('active');
    expect(friendStreakLink(view, 'OUTGOING')).toBe('invited');
    expect(friendStreakLink(view, 'INCOMING')).toBe('incoming');
    expect(friendStreakLink(view, 'NEWFRIEN')).toBe('available');
    expect(friendStreakLink({ ...view, maxFriendStreaks: 2 }, 'NEWFRIEN')).toBe('full');
    expect(friendStreakLink(undefined, 'NEWFRIEN')).toBe('full');
  });

  it('celebrates a shared milestone once per device', () => {
    const reached = streak({ id: 'fs-party', current: 7 });
    const notYet = streak({ id: 'fs-later', current: 8 });
    const waiting = streak({ id: 'fs-wait', current: 7, friendDoneToday: false });
    expect(milestonesToCelebrate([reached, notYet, waiting], readCelebrated())).toEqual([reached]);
    markCelebrated(reached);
    expect(milestonesToCelebrate([reached], readCelebrated())).toEqual([]);
    // The next milestone of the same streak is celebrated again.
    expect(milestonesToCelebrate([{ ...reached, current: 14 }], readCelebrated())).toHaveLength(1);
  });
});
