import { readFile } from 'node:fs/promises';
import { PATHS } from './config.ts';
import type { CapPush } from './select.ts';
import { CONTINENTS, ERAS, RARITIES, type Card, type Continent, type Era, type Rarity } from './types.ts';

type PoolEntry = {
  poolRank: number;
  qid: string;
  name: string;
  country: string;
  continent: Continent;
  era: Era;
  birthYear: number;
  sitelinks: number;
  pageviews: number;
  fameScore: number;
  topPosition: string | null;
  cardRank: number | null;
  cardNumber: number | null;
  rarity: Rarity | null;
  viaQuota: boolean;
};
type CandidatesFile = {
  asOf: string;
  pageviewWindow: { start: string; end: string };
  warnings: string[];
  capPushes: CapPush[];
  pool: PoolEntry[];
  dropped: { qid: string; name: string; reason: string }[];
};
type SensitiveEntry = { wikidataId: string; name: string };

function table(rows: string[][]): string {
  const widths = rows[0]?.map((_, i) => Math.max(...rows.map((r) => (r[i] ?? '').length))) ?? [];
  return rows.map((r) => r.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ').trimEnd()).join('\n');
}

const GENERIC_ROLE = /^(pharaon|pharaoh|roi|king|reine|queen|empereur|emperor|impératrice|empress|président|president|présidente|premier ministre|prime minister|monarque|monarch|sultan|tsar|chef d'état|head of state|chef de gouvernement|head of government|dictateur|dictator|gouverneur|governor|ministre|minister|maire|mayor|député|member of parliament|chancelier|chancellor|khan|shah|calife|caliph|émir|amir|consul|roman consul|consul romain)$/i;

/** Heuristic problems in drafted roles, for the content writers to fix with a `role` override. */
export function roleIssues(card: Pick<Card, 'role'>): string[] {
  const issues: string[] = [];
  const { fr, en } = card.role;
  if (fr === en && !/^[A-Z][a-z]+$/.test(fr)) issues.push('FR identical to EN (untranslated)');
  if (/\bou\b|\/|\(e\)/i.test(fr)) issues.push('FR epicene label ("X ou Y")');
  if (/\bor\b/i.test(en)) issues.push('EN label with "or"');
  if (GENERIC_ROLE.test(fr) || GENERIC_ROLE.test(en)) issues.push('generic title without country');
  if (/^Q\d+$/.test(fr) || /^Q\d+$/.test(en)) issues.push('missing label');
  if (/\b(member|membre|deputy|député|senator|sénateur|council|conseil|CEO|chief executive)\b/i.test(`${fr} ${en}`)) {
    issues.push('minor or non-defining office');
  }
  return issues;
}

export async function report(): Promise<void> {
  const file = JSON.parse(await readFile(PATHS.candidatesOut, 'utf8')) as CandidatesFile;
  const { cards } = JSON.parse(await readFile(PATHS.cardsOut, 'utf8')) as { cards: Card[] };
  const sensitive = JSON.parse(await readFile(PATHS.sensitive, 'utf8')) as SensitiveEntry[];
  const pool = new Map(file.pool.map((p) => [p.qid, p]));
  const selected = file.pool.filter((p) => p.cardRank !== null).sort((a, b) => (a.cardRank ?? 0) - (b.cardRank ?? 0));

  console.log(
    `Season pool as of ${file.asOf} (pageviews ${file.pageviewWindow.start}–${file.pageviewWindow.end}): ` +
      `${file.pool.length} candidates, ${file.dropped.length} dropped, ${selected.length} selected.\n`,
  );

  const header = ['rarity', ...CONTINENTS, 'total'];
  const rows = RARITIES.map((rarity) => {
    const ofRarity = cards.filter((c) => c.rarity === rarity);
    return [rarity, ...CONTINENTS.map((c) => String(ofRarity.filter((p) => p.continent === c).length)), String(ofRarity.length)];
  });
  rows.push(['total', ...CONTINENTS.map((c) => String(cards.filter((p) => p.continent === c).length)), String(cards.length)]);
  console.log('Rarity × continent');
  console.log(table([header, ...rows]));

  console.log('\nRarity × era');
  console.log(
    table([
      ['rarity', ...ERAS, 'total'],
      ...RARITIES.map((r) => {
        const ofRarity = cards.filter((c) => c.rarity === r);
        return [r, ...ERAS.map((e) => String(ofRarity.filter((c) => c.era === e).length)), String(ofRarity.length)];
      }),
      ['total', ...ERAS.map((e) => String(cards.filter((c) => c.era === e).length)), String(cards.length)],
    ]),
  );

  console.log('\nMost represented country per rarity');
  console.log(
    table([
      ['rarity', 'top countries'],
      ...RARITIES.map((r) => {
        const counts = new Map<string, number>();
        for (const c of cards.filter((card) => card.rarity === r)) counts.set(c.country, (counts.get(c.country) ?? 0) + 1);
        const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4);
        return [r, top.map(([iso, n]) => `${iso} ${n}`).join(', ')];
      }),
    ]),
  );

  const viaQuota = selected.filter((p) => p.viaQuota);
  console.log(`\nCards entered via continent quota (would miss the top ${selected.length} on merit): ${viaQuota.length}`);
  for (const c of CONTINENTS) {
    const n = viaQuota.filter((p) => p.continent === c).length;
    if (n > 0) console.log(`  ${c}: ${n}`);
  }

  const byQid = new Map(cards.map((c) => [c.wikidataId, c]));
  console.log('\nTop 40 by fame');
  console.log(
    table([
      ['rank', 'card', 'rarity', 'name', 'country', 'era', 'fame', 'pageviews', 'sitelinks'],
      ...selected.slice(0, 40).map((p) => [
        String(p.cardRank), byQid.get(p.qid)?.id ?? '', p.rarity ?? '', p.name, p.country, p.era,
        p.fameScore.toFixed(2), String(p.pageviews), String(p.sitelinks),
      ]),
    ]),
  );

  for (const rarity of ['mythic', 'legendary'] as const) {
    console.log(`\n${rarity === 'mythic' ? 'Mythic' : 'Legendary'} cards`);
    console.log(
      table([
        ['card', 'rank', 'name', 'country', 'continent', 'era', 'born'],
        ...cards.filter((c) => c.rarity === rarity).map((c) => [
          c.id, String(pool.get(c.wikidataId)?.cardRank ?? ''), c.name.en, c.country, c.continent, c.era, String(c.birthYear),
        ]),
      ]),
    );
  }

  console.log(`\nCountry-cap pushes: ${file.capPushes.length}`);
  if (file.capPushes.length > 0) {
    console.log(
      table([
        ['rank', 'name', 'country', 'from', 'to'],
        ...file.capPushes.map((p) => [String(p.rank), p.name, p.country, p.from, p.to]),
      ]),
    );
  }

  console.log('\nSensitive figures');
  console.log(
    table([
      ['name', 'status', 'rarity', 'card', 'rank', 'pool #'],
      ...sensitive.map((s) => {
        const p = pool.get(s.wikidataId);
        const card = byQid.get(s.wikidataId);
        return [s.name, p ? (card ? 'selected' : 'not selected') : 'not in pool', card?.rarity ?? '-', card?.id ?? '-', String(p?.cardRank ?? '-'), String(p?.poolRank ?? '-')];
      }),
    ]),
  );

  const issues = cards.map((c) => ({ c, issues: roleIssues(c) })).filter((x) => x.issues.length > 0);
  console.log(`\nDrafted roles to rewrite: ${issues.length}/${cards.length}`);
  console.log(
    table([
      ['card', 'name', 'role fr', 'role en', 'issues'],
      ...issues.map(({ c, issues: list }) => [c.id, c.name.en, c.role.fr, c.role.en, list.join('; ')]),
    ]),
  );

  const untranslatedNames = cards.filter((c) => /^Q\d+$/.test(c.name.fr) || /^Q\d+$/.test(c.name.en));
  if (untranslatedNames.length > 0) {
    console.log(`\nCards with a missing name label: ${untranslatedNames.map((c) => `${c.id} ${c.wikidataId}`).join(', ')}`);
  }

  if (file.warnings.length > 0) {
    console.log('\nWarnings');
    for (const w of file.warnings) console.log(`  ${w}`);
  }
}
