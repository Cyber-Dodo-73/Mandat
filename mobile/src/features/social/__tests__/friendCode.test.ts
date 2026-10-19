import { friendLink, isFriendCode, normalizeFriendCode, parseFriendLink } from '../friendCode';

describe('friend codes', () => {
  it('normalizes what players type or paste', () => {
    expect(normalizeFriendCode(' abcd-2345 ')).toBe('ABCD2345');
    expect(isFriendCode('abcd 2345')).toBe(true);
  });

  it('rejects ambiguous characters and wrong lengths', () => {
    expect(isFriendCode('ABCD0123')).toBe(false);
    expect(isFriendCode('ABCDI234')).toBe(false);
    expect(isFriendCode('ABC2345')).toBe(false);
  });

  it('parses deep links from both app schemes and plain paths', () => {
    expect(parseFriendLink('mandat://friend/ABCD2345')).toBe('ABCD2345');
    expect(parseFriendLink('mandat-dev://friend/abcd2345?ref=share')).toBe('ABCD2345');
    expect(parseFriendLink('/friend/ABCD2345')).toBe('ABCD2345');
    expect(parseFriendLink('ABCD2345')).toBe('ABCD2345');
  });

  it('returns null for anything else', () => {
    expect(parseFriendLink('mandat://card/s1-001')).toBeNull();
    expect(parseFriendLink('https://example.com')).toBeNull();
    expect(parseFriendLink('')).toBeNull();
  });

  it('builds the shared link', () => {
    expect(friendLink('ABCD2345')).toBe('mandat://friend/ABCD2345');
  });
});
