import { TIMELINE_MAX } from './config.ts';
import type { Localized, TimelineEntry, TimelineKind } from './types.ts';
import { TIMELINE_KINDS } from './types.ts';
import { sparql, toHistoricalYear } from './wikidata.ts';

const BATCH_SIZE = 50;

type Binding = Record<string, { value: string } | undefined>;

const qidOf = (uri: string | undefined): string | null => (uri ? (uri.match(/(Q\d+)$/)?.[1] ?? null) : null);
const val = (b: Binding, key: string): string | undefined => b[key]?.value;
const yearOf = (b: Binding, ...keys: string[]): number | null => {
  for (const key of keys) {
    const v = val(b, key);
    if (v) {
      const year = toHistoricalYear(v);
      if (year !== null) return year;
    }
  }
  return null;
};

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const values = (qids: readonly string[]) => qids.map((q) => `wd:${q}`).join(' ');

/** A fact before labels are resolved and before the notability cut. */
export type RawFact = {
  person: string;
  kind: TimelineKind;
  item: string;
  year: number;
  endYear?: number;
  /** Notability of the item (Wikipedia language editions), used to keep the best facts. */
  sitelinks: number;
  /** Optional "of" qualifier (e.g. member of parliament of …). */
  ofItem?: string;
  /** Countries the office applies to (P1001 / P17). */
  jurisdictions?: string[];
  /** Birth/death place is a country fallback (no town found): labelled "Naissance (pays)". */
  countryPlace?: boolean;
};

/** Maximum entries per kind before leftover slots are shared by notability. */
export const KIND_QUOTAS: Record<Exclude<TimelineKind, 'birth' | 'death'>, number> = {
  office: 6,
  event: 3,
  award: 2,
  education: 1,
};

async function labels(qids: readonly string[]): Promise<Map<string, Localized>> {
  const out = new Map<string, Localized>();
  for (const batch of chunk([...new Set(qids)].sort(), 150)) {
    const rows = await sparql(`
      SELECT ?e ?en ?fr ?mul WHERE {
        VALUES ?e { ${values(batch)} }
        OPTIONAL { ?e rdfs:label ?en FILTER(LANG(?en) = "en") }
        OPTIONAL { ?e rdfs:label ?fr FILTER(LANG(?fr) = "fr") }
        OPTIONAL { ?e rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
      }`);
    for (const row of rows) {
      const qid = qidOf(val(row, 'e'));
      if (!qid || out.has(qid)) continue;
      const en = val(row, 'en');
      const fr = val(row, 'fr');
      const mul = val(row, 'mul');
      if (!en && !fr && !mul) continue;
      out.set(qid, { en: en ?? mul ?? fr ?? qid, fr: fr ?? mul ?? en ?? qid });
    }
  }
  return out;
}

const FEMALE = 'Q6581072';
/** A birth/death place with fewer language editions than this is replaced by the town it is in. */
const PLACE_MIN_SITELINKS = 30;

/** Fetches the raw dated facts of each person (cached SPARQL, batched). */
export async function fetchRawFacts(
  people: readonly string[],
  female: Set<string> = new Set(),
): Promise<RawFact[]> {
  const facts: RawFact[] = [];
  for (const batch of chunk([...new Set(people)].sort(), BATCH_SIZE)) {
    const v = values(batch);

    const life = await sparql(`
      SELECT ?p ?sex ?birth ?death WHERE {
        VALUES ?p { ${v} }
        OPTIONAL { ?p wdt:P21 ?sex }
        OPTIONAL { ?p wdt:P569 ?birth }
        OPTIONAL { ?p wdt:P570 ?death }
      }`);
    const seenLife = new Set<string>();
    for (const row of life) {
      const person = qidOf(val(row, 'p'));
      if (!person) continue;
      if (qidOf(val(row, 'sex')) === FEMALE) female.add(person);
      const birth = yearOf(row, 'birth');
      if (birth !== null && !seenLife.has(`b${person}`)) {
        seenLife.add(`b${person}`);
        facts.push({ person, kind: 'birth', item: person, year: birth, sitelinks: Number.MAX_SAFE_INTEGER });
      }
      const death = yearOf(row, 'death');
      if (death !== null && !seenLife.has(`d${person}`)) {
        seenLife.add(`d${person}`);
        facts.push({ person, kind: 'death', item: person, year: death, sitelinks: Number.MAX_SAFE_INTEGER });
      }
    }

    // Birth/death places: a hospital or a street address climbs to the town it is in (P131).
    const places = await sparql(`
      SELECT ?p ?prop ?pl ?plsl ?up1 ?up1sl ?up2 ?up2sl ?pc WHERE {
        VALUES ?p { ${v} }
        VALUES ?prop { wdt:P19 wdt:P20 }
        ?p ?prop ?pl . ?pl wikibase:sitelinks ?plsl .
        OPTIONAL { ?pl wdt:P131 ?up1 . ?up1 wikibase:sitelinks ?up1sl .
          OPTIONAL { ?up1 wdt:P131 ?up2 . ?up2 wikibase:sitelinks ?up2sl } }
        OPTIONAL { ?pl wdt:P17 ?pc }
      }`);
    for (const row of places) {
      const person = qidOf(val(row, 'p'));
      if (!person) continue;
      const kind = val(row, 'prop')?.endsWith('P19') ? 'birth' : 'death';
      const chain = [
        [qidOf(val(row, 'pl')), Number(val(row, 'plsl') ?? 0)],
        [qidOf(val(row, 'up1')), Number(val(row, 'up1sl') ?? 0)],
        [qidOf(val(row, 'up2')), Number(val(row, 'up2sl') ?? 0)],
      ].filter((x): x is [string, number] => x[0] !== null);
      const town = chain.find(([, sl]) => sl >= PLACE_MIN_SITELINKS)?.[0];
      const country = qidOf(val(row, 'pc'));
      const fact = facts.find((f) => f.person === person && f.kind === kind);
      if (!fact || fact.item !== person) continue;
      if (town) fact.item = town;
      else if (country) {
        fact.item = country;
        fact.countryPlace = true;
      }
    }

    const offices = await sparql(`
      SELECT ?p ?pos ?sl ?start ?end ?of ?jur WHERE {
        VALUES ?p { ${v} }
        ?p p:P39 ?st . ?st ps:P39 ?pos . ?pos wikibase:sitelinks ?sl .
        OPTIONAL { ?st pq:P580 ?start }
        OPTIONAL { ?st pq:P582 ?end }
        OPTIONAL { ?st pq:P642 ?of }
        OPTIONAL { ?pos wdt:P1001|wdt:P17 ?jur }
      }`);
    for (const row of offices) {
      const person = qidOf(val(row, 'p'));
      const item = qidOf(val(row, 'pos'));
      const year = yearOf(row, 'start', 'end');
      // Only offices tied to a jurisdiction: drops generic roles like "chief executive officer".
      if (!person || !item || year === null || !val(row, 'jur')) continue;
      const end = yearOf(row, 'end');
      facts.push({
        person,
        kind: 'office',
        item,
        year,
        ...(end !== null && end > year ? { endYear: end } : {}),
        sitelinks: Number(val(row, 'sl') ?? 0),
        ...(qidOf(val(row, 'of')) ? { ofItem: qidOf(val(row, 'of')) as string } : {}),
        jurisdictions: [qidOf(val(row, 'jur')) as string],
      });
    }

    const awards = await sparql(`
      SELECT ?p ?aw ?sl ?t WHERE {
        VALUES ?p { ${v} }
        ?p p:P166 ?st . ?st ps:P166 ?aw . ?aw wikibase:sitelinks ?sl .
        OPTIONAL { ?st pq:P585 ?t }
      }`);
    for (const row of awards) {
      const person = qidOf(val(row, 'p'));
      const item = qidOf(val(row, 'aw'));
      const year = yearOf(row, 't');
      if (!person || !item || year === null) continue;
      facts.push({ person, kind: 'award', item, year, sitelinks: Number(val(row, 'sl') ?? 0) });
    }

    const events = await sparql(`
      SELECT ?p ?ev ?sl ?t ?evt ?evs ?eve WHERE {
        VALUES ?p { ${v} }
        ?p p:P1344 ?st . ?st ps:P1344 ?ev . ?ev wikibase:sitelinks ?sl .
        OPTIONAL { ?st pq:P585 ?t }
        OPTIONAL { ?ev wdt:P585 ?evt }
        OPTIONAL { ?ev wdt:P580 ?evs }
        OPTIONAL { ?ev wdt:P582 ?eve }
      }`);
    for (const row of events) {
      const person = qidOf(val(row, 'p'));
      const item = qidOf(val(row, 'ev'));
      const year = yearOf(row, 't', 'evt', 'evs');
      if (!person || !item || year === null) continue;
      const end = yearOf(row, 'eve');
      facts.push({
        person,
        kind: 'event',
        item,
        year,
        ...(end !== null && end > year ? { endYear: end } : {}),
        sitelinks: Number(val(row, 'sl') ?? 0),
      });
    }

    const education = await sparql(`
      SELECT ?p ?ed ?sl ?start ?end WHERE {
        VALUES ?p { ${v} }
        ?p p:P69 ?st . ?st ps:P69 ?ed . ?ed wikibase:sitelinks ?sl .
        OPTIONAL { ?st pq:P580 ?start }
        OPTIONAL { ?st pq:P582 ?end }
      }`);
    for (const row of education) {
      const person = qidOf(val(row, 'p'));
      const item = qidOf(val(row, 'ed'));
      const year = yearOf(row, 'start', 'end');
      if (!person || !item || year === null) continue;
      const end = yearOf(row, 'end');
      facts.push({
        person,
        kind: 'education',
        item,
        year,
        ...(end !== null && end > year ? { endYear: end } : {}),
        sitelinks: Number(val(row, 'sl') ?? 0),
      });
    }
  }
  return facts;
}

const KIND_ORDER: Record<TimelineKind, number> = { birth: 0, education: 1, office: 2, event: 3, award: 4, death: 5 };

const GENERIC: Record<'birth' | 'death', Localized> = {
  birth: { fr: 'Naissance', en: 'Birth' },
  death: { fr: 'Mort', en: 'Death' },
};

/**
 * Builds one person's timeline from raw facts: dedupes repeated statements (same kind, item
 * and year; overlapping terms of the same office are merged), keeps birth and death, then the
 * most notable other facts (by the item's sitelinks) up to `max`, sorted chronologically.
 */
export function buildTimeline(
  person: string,
  raw: readonly RawFact[],
  labelOf: (qid: string) => Localized | undefined,
  /** Countries the person belongs to (citizenship, birth country): their offices rank first. */
  home: ReadonlySet<string> = new Set(),
  max: number = TIMELINE_MAX,
): TimelineEntry[] {
  const mine = raw.filter((f) => f.person === person);
  const merged: RawFact[] = [];
  for (const f of [...mine].sort((a, b) => a.year - b.year)) {
    const same = merged.find(
      (m) =>
        m.kind === f.kind &&
        m.item === f.item &&
        (m.year === f.year || (f.kind === 'office' && f.year <= (m.endYear ?? m.year))),
    );
    if (same) {
      if (f.endYear !== undefined && (same.endYear === undefined || f.endYear > same.endYear)) same.endYear = f.endYear;
      for (const j of f.jurisdictions ?? []) {
        if (!(same.jurisdictions ?? []).includes(j)) same.jurisdictions = [...(same.jurisdictions ?? []), j];
      }
      continue;
    }
    // One birth and one death only (several truthy dates: keep the earliest).
    if ((f.kind === 'birth' || f.kind === 'death') && merged.some((m) => m.kind === f.kind)) continue;
    merged.push({ ...f });
  }
  // A recurring office (e.g. consul five times) keeps its first term and folds the later ones
  // into a second entry, so it cannot crowd the timeline.
  const folded: RawFact[] = [];
  for (const f of merged) {
    const sameItem = folded.filter((m) => m.kind === f.kind && m.item === f.item);
    if (sameItem.length < 2) {
      folded.push(f);
      continue;
    }
    const last = sameItem[1] as RawFact;
    const end = Math.max(last.endYear ?? last.year, f.endYear ?? f.year);
    if (end > last.year) last.endYear = end;
  }

  const toEntry = (f: RawFact): TimelineEntry | null => {
    let label: Localized | undefined;
    if (f.kind === 'birth' || f.kind === 'death') {
      const place = f.item !== person ? labelOf(f.item) : undefined;
      if (!place) label = GENERIC[f.kind];
      else if (f.countryPlace) {
        label = { fr: `${GENERIC[f.kind].fr} (${place.fr})`, en: `${GENERIC[f.kind].en} (${place.en})` };
      } else {
        label =
          f.kind === 'birth'
            ? { fr: `Naissance à ${place.fr}`, en: `Born in ${place.en}` }
            : { fr: `Mort à ${place.fr}`, en: `Died in ${place.en}` };
      }
    } else {
      const item = labelOf(f.item);
      if (!item) return null;
      const of = f.ofItem ? labelOf(f.ofItem) : undefined;
      label = of ? { fr: `${item.fr} (${of.fr})`, en: `${item.en} (${of.en})` } : item;
    }
    return {
      year: f.year,
      ...(f.endYear !== undefined ? { endYear: f.endYear } : {}),
      kind: f.kind,
      label: { fr: capitalize(label.fr), en: capitalize(label.en) },
      wikidataId: f.item,
    };
  };

  const entries = folded.map((f) => ({ f, e: toEntry(f) })).filter((x): x is { f: RawFact; e: TimelineEntry } => x.e !== null);
  const life = entries.filter((x) => x.f.kind === 'birth' || x.f.kind === 'death');
  // Offices in the person's own country first (Wikidata gives "Monarch of the United Kingdom"
  // fewer language editions than a foreign order), then notability; offices nobody documents
  // and that are foreign to the person are dropped.
  const homeOffice = (f: RawFact) => f.kind === 'office' && (f.jurisdictions ?? []).some((j) => home.has(j));
  const ranked = entries
    .filter((x) => x.f.kind !== 'birth' && x.f.kind !== 'death')
    .filter((x) => x.f.kind !== 'office' || x.f.sitelinks > 0 || homeOffice(x.f))
    .sort(
      (a, b) =>
        Number(homeOffice(b.f)) - Number(homeOffice(a.f)) ||
        b.f.sitelinks - a.f.sitelinks ||
        a.f.year - b.f.year ||
        a.f.item.localeCompare(b.f.item),
    );
  const slots = Math.max(0, max - life.length);
  const kept: typeof ranked = [];
  const perKind = new Map<TimelineKind, number>();
  for (const x of ranked) {
    if (kept.length >= slots) break;
    const quota = KIND_QUOTAS[x.f.kind as keyof typeof KIND_QUOTAS];
    const used = perKind.get(x.f.kind) ?? 0;
    if (used >= quota) continue;
    kept.push(x);
    perKind.set(x.f.kind, used + 1);
  }
  // Slots the quotas left empty go to the next most notable facts.
  for (const x of ranked) {
    if (kept.length >= slots) break;
    if (!kept.includes(x)) kept.push(x);
  }
  const others = kept;
  return [...life, ...others]
    .map((x) => x.e)
    .sort((a, b) => a.year - b.year || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.wikidataId.localeCompare(b.wikidataId));
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('fr') + s.slice(1);

/** French masculine → feminine titles whose stems differ. */
const GENDER_PAIRS: Record<string, string> = {
  roi: 'reine',
  empereur: 'impératrice',
  tsar: 'tsarine',
  sultan: 'sultane',
};

/**
 * Wikidata French office labels often list both genders ("Président ou présidente de la
 * République", "Premier ou première ministre"). Keeps the form matching the person.
 */
export function genderedFr(label: string, female: boolean): string {
  const match = label.match(/^(.*?)\s+ou\s+(.*)$/);
  if (!match) return label;
  const left = (match[1] as string).split(/\s+/);
  const right = (match[2] as string).split(/\s+/);
  if (right.length < left.length) return label;
  const pair = (m: string, f: string) =>
    m.slice(0, 3).toLowerCase() === f.slice(0, 3).toLowerCase() ||
    GENDER_PAIRS[m.toLowerCase()] === f.toLowerCase();
  const sameStem = left.every((w, i) => pair(w, right[i] as string));
  if (!sameStem) return label;
  const tail = right.slice(left.length);
  const form = female ? right.slice(0, left.length) : left;
  return [...form, ...tail].join(' ');
}

/** Fetches and builds the timeline of every person (one entry per QID). */
export async function fetchTimelines(
  people: ReadonlyArray<{ qid: string; home: readonly string[] }>,
): Promise<Map<string, TimelineEntry[]>> {
  const female = new Set<string>();
  const raw = await fetchRawFacts(
    people.map((p) => p.qid),
    female,
  );
  const labelMap = await labels(raw.flatMap((f) => [f.item, ...(f.ofItem ? [f.ofItem] : [])]));
  return new Map(
    people.map(({ qid, home }) => {
      const labelOf = (q: string) => {
        const l = labelMap.get(q);
        return l ? { fr: genderedFr(l.fr, female.has(qid)), en: l.en } : undefined;
      };
      return [qid, buildTimeline(qid, raw, labelOf, new Set(home))];
    }),
  );
}

/** Validation errors for a card timeline (empty when valid). */
export function validateTimeline(timeline: unknown, max: number = TIMELINE_MAX): string[] {
  if (!Array.isArray(timeline)) return ['timeline: expected an array'];
  const errors: string[] = [];
  if (timeline.length > max) errors.push(`timeline: ${timeline.length} entries > ${max}`);
  let previous = Number.NEGATIVE_INFINITY;
  timeline.forEach((entry: unknown, i) => {
    const e = entry as Partial<TimelineEntry> & Record<string, unknown>;
    const where = `timeline[${i}]`;
    if (typeof e !== 'object' || e === null) {
      errors.push(`${where}: expected an object`);
      return;
    }
    if (!Number.isInteger(e.year) || e.year === 0) errors.push(`${where}.year: expected a non-zero integer`);
    if (e.endYear !== undefined && (!Number.isInteger(e.endYear) || (e.endYear as number) < (e.year as number))) {
      errors.push(`${where}.endYear: expected an integer ≥ year`);
    }
    if (!(TIMELINE_KINDS as readonly unknown[]).includes(e.kind)) errors.push(`${where}.kind: expected one of ${TIMELINE_KINDS.join(', ')}`);
    const label = e.label as Partial<Localized> | undefined;
    if (!label || typeof label.fr !== 'string' || !label.fr.trim() || typeof label.en !== 'string' || !label.en.trim()) {
      errors.push(`${where}.label: expected non-empty fr and en`);
    }
    if (typeof e.wikidataId !== 'string' || !/^Q\d+$/.test(e.wikidataId)) errors.push(`${where}.wikidataId: expected a QID`);
    if (typeof e.year === 'number') {
      if (e.year < previous) errors.push(`${where}: not in chronological order`);
      previous = e.year;
    }
  });
  return errors;
}
