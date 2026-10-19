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
  }

  const known = new Set(['wikidataId', 'name', 'role', 'bio', 'stats', 'ability']);
  const unknown = Object.keys(value).filter((k) => !known.has(k));
  if (unknown.length > 0) errors.push(`unknown keys: ${unknown.join(', ')}`);
  return errors;
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
    },
  };
}
