import * as WebBrowser from 'expo-web-browser';

import type { Language } from '@/i18n';

/** Where the legal pages live (served by the API); override with EXPO_PUBLIC_LEGAL_BASE_URL. */
export const LEGAL_BASE_URL = (process.env.EXPO_PUBLIC_LEGAL_BASE_URL ?? 'https://mandat.cyber-dodo.fr').replace(/\/+$/, '');

export type LegalPage = 'terms' | 'privacy' | 'notice' | 'support';

/** Minimum age when the server value is not known yet (GET /api/v1/legal). */
export const DEFAULT_MINIMUM_AGE = 15;

export function legalUrl(page: LegalPage, language: Language): string {
  const path = page === 'support' ? '/support' : `/legal/${page}`;
  return `${LEGAL_BASE_URL}${path}?lang=${language}`;
}

export function openLegalPage(page: LegalPage, language: Language): void {
  void WebBrowser.openBrowserAsync(legalUrl(page, language)).catch(() => undefined);
}
