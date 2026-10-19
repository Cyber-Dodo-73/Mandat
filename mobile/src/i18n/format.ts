import type { Language } from './languages';

const LOCALES: Record<Language, string> = { fr: 'fr-FR', en: 'en-US' };

export function formatNumber(value: number, language: Language, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALES[language], options).format(value);
}

export function formatPercent(ratio: number, language: Language): string {
  return formatNumber(ratio, language, { style: 'percent', maximumFractionDigits: 1 });
}

export function formatDate(date: Date, language: Language, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALES[language], options ?? { dateStyle: 'medium' }).format(date);
}

/** Formats a remaining duration as "05:42:10" style countdown. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}
