#!/usr/bin/env python3
"""
MANDAT Duel v2 matchmaking simulator: wait times, ghost fallback rate and match fairness for several
population sizes, with the rules of docs/DUEL_V2.md §5.2 (same constants as the server's
MatchmakingRules, keep them in sync).

  python3 scripts/duel-sim/queue_sim.py               # markdown table, 1 simulated hour per population
  python3 scripts/duel-sim/queue_sim.py --minutes 180 --seed 3

One tick = 1 second. Each online duelist loops: queue -> match (~3 min) -> pause (~1 min) -> queue.
"""
from __future__ import annotations

import argparse
import bisect
import random
import statistics
from dataclasses import dataclass, field

# ---- rules (mirror of MatchmakingRules) ------------------------------------------------------------
LEVEL_BRACKETS = (1, 10, 20, 35)          # lower bounds: N1 1-9, N2 10-19, N3 20-34, N4 35+
COLLECTION_BRACKETS = (0, 80, 200, 350)  # distinct owned cards
PROTECTED_MATCHES = 5                    # "matchs d'investiture": only other protected players or ghosts
MMR_WINDOW_START = 60
MMR_WINDOW_GROWTH = 20                   # per second of waiting
MMR_WINDOW_MAX = 400
ADJACENT_LEVEL_AFTER = 8                 # seconds before an adjacent level bracket is allowed
ADJACENT_COLLECTION_AFTER = 5
GHOST_AFTER = {"ranked": 18, "casual": 15}
PROTECTED_GHOST_AFTER = 10


def bracket(value, bounds):
    return max(i for i, b in enumerate(bounds) if value >= b)


@dataclass(eq=False)
class Player:
    id: int
    mmr: float
    level: int
    collection: int
    matches: int
    mode: str
    state: str = "idle"
    until: int = 0
    queued_at: int = 0

    @property
    def lb(self):
        return bracket(self.level, LEVEL_BRACKETS)

    @property
    def cb(self):
        return bracket(self.collection, COLLECTION_BRACKETS)

    @property
    def protected(self):
        return self.matches < PROTECTED_MATCHES


def window(p: Player, now: int):
    waited = now - p.queued_at
    mmr = min(MMR_WINDOW_MAX, MMR_WINDOW_START + MMR_WINDOW_GROWTH * waited)
    lvl = 1 if waited >= ADJACENT_LEVEL_AFTER else 0
    col = 1 if waited >= ADJACENT_COLLECTION_AFTER else 0
    return mmr, lvl, col


def compatible(a: Player, b: Player, now: int) -> bool:
    if a.mode != b.mode or a.protected != b.protected:
        return False
    # newcomers (level bracket N1) never meet N3+ whatever the wait
    if min(a.lb, b.lb) == 0 and max(a.lb, b.lb) >= 2:
        return False
    for x, y in ((a, b), (b, a)):  # both windows must accept: mutual constraint
        mmr, lvl, col = window(x, now)
        if abs(x.mmr - y.mmr) > mmr or abs(x.lb - y.lb) > lvl or abs(x.cb - y.cb) > col:
            return False
    return True


def cost(a, b):
    return abs(a.mmr - b.mmr) + 60 * abs(a.lb - b.lb) + 40 * abs(a.cb - b.cb)


def make_population(n, rng):
    players = []
    for i in range(n):
        r = rng.random()
        level = rng.randint(1, 9) if r < 0.30 else rng.randint(10, 19) if r < 0.60 else \
            rng.randint(20, 34) if r < 0.82 else rng.randint(35, 80)
        lb = bracket(level, LEVEL_BRACKETS)
        collection = int(min(500, max(10, rng.gauss(40 + 95 * lb, 45))))
        matches = rng.randint(0, 4) if level < 4 and rng.random() < 0.5 else rng.randint(5, 40 + 60 * lb)
        mmr = rng.gauss(1000 + 70 * lb, 140)
        players.append(Player(i, mmr, level, collection, matches, "ranked" if rng.random() < 0.6 else "casual"))
    return players


def simulate(n, minutes, rng):
    players = make_population(n, rng)
    for p in players:
        p.until = rng.randint(0, 240)
    queue: list[Player] = []
    waits, ghosts, gaps, cross_level, cross_col, total = [], 0, [], 0, 0, 0
    for now in range(minutes * 60):
        for p in players:
            if p.state in ("idle", "playing") and now >= p.until:
                p.state, p.queued_at = "queued", now
                queue.append(p)
        # pair the longest waiting first, each with its cheapest compatible partner
        queue.sort(key=lambda p: p.queued_at)
        groups = {}
        for p in queue:
            groups.setdefault((p.mode, p.protected), []).append(p)
        for g in groups.values():
            g.sort(key=lambda p: p.mmr)
        matched = set()
        for a in queue:
            if a in matched:
                continue
            best = None
            g = groups[(a.mode, a.protected)]
            keys = [p.mmr for p in g]
            lo = bisect.bisect_left(keys, a.mmr - MMR_WINDOW_MAX)
            hi = bisect.bisect_right(keys, a.mmr + MMR_WINDOW_MAX)
            for b in g[lo:hi]:
                if b is a or b in matched or not compatible(a, b, now):
                    continue
                c = cost(a, b)
                if best is None or c < best[0]:
                    best = (c, b)
            if best:
                b = best[1]
                matched |= {a, b}
                total += 1
                gaps.append(abs(a.mmr - b.mmr))
                cross_level += a.lb != b.lb
                cross_col += a.cb != b.cb
                for x in (a, b):
                    waits.append(now - x.queued_at)
            else:
                limit = PROTECTED_GHOST_AFTER if a.protected else GHOST_AFTER[a.mode]
                if now - a.queued_at >= limit:
                    matched.add(a)
                    ghosts += 1
                    waits.append(now - a.queued_at)
        for x in matched:
            x.state = "playing"
            x.until = now + int(rng.gauss(180, 35)) + int(rng.expovariate(1 / 60))
            x.matches += 1
        queue = [p for p in queue if p not in matched]
    waits.sort()
    starts = len(waits)
    return {
        "n": n,
        "median": statistics.median(waits),
        "p90": waits[int(0.9 * len(waits))],
        "ghost": ghosts / starts,
        "gap": statistics.mean(gaps) if gaps else 0,
        "cross_level": cross_level / max(1, total),
        "cross_col": cross_col / max(1, total),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=int, default=60)
    ap.add_argument("--seed", type=int, default=2026)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    print("| Joueurs de duel connectés | Attente médiane | Attente P90 | Parties contre un fantôme | "
          "Écart MMR moyen (PvP) | PvP entre tranches de niveau voisines | Tranche de collection différente |")
    print("|---|---|---|---|---|---|---|")
    for n in (20, 50, 150, 500, 2000):
        r = simulate(n, args.minutes, rng)
        print(f"| {n} | {r['median']:.0f} s | {r['p90']:.0f} s | {100 * r['ghost']:.0f} % | {r['gap']:.0f} | "
              f"{100 * r['cross_level']:.0f} % | {100 * r['cross_col']:.0f} % |")


if __name__ == "__main__":
    main()
