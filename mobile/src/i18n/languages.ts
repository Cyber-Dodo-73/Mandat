export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'fr';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Picks English only when the device prefers it; French is the default. */
export function resolveDeviceLanguage(languageCodes: readonly (string | null)[]): Language {
  for (const code of languageCodes) {
    if (isLanguage(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}
