import { legalUrl } from '../links';

describe('legalUrl', () => {
  it('points legal pages and support at the API host with the language', () => {
    expect(legalUrl('privacy', 'fr')).toBe('https://mandat.cyber-dodo.fr/legal/privacy?lang=fr');
    expect(legalUrl('terms', 'en')).toBe('https://mandat.cyber-dodo.fr/legal/terms?lang=en');
    expect(legalUrl('support', 'en')).toBe('https://mandat.cyber-dodo.fr/support?lang=en');
  });
});
