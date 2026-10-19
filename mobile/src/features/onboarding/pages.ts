/** Intro pages in order; texts live under onboarding.pages.<id> in the locales. */
export type OnboardingPage = { id: 'collect' | 'learn' | 'duel'; image: number };

export const ONBOARDING_PAGES: readonly OnboardingPage[] = [
  { id: 'collect', image: require('../../../assets/images/onboarding/onboarding-1.webp') as number },
  { id: 'learn', image: require('../../../assets/images/onboarding/onboarding-2.webp') as number },
  { id: 'duel', image: require('../../../assets/images/onboarding/onboarding-3.webp') as number },
];
