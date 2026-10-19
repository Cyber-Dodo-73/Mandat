import { changeLanguage, default as i18n } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import { useSettingsStore } from '@/features/settings/store';

import { DEFAULT_LANGUAGE, type Language } from './languages';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const;

export function initI18n(): void {
  if (i18n.isInitialized) return;
  void i18n.use(initReactI18next).init({
    resources,
    lng: useSettingsStore.getState().language,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  // Switching language in settings re-renders every translated screen instantly.
  useSettingsStore.subscribe((state, previous) => {
    if (state.language !== previous.language) {
      void changeLanguage(state.language);
    }
  });
}

export function useLanguage(): Language {
  return useSettingsStore((state) => state.language);
}

export { i18n, useTranslation };
export * from './format';
export * from './languages';
