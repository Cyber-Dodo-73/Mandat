import { formatCountdown } from '../format';
import { resolveDeviceLanguage } from '../languages';

describe('resolveDeviceLanguage', () => {
  it('defaults to French', () => {
    expect(resolveDeviceLanguage([])).toBe('fr');
    expect(resolveDeviceLanguage(['de', null])).toBe('fr');
  });

  it('uses the first supported device language', () => {
    expect(resolveDeviceLanguage(['de', 'en', 'fr'])).toBe('en');
  });
});

describe('formatCountdown', () => {
  it('pads hours, minutes and seconds', () => {
    expect(formatCountdown(3 * 3600 + 5 * 60 + 9)).toBe('03:05:09');
  });

  it('never goes negative', () => {
    expect(formatCountdown(-10)).toBe('00:00:00');
  });
});
