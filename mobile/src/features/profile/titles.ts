import { useTranslation } from '@/i18n';

/** Title ids the app knows a translation for (`title.<key>`). */
const KNOWN_TITLES = new Set([
  'rising_statesman',
  'head_of_state',
  'world_leader',
  'living_legend',
  'diplomat',
  'strategist',
  'great_collector',
  'golden_touch',
  'unwavering',
]);

const CONTINENTS = new Set(['africa', 'asia', 'europe', 'north_america', 'south_america', 'oceania']);

/** Readable fallback for an unknown id: `title.new_thing` → "New thing". */
export function humanizeId(id: string): string {
  const key = id.replace(/^[a-z]+\./, '').replace(/_/g, ' ').trim();
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : id;
}

/** Translated label of a title id, or null when the player has none. */
export function useTitleLabel(titleId: string | null | undefined): string | null {
  const { t } = useTranslation();
  if (!titleId) return null;
  const key = titleId.replace(/^title\./, '');
  if (KNOWN_TITLES.has(key)) return t(`profile.titles.${key}` as 'profile.titles.diplomat');
  const continent = /^expert_(.+)$/.exec(key)?.[1];
  if (continent && CONTINENTS.has(continent)) {
    return t('profile.titles.expert', { continent: t(`profile.continents.${continent}` as 'profile.continents.europe') });
  }
  const season = /^s(\d+)_champion$/.exec(key)?.[1];
  if (season) return t('profile.titles.seasonChampion', { season });
  return humanizeId(titleId);
}
