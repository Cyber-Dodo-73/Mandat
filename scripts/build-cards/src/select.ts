import type { Continent, Rarity, RankedCandidate, ScoredCandidate } from './types.ts';
import { compareFame } from './score.ts';

export type Tier = { rarity: Rarity; count: number };
export type CountryCap = { max: number } | { fraction: number };
export type CapPush = { qid: string; name: string; country: string; rank: number; from: Rarity; to: Rarity };
export type SelectionResult = {
  cards: RankedCandidate[];
  warnings: string[];
  pushes: CapPush[];
  promotions: ContinentPromotion[];
};

/** At least `count` cards of `continent` at rarity `atLeast` or rarer. */
export type ContinentMinimum = { continent: Continent; atLeast: Rarity; count: number };
/** A card moved by a continent minimum: promoted to reach it, or demoted to make room. */
export type ContinentPromotion = {
  qid: string;
  name: string;
  continent: Continent;
  rank: number;
  from: Rarity;
  to: Rarity;
  reason: 'promoted' | 'demoted';
};
export type SelectionOptions = {
  /** QIDs always selected (documented false negatives), placed before the merit fill. */
  mustInclude?: ReadonlySet<string>;
  /** Per-continent top-tier minimums, enforced after the country caps. */
  continentMinimums?: readonly ContinentMinimum[];
};

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
 * Enforces per-continent top-tier minimums on an assignment, like the country caps: while a
 * continent has fewer than `count` cards at `atLeast` or rarer, its best-ranked card below that
 * tier is promoted into it, and every tier between pays with its lowest-ranked card, cascading
 * down to the tier the promoted card left (tier sizes never change). A demoted card is never
 * one that a minimum needs; cards fitting the next tier's country cap are preferred. Minimums
 * on rarer tiers are applied first. `ranked` is in fame order (best first).
 */
export function enforceContinentMinimums(
  ranked: readonly ScoredCandidate[],
  rarityByQid: Map<string, Rarity>,
  tiers: readonly Tier[],
  minimums: readonly ContinentMinimum[],
  caps: Partial<Record<Rarity, CountryCap>> = {},
): { promotions: ContinentPromotion[]; warnings: string[] } {
  const tierIndex = (r: Rarity) => tiers.findIndex((t) => t.rarity === r);
  const rankOf = new Map(ranked.map((c, i) => [c.qid, i + 1]));
  const byQid = new Map(ranked.map((c) => [c.qid, c]));
  const promotions: ContinentPromotion[] = [];
  const warnings: string[] = [];
  const promoted = new Set<string>();
  const original = new Map(rarityByQid);

  const atLevel = (continent: Continent, level: number) =>
    ranked.filter((c) => c.continent === continent && tierIndex(rarityByQid.get(c.qid) as Rarity) <= level).length;
  // A card is needed by a minimum if moving it one tier down would break that minimum.
  const needed = (c: ScoredCandidate, level: number) =>
    minimums.some(
      (m) => m.continent === c.continent && tierIndex(m.atLeast) === level && atLevel(c.continent, level) <= m.count,
    );
  const inTier = (level: number) =>
    ranked.filter((c) => tierIndex(rarityByQid.get(c.qid) as Rarity) === level);

  const ordered = [...minimums].sort((a, b) => tierIndex(a.atLeast) - tierIndex(b.atLeast));
  for (const m of ordered) {
    const level = tierIndex(m.atLeast);
    if (level < 0) throw new Error(`Unknown rarity in continent minimum: ${m.atLeast}`);
    while (atLevel(m.continent, level) < m.count) {
      const candidate = ranked.find(
        (c) => c.continent === m.continent && tierIndex(rarityByQid.get(c.qid) as Rarity) > level,
      );
      if (!candidate) {
        warnings.push(`Continent ${m.continent}: not enough cards to reach ${m.count} at ${m.atLeast} or rarer.`);
        break;
      }
      const from = tierIndex(rarityByQid.get(candidate.qid) as Rarity);
      rarityByQid.set(candidate.qid, m.atLeast);
      promoted.add(candidate.qid);
      // Cascade: each tier from `level` to `from - 1` now has one card too many.
      for (let t = level; t < from; t++) {
        const next = tiers[t + 1] as Tier;
        const nextCap = capFor(caps[next.rarity], next.count);
        const countryCount = (country: string) =>
          inTier(t + 1).filter((c) => c.country === country).length;
        const victims = inTier(t)
          .filter((c) => !promoted.has(c.qid) && !needed(c, t))
          .reverse(); // lowest-ranked first
        const victim = victims.find((c) => countryCount(c.country) < nextCap) ?? victims[0];
        if (!victim) {
          warnings.push(`Tier ${tiers[t]?.rarity}: no card can make room for the ${m.continent} minimum.`);
          break;
        }
        if (countryCount(victim.country) >= nextCap) {
          warnings.push(`Tier ${next.rarity}: ${victim.country} exceeds its cap after making room for ${m.continent}.`);
        }
        rarityByQid.set(victim.qid, next.rarity);
      }
    }
  }

  for (const [qid, rarity] of rarityByQid) {
    const before = original.get(qid) as Rarity;
    if (before === rarity) continue;
    const c = byQid.get(qid) as ScoredCandidate;
    promotions.push({
      qid,
      name: c.name.en,
      continent: c.continent,
      rank: rankOf.get(qid) as number,
      from: before,
      to: rarity,
      reason: tierIndex(rarity) < tierIndex(before) ? 'promoted' : 'demoted',
    });
  }
  promotions.sort((a, b) => a.rank - b.rank);
  return { promotions, warnings };
}

/**
 * Picks `total` candidates: first the top `quota[c]` of each continent (or all of them if
 * there are not enough, with a warning), then the documented must-include figures, then fills
 * the remaining slots by pure merit. Quotas and must-includes only decide who enters the
 * season; rarities are then assigned by fame rank among the selected cards, subject to the
 * per-tier country caps (see assignTiers) and the continent minimums
 * (see enforceContinentMinimums). Collector numbers follow rarity (rarest first), then fame rank.
 */
export function selectCards(
  pool: readonly ScoredCandidate[],
  quotas: Readonly<Record<Continent, number>>,
  total: number,
  tiers: readonly Tier[],
  caps: Partial<Record<Rarity, CountryCap>> = {},
  options: SelectionOptions = {},
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

  const mustInclude = options.mustInclude ?? new Set<string>();
  for (const qid of mustInclude) {
    if (sorted.some((c) => c.qid === qid)) chosen.add(qid);
    else warnings.push(`Must-include ${qid} is not in the candidate pool.`);
  }
  if (chosen.size > total) throw new Error(`Quotas and must-includes select ${chosen.size} > ${total} cards`);

  for (const c of sorted) {
    if (chosen.size >= total) break;
    chosen.add(c.qid);
  }

  const selected = sorted.filter((c) => chosen.has(c.qid));
  const assignment = assignTiers(selected, tiers, caps);
  warnings.push(...assignment.warnings);
  const minimums = enforceContinentMinimums(selected, assignment.rarityByQid, tiers, options.continentMinimums ?? [], caps);
  warnings.push(...minimums.warnings);

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
    viaQuota: !meritCut.has(c.qid) && !mustInclude.has(c.qid),
    mustInclude: mustInclude.has(c.qid),
  }));
  const pushes = assignment.pushes.map((p) => ({ ...p, rank: rankByQid.get(p.qid) as number }));
  return { cards, warnings, pushes, promotions: minimums.promotions };
}
