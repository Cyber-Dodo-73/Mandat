import type { PlaceFacts } from './wikidata.ts';
import type { Candidate, Continent } from './types.ts';

/**
 * ISO 3166-1 alpha-2 → continent, following the UN M49 geoscheme. Transcontinental
 * countries use their M49 region (Russia → Europe, Türkiye/Caucasus/Cyprus → Asia,
 * Egypt → Africa); Central America and the Caribbean → North America.
 */
const CONTINENT_ISOS: Record<Continent, string> = {
  africa:
    'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW',
  asia:
    'AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE IO CC CX',
  europe:
    'AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG VA HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB AX',
  north_america:
    'AI AG AW BS BB BZ BM BQ VG CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VI UM',
  south_america: 'AR BO BR CL CO EC FK GF GY PY PE SR UY VE GS BV',
  oceania: 'AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF HM',
};

const CONTINENT_BY_ISO = new Map<string, Continent>(
  (Object.entries(CONTINENT_ISOS) as [Continent, string][]).flatMap(([continent, isos]) =>
    isos.split(' ').map((iso) => [iso, continent] as const),
  ),
);

export function continentOfIso(iso: string): Continent | null {
  return CONTINENT_BY_ISO.get(iso) ?? null;
}

/** Manual mapping for historic states (see data/historic-states.json). */
export type HistoricStateOverride = {
  name: string;
  /** Modern-equivalent ISO code, or null to ignore this entity (e.g. supranational bodies). */
  iso: string | null;
  /** Continent override when the modern ISO's continent is misleading (e.g. Kingdom of Hawaii). */
  continent?: Continent;
  note?: string;
};

export type Place = { iso: string; continent: Continent };

function majority(values: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [v, count] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
    if (count > bestCount) {
      best = v;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Resolves a country-like entity to a modern ISO code and continent:
 * manual override → own ISO (P297) → containing country (P17) → country of its capital(s).
 */
export function resolvePlace(
  qid: string,
  facts: ReadonlyMap<string, PlaceFacts>,
  overrides: Readonly<Record<string, HistoricStateOverride>>,
): Place | null {
  const override = overrides[qid];
  if (override) {
    if (!override.iso) return null;
    const continent = override.continent ?? continentOfIso(override.iso);
    return continent ? { iso: override.iso, continent } : null;
  }
  const f = facts.get(qid);
  if (!f) return null;
  const iso = f.iso ?? majority(f.parentIsos) ?? majority(f.capitalIsos);
  if (!iso) return null;
  const continent = continentOfIso(iso);
  return continent ? { iso, continent } : null;
}

/**
 * Whether a place is a sovereign entity: a country with an ISO code, a historic state from the
 * manual table, or a state with no containing country that resolves through its capital.
 * Cities and regions (which have a containing country) are not sovereign.
 */
export function isSovereignPlace(
  qid: string,
  facts: ReadonlyMap<string, PlaceFacts>,
  overrides: Readonly<Record<string, HistoricStateOverride>>,
): boolean {
  const override = overrides[qid];
  if (override) return override.iso !== null;
  const f = facts.get(qid);
  if (!f) return false;
  return f.iso !== null || (f.parentIsos.length === 0 && f.capitalIsos.length > 0);
}

/** Vote weights used to pick a single country per person. */
export const COUNTRY_VOTE_WEIGHTS = { citizenship: 2, topJurisdiction: 1.5, birthCountry: 1 } as const;

/**
 * Picks the person's country: each citizenship votes, plus the jurisdiction of their most
 * notable position (if it has one) and their birth country. Ties break alphabetically for determinism.
 */
export function resolveCandidatePlace(
  candidate: Candidate,
  resolve: (qid: string) => Place | null,
): Place | null {
  const votes = new Map<string, { place: Place; weight: number }>();
  const vote = (place: Place | null, weight: number) => {
    if (!place) return;
    const key = `${place.iso}|${place.continent}`;
    const entry = votes.get(key) ?? { place, weight: 0 };
    entry.weight += weight;
    votes.set(key, entry);
  };

  for (const qid of candidate.citizenshipQids) vote(resolve(qid), COUNTRY_VOTE_WEIGHTS.citizenship);
  // Only the most notable position votes: a secondary title (George V as Emperor of India)
  // must not outweigh the person's main country.
  const top = candidate.positions[0];
  if (top?.jurisdictionQid) vote(resolve(top.jurisdictionQid), COUNTRY_VOTE_WEIGHTS.topJurisdiction);
  if (candidate.birthCountryQid) vote(resolve(candidate.birthCountryQid), COUNTRY_VOTE_WEIGHTS.birthCountry);

  const ranked = [...votes.entries()].sort(
    ([ka, a], [kb, b]) => b.weight - a.weight || ka.localeCompare(kb),
  );
  return ranked[0]?.[1].place ?? null;
}
