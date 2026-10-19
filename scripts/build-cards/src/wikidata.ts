import { getJson } from './http.ts';
import type { Candidate, Localized, Position } from './types.ts';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const BATCH_SIZE = 150;

type Binding = Record<string, { value: string } | undefined>;
type SparqlResponse = { results: { bindings: Binding[] } };

export async function sparql(query: string): Promise<Binding[]> {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query.replace(/\s+/g, ' ').trim())}`;
  const res = await getJson<SparqlResponse>('wikidata', url, {
    accept: 'application/sparql-results+json',
  });
  return res.results.bindings;
}

const qidOf = (uri: string | undefined): string | null =>
  uri ? (uri.match(/(Q\d+)$/)?.[1] ?? null) : null;

const val = (b: Binding, key: string): string | undefined => b[key]?.value;

/**
 * Converts a WDQS xsd:dateTime to a historical year (no year 0: 1 BCE = -1).
 * WDQS follows XSD 1.1 where year 0000 is 1 BCE, so "-0099" is 100 BCE.
 */
export function toHistoricalYear(dateTime: string): number | null {
  const match = dateTime.match(/^(-?)(\d+)-/);
  if (!match) return null;
  const year = Number(match[2]) * (match[1] === '-' ? -1 : 1);
  return year <= 0 ? year - 1 : year;
}

/** A query surfacing people for a category, bounded by a minimum sitelink count. */
export type CategoryQuery = { name: string; minSitelinks: number; where: string };

export const CATEGORY_QUERIES: CategoryQuery[] = [
  { name: 'head_of_state', minSitelinks: 30, where: '?pos wdt:P279* wd:Q48352 . ?p wdt:P39 ?pos .' },
  { name: 'head_of_government', minSitelinks: 30, where: '?pos wdt:P279* wd:Q2285706 . ?p wdt:P39 ?pos .' },
  { name: 'monarch_position', minSitelinks: 30, where: '?pos wdt:P279* wd:Q116 . ?p wdt:P39 ?pos .' },
  { name: 'monarch', minSitelinks: 30, where: '?p wdt:P106 wd:Q116 .' },
  { name: 'politician', minSitelinks: 60, where: '?p wdt:P106 wd:Q82955 .' },
  { name: 'statesperson', minSitelinks: 40, where: '?p wdt:P106 wd:Q372436 .' },
  { name: 'revolutionary', minSitelinks: 30, where: '?p wdt:P106 wd:Q3242115 .' },
  { name: 'civil_rights_advocate', minSitelinks: 30, where: '?p wdt:P106 wd:Q1021386 .' },
  { name: 'human_rights_activist', minSitelinks: 30, where: '?p wdt:P106 wd:Q1476215 .' },
  { name: 'political_activist', minSitelinks: 40, where: '?p wdt:P106 wd:Q11499147 .' },
  { name: 'freedom_fighter', minSitelinks: 30, where: '?p wdt:P106 wd:Q30242234 .' },
  { name: 'diplomat', minSitelinks: 50, where: '?p wdt:P106 wd:Q193391 .' },
];

/** Returns QID → categories for every human matching at least one category. */
export async function fetchCategoryMembers(
  queries: CategoryQuery[] = CATEGORY_QUERIES,
): Promise<Map<string, Set<string>>> {
  const members = new Map<string, Set<string>>();
  for (const q of queries) {
    const rows = await sparql(`
      SELECT DISTINCT ?p WHERE {
        ${q.where}
        ?p wdt:P31 wd:Q5 ; wikibase:sitelinks ?sl .
        FILTER(?sl >= ${q.minSitelinks})
      }`);
    for (const row of rows) {
      const qid = qidOf(val(row, 'p'));
      if (!qid) continue;
      const set = members.get(qid) ?? new Set<string>();
      set.add(q.name);
      members.set(qid, set);
    }
    console.log(`  ${q.name}: ${rows.length}`);
  }
  return members;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const valuesClause = (qids: readonly string[]) => qids.map((q) => `wd:${q}`).join(' ');

/** Labels fall back to the language-neutral "mul" label Wikidata now uses for many names. */
const pickLabel = (b: Binding, fallback: string): Localized => {
  const en = val(b, 'en');
  const fr = val(b, 'fr');
  const mul = val(b, 'mul');
  return { en: en ?? mul ?? fr ?? fallback, fr: fr ?? mul ?? en ?? fallback };
};

/** Fetches the details needed to build cards, in batches, as separate light queries. */
export async function fetchCandidateDetails(
  members: Map<string, Set<string>>,
  onProgress?: (done: number, total: number) => void,
): Promise<Candidate[]> {
  const qids = [...members.keys()].sort();
  const byQid = new Map<string, Candidate>();
  const batches = chunk(qids, BATCH_SIZE);

  for (const [index, batch] of batches.entries()) {
    const values = valuesClause(batch);

    const core = await sparql(`
      SELECT ?p ?en ?fr ?mul ?sl ?article ?birth ?death ?floruit WHERE {
        VALUES ?p { ${values} }
        ?p wikibase:sitelinks ?sl .
        OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en) = "en") }
        OPTIONAL { ?p rdfs:label ?fr FILTER(LANG(?fr) = "fr") }
        OPTIONAL { ?p rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
        OPTIONAL { ?article schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> }
        OPTIONAL { ?p wdt:P569 ?birth }
        OPTIONAL { ?p wdt:P570 ?death }
        OPTIONAL { ?p wdt:P1317 ?floruit }
      }`);
    for (const row of core) {
      const qid = qidOf(val(row, 'p'));
      if (!qid) continue;
      const existing = byQid.get(qid);
      const birth = val(row, 'birth') ?? val(row, 'floruit');
      const birthYear = birth ? toHistoricalYear(birth) : null;
      const death = val(row, 'death');
      const deathYear = death ? toHistoricalYear(death) : null;
      if (existing) {
        // Several truthy dates: keep the earliest, deterministically.
        if (birthYear !== null && (existing.birthYear === null || birthYear < existing.birthYear)) {
          existing.birthYear = birthYear;
        }
        if (deathYear !== null && (existing.deathYear === null || deathYear < existing.deathYear)) {
          existing.deathYear = deathYear;
        }
        continue;
      }
      const article = val(row, 'article');
      byQid.set(qid, {
        qid,
        name: pickLabel(row, qid),
        sitelinks: Number(val(row, 'sl') ?? 0),
        enwikiTitle: article
          ? decodeURIComponent(article.replace('https://en.wikipedia.org/wiki/', ''))
          : null,
        birthYear,
        deathYear,
        citizenshipQids: [],
        birthCountryQid: null,
        positions: [],
        occupationQids: [],
        categories: [...(members.get(qid) ?? [])].sort(),
      });
    }

    const places = await sparql(`
      SELECT ?p ?cit ?bc WHERE {
        VALUES ?p { ${values} }
        { ?p wdt:P27 ?cit } UNION { ?p wdt:P19/wdt:P17 ?bc }
      }`);
    for (const row of places) {
      const candidate = byQid.get(qidOf(val(row, 'p')) ?? '');
      if (!candidate) continue;
      const cit = qidOf(val(row, 'cit'));
      const bc = qidOf(val(row, 'bc'));
      if (cit && !candidate.citizenshipQids.includes(cit)) candidate.citizenshipQids.push(cit);
      if (bc && !candidate.birthCountryQid) candidate.birthCountryQid = bc;
    }

    const positions = await sparql(`
      SELECT ?p ?pos ?en ?fr ?mul ?sl ?jur WHERE {
        VALUES ?p { ${values} }
        ?p wdt:P39 ?pos .
        ?pos wikibase:sitelinks ?sl .
        OPTIONAL { ?pos rdfs:label ?en FILTER(LANG(?en) = "en") }
        OPTIONAL { ?pos rdfs:label ?fr FILTER(LANG(?fr) = "fr") }
        OPTIONAL { ?pos rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
        OPTIONAL { ?pos wdt:P1001 ?jur }
      }`);
    for (const row of positions) {
      const candidate = byQid.get(qidOf(val(row, 'p')) ?? '');
      const posQid = qidOf(val(row, 'pos'));
      if (!candidate || !posQid) continue;
      if (candidate.positions.some((p) => p.qid === posQid)) continue;
      candidate.positions.push({
        qid: posQid,
        label: pickLabel(row, posQid),
        sitelinks: Number(val(row, 'sl') ?? 0),
        jurisdictionQid: qidOf(val(row, 'jur')),
      });
    }
    const occupations = await sparql(`
      SELECT ?p ?occ WHERE {
        VALUES ?p { ${values} }
        ?p wdt:P106 ?occ .
      }`);
    for (const row of occupations) {
      const candidate = byQid.get(qidOf(val(row, 'p')) ?? '');
      const occ = qidOf(val(row, 'occ'));
      if (candidate && occ && !candidate.occupationQids.includes(occ)) candidate.occupationQids.push(occ);
    }

    for (const qid of batch) {
      byQid.get(qid)?.occupationQids.sort();
      byQid.get(qid)?.positions.sort((a, b) => b.sitelinks - a.sitelinks || a.qid.localeCompare(b.qid));
    }
    onProgress?.(index + 1, batches.length);
  }
  return [...byQid.values()];
}

/** Country-like entity facts used to resolve an ISO code. */
export type PlaceFacts = {
  qid: string;
  label: string;
  iso: string | null;
  /** ISO codes of the country the entity sits in (P17), when it is a region or city. */
  parentIsos: string[];
  /** ISO codes of the modern countries of the entity's capital(s) (P36 → P17). */
  capitalIsos: string[];
};

export async function fetchPlaceFacts(qids: readonly string[]): Promise<Map<string, PlaceFacts>> {
  const facts = new Map<string, PlaceFacts>();
  const seenCapitals = new Set<string>();
  for (const batch of chunk([...new Set(qids)].sort(), BATCH_SIZE)) {
    const rows = await sparql(`
      SELECT ?e ?label ?iso ?parentIso ?capital ?capitalIso WHERE {
        VALUES ?e { ${valuesClause(batch)} }
        OPTIONAL { ?e rdfs:label ?label FILTER(LANG(?label) = "en") }
        OPTIONAL { ?e wdt:P297 ?iso }
        OPTIONAL { ?e wdt:P17/wdt:P297 ?parentIso }
        OPTIONAL { ?e wdt:P36 ?capital . ?capital wdt:P17/wdt:P297 ?capitalIso }
      }`);
    for (const row of rows) {
      const qid = qidOf(val(row, 'e'));
      if (!qid) continue;
      const f = facts.get(qid) ?? { qid, label: val(row, 'label') ?? qid, iso: null, parentIsos: [], capitalIsos: [] };
      const iso = val(row, 'iso');
      if (iso && !f.iso) f.iso = iso;
      const parent = val(row, 'parentIso');
      if (parent && !f.parentIsos.includes(parent)) f.parentIsos.push(parent);
      const capitalIso = val(row, 'capitalIso');
      const capitalKey = `${qid}|${val(row, 'capital')}|${capitalIso}`;
      if (capitalIso && !seenCapitals.has(capitalKey)) {
        seenCapitals.add(capitalKey);
        f.capitalIsos.push(capitalIso); // one vote per capital
      }
      facts.set(qid, f);
    }
  }
  return facts;
}
