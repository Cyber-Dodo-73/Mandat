"""
Bots for the Duel v2 simulator. They only read public information: their own hand and board, the
opponent's revealed cards, hand size and the turn number. They never see the opponent's hand, deck
or same-turn plays (simultaneous turns), exactly like the server AI must.

  RandomBot  - random legal plays (lower bound, measures how much skill matters)
  GreedyBot  - "normal": best capital-filling subset, each card to the territory where it helps most
  HardBot    - "hard": several candidate subsets, focuses two territories, anticipates the opponent's
               remaining capital, keeps Tempo cards for their turns
  EasyBot    - "easy": GreedyBot that blunders one turn in three and never focuses
"""
from __future__ import annotations

import math
import random
from itertools import combinations

from engine import Match, Played


def _open_slots(m: Match, side: int):
    return [l for l in range(3) if m.lane_open(l) and len(m.lanes[l][side]) < m.lane_cap(l)]


def _static_value(m: Match, side: int, c, lanes) -> float:
    if not lanes:
        return 0.0
    best = max(c.stats[m.territories[l].domain] for l in lanes)
    return best + c.envergure + 0.6 * c.amount


def _subsets(m: Match, side: int, k: int):
    """Top-k affordable subsets of the hand by static value (hand <= 7 cards: brute force)."""
    hand = m.sides[side].hand
    cap = m.capital(side)
    lanes = _open_slots(m, side)
    free = sum(m.lane_cap(l) - len(m.lanes[l][side]) for l in lanes)
    vals = {c: _static_value(m, side, c, lanes) for c in hand}
    scored = []
    for r in range(1, min(len(hand), free, 4) + 1):
        for combo in combinations(hand, r):
            cost = sum(c.cost for c in combo)
            if cost <= cap:
                scored.append((sum(vals[c] for c in combo), cost, combo))
    scored.sort(key=lambda x: (-x[0], -x[1], [c.id for c in x[2]]))
    return [s[2] for s in scored[:k]]


class GreedyBot:
    name = "normal"
    candidates = 1
    focus = False
    anticipate = False

    def lane_score(self, m: Match, side: int, lane: int, opp_future: float) -> float:
        own = m.lane_power(lane, side, side)
        opp = m.lane_power(lane, 1 - side, side) + opp_future
        margin = own - opp
        if margin == 0 and m.has_veto(lane, side) and not m.has_veto(lane, 1 - side):
            margin = 0.5
        scale = 2.0 + 1.2 * (m.cfg["turns"] - m.turn)
        return math.tanh(margin / scale)

    def board_score(self, scores) -> float:
        if not self.focus:
            return sum(scores)
        s = sorted(scores, reverse=True)
        return s[0] + s[1] + 0.35 * s[2]

    def opp_future(self, m: Match, side: int, lane: int) -> float:
        if not self.anticipate:
            return 0.0
        remaining = sum(range(m.turn + 1, m.cfg["turns"] + 1))
        open_lanes = [l for l in range(3) if m.lane_open(l) and len(m.lanes[l][1 - side]) < m.lane_cap(l)]
        if lane not in open_lanes:
            return 0.0
        # opponent also plays this turn (simultaneous): count its current capital too
        return 0.55 * (remaining + m.turn) / max(1, len(open_lanes))

    def assign(self, m: Match, side: int, combo):
        """Place the cards (most expensive first) one by one where the board score rises most."""
        placed = []
        futures = [self.opp_future(m, side, l) for l in range(3)]
        scores = [self.lane_score(m, side, l, futures[l]) for l in range(3)]
        for c in sorted(combo, key=lambda c: (-c.cost, c.id)):
            best = None
            for l in range(3):
                if not m.lane_open(l) or len(m.lanes[l][side]) >= m.lane_cap(l):
                    continue
                p = Played(c, m.turn, 10_000)
                p.sursaut = m.lane_power(l, side, side) < m.lane_power(l, 1 - side, side)
                m.lanes[l][side].append(p)
                s = self.lane_score(m, side, l, futures[l])
                m.lanes[l][side].pop()
                new_scores = scores[:l] + [s] + scores[l + 1:]
                total = self.board_score(new_scores)
                if best is None or total > best[0]:
                    best = (total, l, s, p)
            if best is None:
                break
            _, l, s, p = best
            m.lanes[l][side].append(p)
            scores[l] = s
            placed.append((c, l, p))
        total = self.board_score(scores)
        for c, l, p in placed:
            m.lanes[l][side].remove(p)
        return total, [(c, l) for c, l, _ in placed]

    def keep_for_later(self, m: Match, c) -> bool:
        return False

    def plan(self, m: Match, side: int, rng: random.Random):
        best = (-1e9, [])
        for combo in _subsets(m, side, self.candidates):
            combo = [c for c in combo if not self.keep_for_later(m, c)]
            if not combo:
                continue
            total, plays = self.assign(m, side, combo)
            if total > best[0]:
                best = (total, plays)
        return best[1]


class HardBot(GreedyBot):
    """Candidate plans scored by rollouts: the opponent's unknown hand and deck are re-drawn from the
    catalog (determinization, never the real hidden cards), then both sides play greedily to the end."""
    name = "hard"
    candidates = 6
    rollouts = 6

    def __init__(self, pool=None):
        self.pool = pool

    def plan(self, m: Match, side: int, rng: random.Random):
        if self.pool is None:
            from engine import load_catalog
            HardBot._shared = getattr(HardBot, "_shared", None) or load_catalog(config=m.cfg)
            self.pool = HardBot._shared
        plans, seen = [], set()
        for combo in _subsets(m, side, self.candidates):
            for focus in (False, True):
                self.focus = focus
                _, plays = self.assign(m, side, combo)
                key = tuple(sorted((c.id, l) for c, l in plays))
                if key not in seen:
                    seen.add(key)
                    plans.append(plays)
        self.focus = False
        if not plans:
            return []
        if len(plans) == 1:
            return plans[0]
        visible = {p.card.id for l in m.lanes for s in l for p in s} | {c.id for c in m.sides[side].hand}
        unknown = [c for c in self.pool if c.id not in visible]
        opp = m.sides[1 - side]
        greedy = GreedyBot()
        scores = [0.0] * len(plans)
        for r in range(self.rollouts):
            sample = rng.sample(unknown, len(opp.hand) + len(opp.deck))
            for i, plays in enumerate(plans):
                sim = m.clone(random.Random(rng.random()))
                sim.sides[1 - side].hand = sample[:len(opp.hand)]
                sim.sides[1 - side].deck = sample[len(opp.hand):]
                own_deck = list(sim.sides[side].deck)
                sim.rng.shuffle(own_deck)
                sim.sides[side].deck = own_deck
                ps = [None, None]
                ps[side] = plays
                ps[1 - side] = greedy.plan(sim, 1 - side, sim.rng)
                sim.reveal(ps)
                while sim.turn < sim.cfg["turns"]:
                    sim.start_turn()
                    sim.reveal([greedy.plan(sim, 0, sim.rng), greedy.plan(sim, 1, sim.rng)])
                res = sim.result()
                diff, margin = sim.standing(side)
                scores[i] += (1.0 if res == side else 0.5 if res is None else 0.0) + 0.01 * math.tanh(margin / 10)
        best = max(range(len(plans)), key=lambda i: scores[i])
        return plans[best]


class EasyBot(GreedyBot):
    name = "easy"

    def plan(self, m: Match, side: int, rng: random.Random):
        if rng.random() < 0.35:
            return RandomBot().plan(m, side, rng)
        return super().plan(m, side, rng)


class RandomBot:
    name = "random"

    def plan(self, m: Match, side: int, rng: random.Random):
        hand = list(m.sides[side].hand)
        rng.shuffle(hand)
        cap = m.capital(side)
        counts = [len(m.lanes[l][side]) for l in range(3)]
        plays = []
        for c in hand:
            if c.cost > cap:
                continue
            lanes = [l for l in range(3) if m.lane_open(l) and counts[l] < m.lane_cap(l)]
            if not lanes:
                break
            l = rng.choice(lanes)
            counts[l] += 1
            cap -= c.cost
            plays.append((c, l))
        return plays


BOTS = {"random": RandomBot, "easy": EasyBot, "normal": GreedyBot, "hard": HardBot}
