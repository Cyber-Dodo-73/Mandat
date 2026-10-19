import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CARD_COUNT, CONTINENT_QUOTAS, COUNTRY_CAPS, FAME_WEIGHTS, PATHS, RARITY_TIERS, SEASON } from './config.ts';
import { placeholderContent, validateCatalogBalance, validateContent } from './content.ts';
import { eraOf } from './era.ts';
import { checkFirstPack, FIRST_PACK_RULES } from './firstPack.ts';
import { continentOfIso, type HistoricStateOverride, isSovereignPlace, type Place, resolveCandidatePlace, resolvePlace } from './geo.ts';
import { fetchPageviews, pageviewWindow } from './pageviews.ts';
import { type Exclusions, exclusionReason } from './politics.ts';
import { scoreCandidates } from './score.ts';
import { selectCards } from './select.ts';
import type { Candidate, Card, Continent, CardContent, Localized, RankedCandidate, ResolvedCandidate, ScoredCandidate } from './types.ts';
import { fetchCandidateDetails, fetchCategoryMembers, fetchPlaceFacts, type PlaceFacts } from './wikidata.ts';

type SensitiveEntry = { wikidataId: string; name: string; reason: string };
type CountryOverride = { name: string; iso: string; continent?: Continent; reason: string };
type Dropped = { qid: string; name: string; reason: string };

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

const progress = (label: string) => (done: number, total: number) => {
  if (done === total || done % Math.max(1, Math.floor(total / 10)) === 0) console.log(`  ${label} ${done}/${total}`);
};

/** Step 1: candidates and place facts from Wikidata (cached per query). */
export async function fetchRaw(): Promise<{ candidates: Candidate[]; places: Map<string, PlaceFacts> }> {
  console.log('Fetching category members from Wikidata…');
  const members = await fetchCategoryMembers();
  console.log(`  ${members.size} unique people`);
  console.log('Fetching candidate details…');
  const candidates = await fetchCandidateDetails(members, progress('batches'));
  const placeQids = candidates.flatMap((c) => [
    ...c.citizenshipQids,
    ...(c.birthCountryQid ? [c.birthCountryQid] : []),
    ...c.positions.flatMap((p) => (p.jurisdictionQid ? [p.jurisdictionQid] : [])),
  ]);
  console.log('Fetching place facts…');
  const places = await fetchPlaceFacts(placeQids);
  await writeJson(PATHS.candidatesRaw, { candidates, places: [...places.values()] });
  return { candidates, places };
}

const CATEGORY_ROLES: Record<string, Localized> = {
  civil_rights_advocate: { fr: 'Militant des droits civiques', en: 'Civil rights activist' },
  human_rights_activist: { fr: 'Défenseur des droits humains', en: 'Human rights activist' },
  revolutionary: { fr: 'Révolutionnaire', en: 'Revolutionary' },
  freedom_fighter: { fr: "Combattant de l'indépendance", en: 'Independence fighter' },
  political_activist: { fr: 'Militant politique', en: 'Political activist' },
  diplomat: { fr: 'Diplomate', en: 'Diplomat' },
  statesperson: { fr: "Homme d'État", en: 'Statesperson' },
  monarch: { fr: 'Monarque', en: 'Monarch' },
  politician: { fr: 'Personnalité politique', en: 'Politician' },
};

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('fr') + s.slice(1);

/** Draft role from the most notable position, else from the category. Content can override it. */
export function draftRole(c: Candidate): Localized {
  const top = c.positions[0];
  if (top) return { fr: capitalize(top.label.fr), en: capitalize(top.label.en) };
  for (const category of Object.keys(CATEGORY_ROLES)) {
    if (c.categories.includes(category)) return CATEGORY_ROLES[category] as Localized;
  }
  return CATEGORY_ROLES.politician as Localized;
}

/** Step 2: drops excluded people, resolves country/continent/era. */
export function resolveCandidates(
  candidates: readonly Candidate[],
  places: ReadonlyMap<string, PlaceFacts>,
  historicStates: Readonly<Record<string, HistoricStateOverride>>,
  exclusions: Exclusions,
  countryOverrides: Readonly<Record<string, CountryOverride>> = {},
): { resolved: ResolvedCandidate[]; dropped: Dropped[] } {
  const cache = new Map<string, Place | null>();
  const resolve = (qid: string) => {
    if (!cache.has(qid)) cache.set(qid, resolvePlace(qid, places, historicStates));
    return cache.get(qid) ?? null;
  };
  const isSovereign = (qid: string) => isSovereignPlace(qid, places, historicStates);
  const resolved: ResolvedCandidate[] = [];
  const dropped: Dropped[] = [];
  for (const c of candidates) {
    const drop = (reason: string) => dropped.push({ qid: c.qid, name: c.name.en, reason });
    const excluded = exclusionReason(c, exclusions, isSovereign);
    if (excluded) {
      drop(excluded);
      continue;
    }
    const birthYear = c.birthYear ?? (c.deathYear !== null ? c.deathYear - 50 : null);
    if (birthYear === null) {
      drop('no birth, floruit or death date');
      continue;
    }
    const override = countryOverrides[c.qid];
    const overrideContinent = override ? (override.continent ?? continentOfIso(override.iso)) : null;
    const place = override && overrideContinent ? { iso: override.iso, continent: overrideContinent } : resolveCandidatePlace(c, resolve);
    if (!place) {
      drop(`no resolvable country (citizenship: ${c.citizenshipQids.join(',') || '-'}, birth: ${c.birthCountryQid ?? '-'})`);
      continue;
    }
    resolved.push({ ...c, birthYear, country: place.iso, continent: place.continent, era: eraOf(birthYear) });
  }
  return { resolved, dropped };
}

async function loadContent(qid: string): Promise<unknown | undefined> {
  try {
    return await readJson<unknown>(path.join(PATHS.content, `${qid}.json`));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new Error(`data/content/${qid}.json: ${(error as Error).message}`);
  }
}

/** Step 4: merges ranked candidates with hand-written content into the final cards. */
export async function mergeCards(
  ranked: readonly RankedCandidate[],
  sensitiveQids: ReadonlySet<string>,
  allowMissingContent: boolean,
): Promise<{ cards: Card[]; missing: string[]; errors: string[] }> {
  const cards: Card[] = [];
  const missing: string[] = [];
  const errors: string[] = [];
  for (const c of ranked) {
    const sensitive = sensitiveQids.has(c.qid);
    const raw = await loadContent(c.qid);
    let content: CardContent;
    if (raw === undefined) {
      missing.push(c.qid);
      content = placeholderContent(c.qid);
    } else {
      const problems = validateContent(raw, c.qid, sensitive);
      errors.push(...problems.map((p) => `data/content/${c.qid}.json (${c.name.en}): ${p}`));
      content = raw as CardContent;
    }
    cards.push({
      id: `s${SEASON}-${String(c.number).padStart(3, '0')}`,
      wikidataId: c.qid,
      number: c.number,
      name: content.name ?? c.name,
      role: content.role ?? draftRole(c),
      country: c.country,
      continent: c.continent,
      era: c.era,
      birthYear: c.birthYear,
      deathYear: c.deathYear,
      isLiving: c.deathYear === null,
      fameScore: c.fameScore,
      rarity: c.rarity,
      bio: content.bio,
      stats: content.stats,
      ability: content.ability,
      sensitive,
    });
  }
  const withContent = cards.filter((card) => !missing.includes(card.wikidataId));
  errors.push(...validateCatalogBalance(withContent));
  if (missing.length > 0 && !allowMissingContent) {
    errors.push(`${missing.length} cards have no content file in data/content/ (use --allow-missing-content for drafts).`);
  }
  return { cards, missing, errors };
}

export type BuildOptions = { asOf: Date; allowMissingContent: boolean; refetch: boolean };

export async function build(options: BuildOptions): Promise<void> {
  const { candidates, places } = options.refetch
    ? await fetchRaw()
    : await readJson<{ candidates: Candidate[]; places: PlaceFacts[] }>(PATHS.candidatesRaw)
        .then((raw) => ({ candidates: raw.candidates, places: new Map(raw.places.map((p) => [p.qid, p])) }))
        .catch(() => fetchRaw());

  const historicStates = await readJson<Record<string, HistoricStateOverride>>(PATHS.historicStates);
  const exclusions = await readJson<Exclusions>(PATHS.exclusions);
  const countryOverrides = await readJson<Record<string, CountryOverride>>(PATHS.countryOverrides);
  const sensitiveList = await readJson<SensitiveEntry[]>(PATHS.sensitive);
  const sensitiveQids = new Set(sensitiveList.map((s) => s.wikidataId));

  const { resolved, dropped } = resolveCandidates(candidates, places, historicStates, exclusions, countryOverrides);
  console.log(`Resolved ${resolved.length} candidates, dropped ${dropped.length}.`);

  console.log('Fetching pageviews…');
  const pageviews = await fetchPageviews(resolved, options.asOf, progress('articles'));
  const scored: ScoredCandidate[] = scoreCandidates(resolved, pageviews);
  const { cards: ranked, warnings, pushes } = selectCards(scored, CONTINENT_QUOTAS, CARD_COUNT, RARITY_TIERS, COUNTRY_CAPS);
  for (const w of warnings) console.warn(`WARN ${w}`);

  const rankedByQid = new Map(ranked.map((r) => [r.qid, r]));
  await writeJson(PATHS.candidatesOut, {
    season: SEASON,
    asOf: options.asOf.toISOString().slice(0, 10),
    pageviewWindow: pageviewWindow(options.asOf),
    weights: FAME_WEIGHTS,
    quotas: CONTINENT_QUOTAS,
    countryCaps: COUNTRY_CAPS,
    warnings,
    capPushes: pushes,
    pool: scored.map((c, index) => ({
      poolRank: index + 1,
      qid: c.qid,
      name: c.name.en,
      country: c.country,
      continent: c.continent,
      era: c.era,
      birthYear: c.birthYear,
      deathYear: c.deathYear,
      sitelinks: c.sitelinks,
      pageviews: c.pageviews,
      fameScore: c.fameScore,
      topPosition: c.positions[0]?.label.en ?? null,
      categories: c.categories,
      cardRank: rankedByQid.get(c.qid)?.rank ?? null,
      cardNumber: rankedByQid.get(c.qid)?.number ?? null,
      role: rankedByQid.has(c.qid) ? draftRole(c) : null,
      rarity: rankedByQid.get(c.qid)?.rarity ?? null,
      viaQuota: rankedByQid.get(c.qid)?.viaQuota ?? false,
    })),
    dropped,
  });

  const { cards, missing, errors } = await mergeCards(ranked, sensitiveQids, options.allowMissingContent);
  const firstPack = checkFirstPack(cards);
  errors.push(...firstPack.errors.map((e) => `firstPackRules: ${e}`));
  await writeJson(PATHS.firstPackRules, FIRST_PACK_RULES);
  await writeJson(PATHS.firstPackReport, { patterns: firstPack.patterns, byContinent: firstPack.byContinent, byEra: firstPack.byEra });
  console.log(`First pack: ${firstPack.patterns} valid (continent, era) patterns.`);
  const unknownSensitive = sensitiveList.filter((s) => !candidates.some((c) => c.qid === s.wikidataId));
  if (unknownSensitive.length > 0) {
    console.log(`Note: ${unknownSensitive.length} sensitive entries are not in the candidate pool (fine).`);
  }
  if (missing.length > 0) console.warn(`WARN ${missing.length}/${cards.length} cards use placeholder content.`);
  if (errors.length > 0) {
    for (const e of errors.slice(0, 50)) console.error(`ERROR ${e}`);
    if (errors.length > 50) console.error(`… and ${errors.length - 50} more errors`);
    throw new Error(`Content validation failed with ${errors.length} error(s); cards.season1.json not written.`);
  }
  // Content hash: lets the API seed idempotently and the app detect catalog changes.
  const version = createHash('sha256').update(JSON.stringify(cards)).digest('hex').slice(0, 16);
  await writeJson(PATHS.cardsOut, { season: SEASON, version, cards });
  console.log(`Wrote ${cards.length} cards to ${path.relative(PATHS.root, PATHS.cardsOut)}.`);
}

/** Lists content files that no longer match a selected card (e.g. after a re-rank). */
export async function orphanContentFiles(selectedQids: ReadonlySet<string>): Promise<string[]> {
  const files = await readdir(PATHS.content).catch(() => [] as string[]);
  return files.filter((f) => /^Q\d+\.json$/.test(f) && !selectedQids.has(f.replace('.json', '')));
}
