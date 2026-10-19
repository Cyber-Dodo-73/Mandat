import type { CardContent, Localized, Rarity, Stats } from './types.ts';
import { RARITIES } from './types.ts';

export const STAT_KEYS = ['influence', 'diplomacy', 'charisma', 'strategy'] as const satisfies ReadonlyArray<keyof Stats>;
export const STAT_MIN = 1;
export const STAT_MAX = 10;
/** Sensitive figures never reach the top of any stat. */
export const SENSITIVE_STAT_MAX = 8;
/** Above this |Spearman rho| between rarity and total stats, power is considered tied to rarity. */
export const MAX_RARITY_STAT_CORRELATION = 0.3;
const MIN_CARDS_FOR_CORRELATION = 30;

export const BIO_SENTENCES = { min: 2, max: 3 } as const;
export const BIO_LENGTH = { min: 80, max: 600 } as const;
export const ABILITY_NAME_MAX = 40;
export const ABILITY_DESCRIPTION_MAX = 220;

const ABBREVIATIONS = [
  'J.-C.', 'av.', 'apr.', 'env.', 'St.', 'Dr.', 'Mr.', 'Mrs.', 'Jr.', 'Sr.', 'U.S.', 'U.K.',
  'U.N.', 'e.g.', 'i.e.', 'etc.', 'c.', 'ca.', 'vs.', 'Mt.', 'n°', 'No.', 'BC.', 'AD.',
];

/** Counts sentences, ignoring common abbreviations and initials ("F. D. Roosevelt"). */
export function countSentences(text: string): number {
  let masked = text.trim();
  for (const abbr of ABBREVIATIONS) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    masked = masked.replace(new RegExp(`(?<!\\p{L})${escaped}`, 'gu'), abbr.replace(/\./g, '§'));
  }
  masked = masked.replace(/\b([A-Z])\.(?=\s*[A-Z])/g, '$1§');
  const parts = masked.split(/[.!?…]+(?=\s|$)/).map((s) => s.trim()).filter(Boolean);
  return parts.length;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkLocalized(value: unknown, field: string, errors: string[], maxLength?: number): value is Localized {
  if (!isRecord(value)) {
    errors.push(`${field}: expected { fr, en }`);
    return false;
  }
  let ok = true;
  for (const lang of ['fr', 'en'] as const) {
    const text = value[lang];
    if (typeof text !== 'string' || text.trim() === '') {
      errors.push(`${field}.${lang}: required non-empty string`);
      ok = false;
    } else if (maxLength !== undefined && text.length > maxLength) {
      errors.push(`${field}.${lang}: ${text.length} chars > ${maxLength}`);
      ok = false;
    }
  }
  return ok;
}

/** Validates one content file. Returns the list of problems (empty when valid). */
export function validateContent(value: unknown, expectedQid: string, sensitive: boolean): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['content: expected an object'];
  if (value.wikidataId !== expectedQid) errors.push(`wikidataId: expected ${expectedQid}, got ${String(value.wikidataId)}`);

  if (value.name !== undefined) checkLocalized(value.name, 'name', errors, 60);
  if (value.role !== undefined) checkLocalized(value.role, 'role', errors, 80);

  if (checkLocalized(value.bio, 'bio', errors)) {
    for (const lang of ['fr', 'en'] as const) {
      const bio = value.bio[lang];
      const sentences = countSentences(bio);
      if (sentences < BIO_SENTENCES.min || sentences > BIO_SENTENCES.max) {
        errors.push(`bio.${lang}: ${sentences} sentences, expected ${BIO_SENTENCES.min}–${BIO_SENTENCES.max}`);
      }
      if (bio.length < BIO_LENGTH.min || bio.length > BIO_LENGTH.max) {
        errors.push(`bio.${lang}: ${bio.length} chars, expected ${BIO_LENGTH.min}–${BIO_LENGTH.max}`);
      }
    }
  }

  if (!isRecord(value.stats)) {
    errors.push('stats: expected an object');
  } else {
    const max = sensitive ? SENSITIVE_STAT_MAX : STAT_MAX;
    for (const key of STAT_KEYS) {
      const stat = value.stats[key];
      if (typeof stat !== 'number' || !Number.isInteger(stat) || stat < STAT_MIN || stat > max) {
        errors.push(`stats.${key}: expected an integer ${STAT_MIN}–${max}${sensitive ? ' (sensitive card)' : ''}`);
      }
    }
    const extra = Object.keys(value.stats).filter((k) => !(STAT_KEYS as readonly string[]).includes(k));
    if (extra.length > 0) errors.push(`stats: unknown keys ${extra.join(', ')}`);
  }

  if (!isRecord(value.ability)) {
    errors.push('ability: expected { name, description }');
  } else {
    checkLocalized(value.ability.name, 'ability.name', errors, ABILITY_NAME_MAX);
    checkLocalized(value.ability.description, 'ability.description', errors, ABILITY_DESCRIPTION_MAX);
    errors.push(...validateEffect(value.ability.effect));
  }

  errors.push(...validateLongForm(value));

  const known = new Set(['wikidataId', 'name', 'role', 'bio', 'stats', 'ability', 'story', 'highlights', 'legacy']);
  const unknown = Object.keys(value).filter((k) => !known.has(k));
  if (unknown.length > 0) errors.push(`unknown keys: ${unknown.join(', ')}`);
  return errors;
}

export const STORY_SENTENCES = { min: 6, max: 10 } as const;
export const STORY_LENGTH = { min: 600, max: 1600 } as const;
export const HIGHLIGHTS_COUNT = { min: 3, max: 5 } as const;
export const HIGHLIGHT_MAX = 140;
export const LEGACY_SENTENCES = { min: 1, max: 2 } as const;
export const LEGACY_MAX = 320;

/** Optional long-form fields (story, highlights, legacy): validated only when present. */
export function validateLongForm(value: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (value.story !== undefined && checkLocalized(value.story, 'story', errors)) {
    for (const lang of ['fr', 'en'] as const) {
      const text = value.story[lang];
      const sentences = countSentences(text);
      if (sentences < STORY_SENTENCES.min || sentences > STORY_SENTENCES.max) {
        errors.push(`story.${lang}: ${sentences} sentences, expected ${STORY_SENTENCES.min}–${STORY_SENTENCES.max}`);
      }
      if (text.length < STORY_LENGTH.min || text.length > STORY_LENGTH.max) {
        errors.push(`story.${lang}: ${text.length} chars, expected ${STORY_LENGTH.min}–${STORY_LENGTH.max}`);
      }
    }
  }
  if (value.highlights !== undefined) {
    const h = value.highlights;
    if (!isRecord(h) || !Array.isArray(h.fr) || !Array.isArray(h.en)) {
      errors.push('highlights: expected { fr: string[], en: string[] }');
    } else {
      for (const lang of ['fr', 'en'] as const) {
        const list = h[lang] as unknown[];
        if (list.length < HIGHLIGHTS_COUNT.min || list.length > HIGHLIGHTS_COUNT.max) {
          errors.push(`highlights.${lang}: ${list.length} items, expected ${HIGHLIGHTS_COUNT.min}–${HIGHLIGHTS_COUNT.max}`);
        }
        list.forEach((item, i) => {
          if (typeof item !== 'string' || !item.trim()) errors.push(`highlights.${lang}[${i}]: required non-empty string`);
          else if (item.length > HIGHLIGHT_MAX) errors.push(`highlights.${lang}[${i}]: ${item.length} chars > ${HIGHLIGHT_MAX}`);
        });
      }
      if ((h.fr as unknown[]).length !== (h.en as unknown[]).length) errors.push('highlights: fr and en must have the same number of items');
    }
  }
  if (value.legacy !== undefined && checkLocalized(value.legacy, 'legacy', errors, LEGACY_MAX)) {
    for (const lang of ['fr', 'en'] as const) {
      const sentences = countSentences(value.legacy[lang]);
      if (sentences < LEGACY_SENTENCES.min || sentences > LEGACY_SENTENCES.max) {
        errors.push(`legacy.${lang}: ${sentences} sentences, expected ${LEGACY_SENTENCES.min}–${LEGACY_SENTENCES.max}`);
      }
    }
  }
  return errors;
}

/** Card facts an ability condition depends on. */
export type AbilityContext = { rarity: Rarity; era: string; continent: string };

/**
 * Problems that make an ability unable to ever trigger, or its text inconsistent:
 * - "opponentRarityHigher" on a mythic (nothing is rarer);
 * - a bonus/malus on one stat gated by "roundDomain" on another stat (an effect only counts
 *   when its stat is the round's domain, so it could never apply);
 * - French text saying "round" (the game says "manche") or using a hyphen as a minus sign.
 */
export function abilityIssues(ability: unknown, ctx: AbilityContext): string[] {
  if (!isRecord(ability) || !isRecord(ability.effect)) return [];
  const issues: string[] = [];
  const effect = ability.effect;
  const condition = isRecord(effect.condition) ? effect.condition : {};
  if (condition.kind === 'opponentRarityHigher' && ctx.rarity === 'mythic') {
    issues.push('ability.effect: "opponentRarityHigher" can never trigger on a mythic card');
  }
  if (
    condition.kind === 'roundDomain' &&
    effect.type !== 'tieBreaker' &&
    effect.stat !== 'any' &&
    effect.stat !== condition.value
  ) {
    issues.push(`ability.effect: a ${String(effect.type)} on ${String(effect.stat)} gated by round domain ${String(condition.value)} can never apply`);
  }
  const description = isRecord(ability.description) ? ability.description : {};
  if (typeof description.fr === 'string') {
    if (/\bround\b/i.test(description.fr)) issues.push('ability.description.fr: use "manche", not "round"');
    if (/(^|[\s(])-\d/.test(description.fr)) issues.push('ability.description.fr: use the minus sign "−" before numbers');
  }
  if (typeof description.en === 'string' && /(^|[\s(])-\d/.test(description.en)) {
    issues.push('ability.description.en: use the minus sign "−" before numbers');
  }
  return issues;
}

export const statTotal = (stats: Stats) => STAT_KEYS.reduce((sum, key) => sum + stats[key], 0);

function ranks(values: readonly number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const result = new Array<number>(values.length);
  for (let start = 0; start < order.length; ) {
    let end = start;
    while (end + 1 < order.length && order[end + 1]?.v === order[start]?.v) end++;
    const avg = (start + end) / 2 + 1;
    for (let k = start; k <= end; k++) result[(order[k] as { i: number }).i] = avg;
    start = end + 1;
  }
  return result;
}

/** Spearman rank correlation (average ranks for ties). Returns 0 when undefined. */
export function spearman(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return 0;
  const rx = ranks(xs);
  const ry = ranks(ys);
  const mean = (n + 1) / 2;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (rx[i] as number) - mean;
    const dy = (ry[i] as number) - mean;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  return vx === 0 || vy === 0 ? 0 : cov / Math.sqrt(vx * vy);
}

const EFFECT_TYPES = ['bonus', 'malus', 'tieBreaker'] as const;
const EFFECT_STATS = [...STAT_KEYS, 'any'] as const;
const ERAS = ['antiquity', 'medieval', 'modern', 'contemporary'] as const;
const CONDITION_VALUES: Record<string, ReadonlyArray<string | number> | null> = {
  always: null,
  opponentContinent: ['same', 'different'],
  opponentEra: ERAS,
  roundDomain: STAT_KEYS,
  round: [1, 2, 3],
  behind: null,
  opponentRarityHigher: null,
};

/** Machine-readable ability effect used by the duel engine (see data/content/GUIDELINES.md). */
export function validateEffect(effect: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(effect)) return ['ability.effect: expected an object'];
  const type = effect.type;
  if (!(EFFECT_TYPES as readonly unknown[]).includes(type)) errors.push(`ability.effect.type: expected one of ${EFFECT_TYPES.join(', ')}`);
  if (type !== 'tieBreaker') {
    if (!(EFFECT_STATS as readonly unknown[]).includes(effect.stat)) errors.push(`ability.effect.stat: expected one of ${EFFECT_STATS.join(', ')}`);
    if (typeof effect.amount !== 'number' || !Number.isInteger(effect.amount) || effect.amount < 1 || effect.amount > 3) {
      errors.push('ability.effect.amount: expected an integer 1–3');
    }
  }
  const condition = effect.condition;
  if (!isRecord(condition) || typeof condition.kind !== 'string' || !(condition.kind in CONDITION_VALUES)) {
    errors.push(`ability.effect.condition.kind: expected one of ${Object.keys(CONDITION_VALUES).join(', ')}`);
  } else {
    const allowed = CONDITION_VALUES[condition.kind];
    if (allowed === null && condition.value !== undefined) errors.push(`ability.effect.condition: "${condition.kind}" takes no value`);
    if (allowed !== null && allowed !== undefined && !allowed.includes(condition.value as string | number)) {
      errors.push(`ability.effect.condition.value: expected one of ${allowed.join(', ')}`);
    }
    if (condition.kind === 'always' && type !== 'tieBreaker' && effect.amount !== 1) {
      errors.push('ability.effect.amount: an unconditional effect is limited to 1');
    }
  }
  return errors;
}

/** Cross-card checks: power must not follow rarity, sensitive cards never have the best stats. */
export function validateCatalogBalance(
  cards: ReadonlyArray<{ wikidataId: string; rarity: Rarity; stats: Stats; sensitive: boolean }>,
): string[] {
  const errors: string[] = [];
  if (cards.length >= MIN_CARDS_FOR_CORRELATION) {
    const rho = spearman(
      cards.map((c) => RARITIES.indexOf(c.rarity)),
      cards.map((c) => statTotal(c.stats)),
    );
    if (Math.abs(rho) > MAX_RARITY_STAT_CORRELATION) {
      errors.push(`Stat totals correlate with rarity (Spearman rho = ${rho.toFixed(2)}, max ±${MAX_RARITY_STAT_CORRELATION}).`);
    }
  }
  const regular = cards.filter((c) => !c.sensitive);
  if (regular.length > 0) {
    const bestRegular = Math.max(...regular.map((c) => statTotal(c.stats)));
    for (const c of cards.filter((card) => card.sensitive)) {
      if (statTotal(c.stats) >= bestRegular) {
        errors.push(`${c.wikidataId}: sensitive card total ${statTotal(c.stats)} must stay below the best regular total ${bestRegular}.`);
      }
    }
  }
  return errors;
}

export function placeholderContent(qid: string): CardContent {
  return {
    wikidataId: qid,
    bio: { fr: 'Contenu à rédiger.', en: 'Content to be written.' },
    stats: { influence: 5, diplomacy: 5, charisma: 5, strategy: 5 },
    ability: {
      name: { fr: 'À définir', en: 'To be defined' },
      description: { fr: 'Capacité à rédiger.', en: 'Ability to be written.' },
      effect: { type: 'tieBreaker', condition: { kind: 'behind' } },
    },
  };
}
