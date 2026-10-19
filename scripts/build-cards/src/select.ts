import type { Continent, Rarity, RankedCandidate, ScoredCandidate } from './types.ts';
import { compareFame } from './score.ts';

export type Tier = { rarity: Rarity; count: number };
export type CountryCap = { max: number } | { fraction: number };
export type CapPush = { qid: string; name: string; country: string; rank: number; from: Rarity; to: Rarity };
export type SelectionResult = { cards: RankedCandidate[]; warnings: string[]; pushes: CapPush[] };

/** Maximum number of cards from one country in a tier. */
export function capFor(cap: CountryCap | undefined, tierSize: number): number {
  if (!cap) return Number.POSITIVE_INFINITY;
  return 'max' in cap ? cap.max : Math.floor(cap.fraction * tierSize);
}

type Assignment = { rarityByQid: Map<string, Rarity>; pushes: CapPush[]; warnings: string[] };

/**
 * Fills tiers top-down in fame order. Within a tier, a card whose country already reached the
 * tier's cap is skipped and stays at the front of the queue for the next tier, so it keeps its
 * rank order and may cascade further down. The last tier takes everyone left; a cap it cannot
 * respect only produces a warning. If a tier cannot be filled within its cap (not enough
 * diverse candidates left), it is completed with the best skipped cards and a warning.
 */
export function assignTiers(
  ranked: readonly ScoredCandidate[],
  tiers: readonly Tier[],
  caps: Partial<Record<Rarity, CountryCap>> = {},
): Assignment {
  const rarityByQid = new Map<string, Rarity>();
  const firstTier = new Map<string, Rarity>(); // tier the card would get without caps
  const pushes: CapPush[] = [];
  const warnings: string[] = [];

  let offset = 0;
  for (const tier of tiers) {
    for (const c of ranked.slice(offset, offset + tier.count)) firstTier.set(c.qid, tier.rarity);
    offset += tier.count;
  }

  let queue = [...ranked];
  tiers.forEach((tier, index) => {
    const isLast = index === tiers.length - 1;
    const cap = capFor(caps[tier.rarity], tier.count);
    const counts = new Map<string, number>();
    const taken = new Set<string>();
    const skipped: ScoredCandidate[] = [];

    for (const c of queue) {
      if (taken.size >= tier.count) break;
      const count = counts.get(c.country) ?? 0;
      if (count < cap || isLast) {
        taken.add(c.qid);
        counts.set(c.country, count + 1);
      } else {
        skipped.push(c);
      }
    }
    if (taken.size < tier.count) {
      const missing = tier.count - taken.size;
      warnings.push(`Tier ${tier.rarity}: country cap ${cap} cannot be met, ${missing} slot(s) filled with over-cap cards.`);
      for (const c of skipped.slice(0, missing)) taken.add(c.qid);
    }
    if (isLast) {
      for (const [country, count] of counts) {
        if (count > cap) warnings.push(`Tier ${tier.rarity}: ${count} cards from ${country} exceed the cap of ${cap} (last tier, no lower tier to push to).`);
      }
    }
    for (const c of skipped) {
      if (!taken.has(c.qid) && !isLast) {
        const next = tiers[index + 1]?.rarity as Rarity;
        pushes.push({ qid: c.qid, name: c.name.en, country: c.country, rank: 0, from: tier.rarity, to: next });
      }
    }
    for (const qid of taken) rarityByQid.set(qid, tier.rarity);
    queue = queue.filter((c) => !taken.has(c.qid));
  });

  // Collapse cascades into one entry per card: original tier → final tier.
  const collapsed = new Map<string, CapPush>();
  for (const p of pushes) {
    const final = rarityByQid.get(p.qid) as Rarity;
    collapsed.set(p.qid, { ...p, from: firstTier.get(p.qid) ?? p.from, to: final });
  }
  return { rarityByQid, pushes: [...collapsed.values()].filter((p) => p.from !== p.to), warnings };
}

/**
 * Picks `total` candidates: first the top `quota[c]` of each continent (or all of them if
 * there are not enough, with a warning), then fills the remaining slots by pure merit.
 * Quotas only decide who enters the season; rarities are then assigned by fame rank among the
 * selected cards, subject to the per-tier country caps (see assignTiers). Collector numbers
 * follow rarity (rarest first), then fame rank.
 */
export function selectCards(
  pool: readonly ScoredCandidate[],
  quotas: Readonly<Record<Continent, number>>,
  total: number,
  tiers: readonly Tier[],
  caps: Partial<Record<Rarity, CountryCap>> = {},
): SelectionResult {
  const tierTotal = tiers.reduce((sum, t) => sum + t.count, 0);
  if (tierTotal !== total) throw new Error(`Rarity tiers sum to ${tierTotal}, expected ${total}`);
  const quotaTotal = Object.values(quotas).reduce((sum, q) => sum + q, 0);
  if (quotaTotal > total) throw new Error(`Continent quotas sum to ${quotaTotal} > ${total}`);
  if (pool.length < total) throw new Error(`Only ${pool.length} candidates for ${total} cards`);

  const sorted = [...pool].sort(compareFame);
  const warnings: string[] = [];
  const chosen = new Set<string>();

  for (const [continent, quota] of Object.entries(quotas) as [Continent, number][]) {
    const fromContinent = sorted.filter((c) => c.continent === continent).slice(0, quota);
    if (fromContinent.length < quota) {
      warnings.push(
        `Continent ${continent}: only ${fromContinent.length} candidates for a quota of ${quota}; remaining slots filled by merit.`,
      );
    }
    for (const c of fromContinent) chosen.add(c.qid);
  }

  // Which quota picks would not have made it on merit alone (for the audit report).
  const meritCut = new Set(sorted.slice(0, total).map((c) => c.qid));

  for (const c of sorted) {
    if (chosen.size >= total) break;
    chosen.add(c.qid);
  }

  const selected = sorted.filter((c) => chosen.has(c.qid));
  const assignment = assignTiers(selected, tiers, caps);
  warnings.push(...assignment.warnings);

  const rankByQid = new Map(selected.map((c, index) => [c.qid, index + 1]));
  const tierIndex = (r: Rarity) => tiers.findIndex((t) => t.rarity === r);
  const ordered = [...selected].sort(
    (a, b) =>
      tierIndex(assignment.rarityByQid.get(a.qid) as Rarity) - tierIndex(assignment.rarityByQid.get(b.qid) as Rarity) ||
      (rankByQid.get(a.qid) as number) - (rankByQid.get(b.qid) as number),
  );
  const cards: RankedCandidate[] = ordered.map((c, index) => ({
    ...c,
    rank: rankByQid.get(c.qid) as number,
    number: index + 1,
    rarity: assignment.rarityByQid.get(c.qid) as Rarity,
    viaQuota: !meritCut.has(c.qid),
  }));
  const pushes = assignment.pushes.map((p) => ({ ...p, rank: rankByQid.get(p.qid) as number }));
  return { cards, warnings, pushes };
}
