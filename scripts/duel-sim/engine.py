"""
MANDAT Duel v2 reference engine (Python mirror of the rules in docs/DUEL_V2.md).

Pure and deterministic: every random draw goes through the `random.Random` passed in, so a match is
fully reproduced by (seed, decks, plays). The Java engine must give the same results on the golden
matches produced by `simulate.py --golden`.

Vocabulary (French names are the in-game ones):
  territory = lane (3 per match), domain = the stat a territory reads, capital = energy,
  keyword   = the card's ability effect translated to v2 (see KEYWORDS below).
"""
from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from pathlib import Path

STATS = ("influence", "diplomacy", "charisma", "strategy")
ERAS = ("antiquity", "medieval", "modern", "contemporary")

# Tunables. simulate.py overrides them to explore variants; the values here are the tuned v2.0 ones.
CONFIG = {
    "deck_size": 10,
    "turns": 6,
    "start_hand": 3,
    "hand_max": 7,
    "lane_cap": 3,
    # cost curve: share of the catalog at each cost 1..6 (quantile mapping of the card "value")
    "cost_curve": (0.12, 0.20, 0.22, 0.20, 0.15, 0.11),
    # Envergure: flat power added to a card according to its cost (index = cost). Makes expensive
    # cards worth their capital without touching the printed stats.
    "envergure": (0, 0, 0, 1, 2, 3, 5),
    # lane-level synergy bonuses
    "delegation_min": 3,      # >= N own cards of one continent in a territory
    "delegation_bonus": 1,
    "compatriots_min": 3,     # >= N own cards of one country in a territory
    "compatriots_bonus": 2,
    "contexts": True,
    "signatures": True,       # rare+ cards get a signature keyword (see SIGNATURES)
    # v1 effects name a stat ("+2 en Charisme"). Locked = the effect only works on the territory of that
    # stat (v1 behaviour, ~30 % activation). Unlocked (v2.0): it works on every territory.
    "stat_lock": False,
    # Compensation: inside one cost, cards below the 90th percentile of value get +1/+2 Envergure so that
    # every card of a cost is worth about the same (costs are integers, values are not).
    "compensation": True,
}

# --------------------------------------------------------------------------------------------------
# Catalog -> v2 cards


KEYWORDS = {
    # condition kind (v1) -> v2 keyword (rarity-agnostic)
    "always": "constant",
    "opponentContinent:same": "alliance",       # another of your cards here shares this card's continent
    "opponentContinent:different": "ouverture",  # another of your cards here comes from another continent
    "opponentEra": "riposte",                    # an opposing card here is of era X
    "roundDomain": "specialiste",                # this territory reads domain X
    "round": "tempo",                            # played on turns 2r-1 or 2r
    "behind": "sursaut",                         # on reveal, your side here was behind
    "opponentRarityHigher": "outsider",          # an opposing card here costs more than this one
}
TYPES = {"bonus": "soutien", "malus": "pression", "tieBreaker": "veto"}

# Signature keywords: rare and rarer cards get one, chosen by their peak stat. They are not stronger
# (the cost curve prices them in, see card_value) but they add a decision or a surprise.
SIGNATURES = {
    "influence": "polyvalent",   # uses its highest stat in every territory
    "diplomacy": "ralliement",   # +1 to each other card of yours in this territory
    "charisma": "mobilisation",  # on reveal: draw a card
    "strategy": "discret",       # revealed face down; the opponent only sees its cost until the end
}
SIGNATURE_RARITIES = {"rare", "epic", "legendary", "mythic"}
SIGNATURE_VALUE = {"polyvalent": None, "ralliement": 1.0, "mobilisation": 1.6, "discret": 0.6}


@dataclass(eq=False)
class Card:
    id: str
    name: str
    rarity: str
    continent: str
    era: str
    country: str
    sensitive: bool
    stats: dict
    etype: str            # soutien | pression | veto
    estat: str | None     # stat key, "any" or None (veto)
    amount: int
    keyword: str
    kvalue: object        # condition value (era, domain, round...) or None
    signature: str | None = None
    envergure: int = 0            # printed on the card: cost-based scale + compensation
    value_override: float = 0.0   # balance patch from value_overrides.json (simulate.py --autotune)
    value: float = 0.0    # pre-cost value used for the cost curve
    cost: int = 0

    def peak(self) -> int:
        return max(self.stats.values())

    def label(self) -> str:
        return f"{self.id} {self.name}"


def tempo_turns(r: int, cost: int) -> set[int]:
    """Turns on which a Tempo keyword is on. Derived from the v1 round (1, 2, 3) and the card's cost so
    that it is always reachable: 1 = "Entrée en fonction" (the first turn the cost allows, or the next),
    2 = "Mi-mandat" (turns 3-4, or turn 6 for cost 5-6), 3 = "Dernier mot" (turns 5-6, or 6)."""
    if r == 1:
        return {cost, min(cost + 1, 6)}
    if r == 2:
        return {3, 4} if cost <= 4 else {6}
    return {5, 6} if cost <= 5 else {6}


def outsider_holds(own_cost: int, opp_cost: int) -> bool:
    """Outsider: an opposing card here costs more than this one (for a cost-6 card: costs 6 too)."""
    return opp_cost > own_cost or (own_cost == 6 and opp_cost == 6)


def condition_odds(kind_key: str, value, cost: int = 3) -> float:
    """Probability that a keyword is active at the end of a match, measured by the simulator
    (3 000 games, "normal" bots, mixed archetypes) and rounded. Re-measure when rules change."""
    if kind_key == "constant":
        return 1.0
    if kind_key == "alliance":
        return 0.5
    if kind_key == "ouverture":
        return 0.7
    if kind_key == "riposte":
        return {"contemporary": 0.8, "modern": 0.45, "antiquity": 0.25, "medieval": 0.1}[value]
    if kind_key == "specialiste":
        return 0.4
    if kind_key == "tempo":
        return {1: 0.7, 2: 0.5, 3: 0.4}[int(value)]
    if kind_key == "sursaut":
        return 0.7
    if kind_key == "outsider":
        return {1: 0.85, 2: 0.8, 3: 0.6, 4: 0.4, 5: 0.27, 6: 0.1}[cost]
    raise ValueError(kind_key)


def card_value(c: Card, cfg: dict | None = None) -> float:
    s = sorted(c.stats.values(), reverse=True)
    base = 0.75 * s[0] + 0.25 * s[1]
    if c.etype == "veto":
        ability = 0.6 * condition_odds(c.keyword, c.kvalue, c.cost or 3)
    else:
        # the effect only works in a territory reading its stat: easy when it is the card's peak
        if c.estat == "any" or not (cfg or CONFIG).get("stat_lock", False):
            match = 1.0
        else:
            match = 1.0 if c.stats[c.estat] >= s[1] else 0.55
        ability = c.amount * condition_odds(c.keyword, c.kvalue, c.cost or 3) * match
    sig = 0.0
    if c.signature == "polyvalent":
        sig = s[0] - base
    elif c.signature:
        sig = SIGNATURE_VALUE[c.signature]
    return base + ability + sig + c.value_override


def reachable(c: Card) -> list[str]:
    """Build-time check: reasons why this card's keyword could never trigger (empty = fine)."""
    problems = []
    if c.keyword == "tempo" and not any(t >= c.cost for t in tempo_turns(int(c.kvalue), c.cost)):
        problems.append("tempo window before the card is affordable")
    if c.keyword == "outsider" and not any(outsider_holds(c.cost, k) for k in range(1, 7)):
        problems.append("outsider can never hold")
    if c.keyword == "riposte" and c.kvalue not in ERAS:
        problems.append(f"unknown era {c.kvalue}")
    if c.keyword == "specialiste" and c.estat not in (None, "any", c.kvalue):
        problems.append("specialiste on a domain different from its stat: dead effect")
    if c.etype != "veto" and c.estat not in STATS + ("any",):
        problems.append(f"unknown stat {c.estat}")
    return problems


def load_catalog(path: Path | None = None, config: dict | None = None) -> list[Card]:
    cfg = config or CONFIG
    path = path or Path(__file__).resolve().parents[2] / "data" / "cards.season1.json"
    raw = json.loads(path.read_text(encoding="utf-8"))["cards"]
    cards = []
    for r in raw:
        e = r["ability"]["effect"]
        cond = e.get("condition", {"kind": "always"})
        kind = cond["kind"]
        key = f"{kind}:{cond['value']}" if kind == "opponentContinent" else kind
        c = Card(
            id=r["id"], name=r["name"]["fr"], rarity=r["rarity"], continent=r["continent"], era=r["era"],
            country=r["country"], sensitive=r["sensitive"], stats=dict(r["stats"]),
            etype=TYPES[e["type"]], estat=e.get("stat"), amount=e.get("amount", 0),
            keyword=KEYWORDS[key], kvalue=cond.get("value"),
        )
        if cfg.get("signatures", True) and c.rarity in SIGNATURE_RARITIES:
            peak = max(STATS, key=lambda k: (c.stats[k], -STATS.index(k)))
            c.signature = SIGNATURES[peak]
        cards.append(c)
    overrides_path = Path(__file__).resolve().parent / "value_overrides.json"
    if cfg.get("overrides", True) and overrides_path.exists():
        overrides = json.loads(overrides_path.read_text())
        for c in cards:
            c.value_override = overrides.get(c.id, 0.0)
    # two passes: some keyword odds depend on the cost (Outsider), which depends on the value
    for _ in range(2):
        for c in cards:
            c.value = card_value(c, cfg)
        assign_costs(cards, cfg["cost_curve"])
    by_cost = {}
    for c in cards:
        by_cost.setdefault(c.cost, []).append(c.value)
    for c in cards:
        vals = sorted(by_cost[c.cost])
        ref = vals[int(cfg.get("compensation_ref", 0.9) * (len(vals) - 1))]
        comp = max(0, min(3, round(ref - c.value))) if cfg.get("compensation", True) else 0
        c.envergure = cfg["envergure"][c.cost] + comp
    bad = {c.label(): reachable(c) for c in cards if reachable(c)}
    if bad:
        raise ValueError(f"unreachable abilities: {bad}")
    return cards


def assign_costs(cards: list[Card], curve) -> None:
    """Quantile mapping: sort by value (ties by id, deterministic) and cut by the target curve."""
    ordered = sorted(cards, key=lambda c: (c.value, c.id))
    n = len(ordered)
    bounds, acc = [], 0.0
    for share in curve:
        acc += share
        bounds.append(round(acc * n))
    cost = 1
    for i, c in enumerate(ordered):
        while i >= bounds[cost - 1]:
            cost += 1
        c.cost = cost


# --------------------------------------------------------------------------------------------------
# Territories and contexts

DOMAIN_TERRITORY = {
    "influence": "Parlement",
    "diplomacy": "Sommet",
    "charisma": "Opinion",
    "strategy": "État-major",
}

# id -> (weight, short rule). Effects are implemented in Match.
CONTEXTS = {
    "calme": (3, "Aucun effet."),
    "crise": (1, "Les cartes de coût 1 ou 2 ont +2 ici."),
    "multilateral": (1, "+1 par continent différent parmi vos cartes ici."),
    "scandale": (1, "Fermé après le tour 4 : plus aucune carte ne peut y être jouée."),
    "majorite": (1, "2 cartes maximum par camp ici."),
    "tribune": (1, "La première carte jouée ici par chaque camp a +3."),
    "archives": (1, "Les cartes antiques, médiévales et modernes ont +2 ici."),
    "coalition": (1, "Délégation et Compatriotes rapportent le double ici."),
}


@dataclass
class Territory:
    domain: str
    context: str

    @property
    def name(self) -> str:
        return DOMAIN_TERRITORY[self.domain]


def draw_territories(rng: random.Random, use_contexts: bool = True) -> list[Territory]:
    domains = rng.sample(STATS, 3)
    ids = list(CONTEXTS)
    weights = [CONTEXTS[i][0] for i in ids]
    out, used = [], set()
    for d in domains:
        ctx = "calme"
        if use_contexts:
            while True:
                ctx = rng.choices(ids, weights)[0]
                if ctx == "calme" or ctx not in used:
                    break
            used.add(ctx)
        out.append(Territory(d, ctx))
    return out


# --------------------------------------------------------------------------------------------------
# Match state


@dataclass(eq=False)
class Played:
    card: Card
    turn: int
    order: int                 # global reveal order, for "first card here" rules
    sursaut: bool = False      # locked at reveal


@dataclass
class Side:
    deck: list
    hand: list = field(default_factory=list)
    initial_order: list = field(default_factory=list)


class Match:
    def __init__(self, deck_a: list[Card], deck_b: list[Card], rng: random.Random, config: dict | None = None):
        self.cfg = config or CONFIG
        self.rng = rng
        self.territories = draw_territories(rng, self.cfg["contexts"])
        self.sides = []
        for deck in (deck_a, deck_b):
            d = list(deck)
            rng.shuffle(d)
            s = Side(deck=d)
            s.initial_order = [c.id for c in reversed(d)]  # draw order, for golden parity tests
            for _ in range(self.cfg["start_hand"]):
                s.hand.append(s.deck.pop())
            self.sides.append(s)
        self.lanes = [[[], []] for _ in range(3)]  # lanes[l][side] -> list[Played]
        self.turn = 0
        self.order = 0
        self.first_initiative = rng.randrange(2)
        self.log = []  # (turn, side, card_id, lane)
        self.initiatives = []

    def clone(self, rng: random.Random) -> "Match":
        """Cheap copy for AI rollouts (played cards are shared, they are never mutated after reveal)."""
        m = Match.__new__(Match)
        m.cfg, m.rng, m.territories = self.cfg, rng, self.territories
        m.sides = [Side(deck=list(s.deck), hand=list(s.hand)) for s in self.sides]
        m.lanes = [[list(l[0]), list(l[1])] for l in self.lanes]
        m.turn, m.order, m.first_initiative = self.turn, self.order, self.first_initiative
        m.log, m.initiatives = list(self.log), list(self.initiatives)
        return m

    # ---- rules helpers -------------------------------------------------------------------------
    def capital(self, side: int) -> int:
        return self.turn + self.cfg.get("capital_bonus", 0)

    def lane_cap(self, lane: int) -> int:
        return 2 if self.territories[lane].context == "majorite" else self.cfg["lane_cap"]

    def lane_open(self, lane: int) -> bool:
        return not (self.territories[lane].context == "scandale" and self.turn > 4)

    def draw(self, side: int) -> None:
        s = self.sides[side]
        if s.deck and len(s.hand) < self.cfg["hand_max"]:
            s.hand.append(s.deck.pop())

    def condition(self, p: Played, side: int, lane: int) -> bool:
        c = p.card
        own = self.lanes[lane][side]
        opp = self.lanes[lane][1 - side]
        k = c.keyword
        if k == "constant":
            return True
        if k == "alliance":
            return any(o is not p and o.card.continent == c.continent for o in own)
        if k == "ouverture":
            return any(o is not p and o.card.continent != c.continent for o in own)
        if k == "riposte":
            return any(o.card.era == c.kvalue for o in opp)
        if k == "specialiste":
            return self.territories[lane].domain == c.kvalue
        if k == "tempo":
            return p.turn in tempo_turns(int(c.kvalue), c.cost)
        if k == "sursaut":
            return p.sursaut
        if k == "outsider":
            return any(outsider_holds(c.cost, o.card.cost) for o in opp)
        raise ValueError(k)

    def stat_matches(self, c: Card, lane: int) -> bool:
        if not self.cfg.get("stat_lock", False):
            return True
        return c.estat == "any" or c.estat == self.territories[lane].domain

    def card_power(self, p: Played, side: int, lane: int) -> int:
        """Power of one card, without lane-level bonuses and opposing pressure."""
        c = p.card
        t = self.territories[lane]
        base = c.peak() if c.signature == "polyvalent" else c.stats[t.domain]
        v = base + c.envergure
        if c.etype == "soutien" and self.stat_matches(c, lane) and self.condition(p, side, lane):
            v += c.amount
        ctx = t.context
        if ctx == "crise" and c.cost <= 2:
            v += 2
        elif ctx == "archives" and c.era != "contemporary":
            v += 2
        elif ctx == "tribune":
            own = self.lanes[lane][side]
            if own and own[0] is p:
                v += 3
        return v

    def hidden(self, p: Played, side: int, viewer) -> bool:
        return viewer is not None and viewer != side and p.card.signature == "discret"

    def lane_power(self, lane: int, side: int, viewer=None) -> int:
        """Power of `side` in `lane`. With `viewer`, what that player can know: the opponent's
        Discret cards count as an estimate from their visible cost, and their effects are unknown."""
        own = self.lanes[lane][side]
        opp = self.lanes[lane][1 - side]
        total = 0
        for p in own:
            if self.hidden(p, side, viewer):
                total += 4 + p.card.envergure + (p.card.cost + 1) // 2
            else:
                total += self.card_power(p, side, lane)
        rallies = sum(1 for p in own if p.card.signature == "ralliement" and not self.hidden(p, side, viewer))
        if rallies:
            total += rallies * (len(own) - 1)
        mult = 2 if self.territories[lane].context == "coalition" else 1
        if own:
            conts, countries = {}, {}
            for p in own:
                conts[p.card.continent] = conts.get(p.card.continent, 0) + 1
                countries[p.card.country] = countries.get(p.card.country, 0) + 1
            # Coalition: only the best of Délégation / Compatriotes counts in a territory (no stacking)
            delegation = self.cfg["delegation_bonus"] if max(conts.values()) >= self.cfg["delegation_min"] else 0
            compatriots = self.cfg["compatriots_bonus"] if max(countries.values()) >= self.cfg["compatriots_min"] else 0
            total += max(delegation, compatriots) * mult
            if self.territories[lane].context == "multilateral":
                total += len(conts)
        for p in opp:
            c = p.card
            if self.hidden(p, 1 - side, viewer):
                continue
            if c.etype == "pression" and self.stat_matches(c, lane) and self.condition(p, 1 - side, lane):
                total -= c.amount
        return max(0, total)

    def effect_active(self, p: Played, side: int, lane: int) -> bool:
        """Whether this card's keyword currently does something (for the activation-rate metric)."""
        c = p.card
        if c.etype != "veto" and not self.stat_matches(c, lane):
            return False
        return self.condition(p, side, lane)

    def has_veto(self, lane: int, side: int) -> bool:
        return any(p.card.etype == "veto" and self.condition(p, side, lane) for p in self.lanes[lane][side])

    def lane_winner(self, lane: int):
        a, b = self.lane_power(lane, 0), self.lane_power(lane, 1)
        if a != b:
            return 0 if a > b else 1
        va, vb = self.has_veto(lane, 0), self.has_veto(lane, 1)
        if va != vb:
            return 0 if va else 1
        return None

    def standing(self, side: int):
        """(lanes won, total power margin) for `side`: used for initiative and the final result."""
        won = lost = 0
        margin = 0
        for l in range(3):
            w = self.lane_winner(l)
            if w == side:
                won += 1
            elif w == 1 - side:
                lost += 1
            margin += self.lane_power(l, side) - self.lane_power(l, 1 - side)
        return won - lost, margin

    def initiative(self) -> int:
        """Side that reveals first this turn: the one ahead on the board; else alternate."""
        s0 = self.standing(0)
        if s0 > (0, 0):
            return 0
        if s0 < (0, 0):
            return 1
        return (self.first_initiative + self.turn - 1) % 2

    # ---- turn flow ------------------------------------------------------------------------------
    def legal(self, side: int, plays) -> bool:
        cap = self.capital(side)
        hand = list(self.sides[side].hand)
        counts = [len(self.lanes[l][side]) for l in range(3)]
        for c, l in plays:
            if c not in hand or not self.lane_open(l):
                return False
            hand.remove(c)
            cap -= c.cost
            counts[l] += 1
            if cap < 0 or counts[l] > self.lane_cap(l):
                return False
        return True

    def start_turn(self) -> None:
        self.turn += 1
        for s in (0, 1):
            self.draw(s)

    def reveal(self, plays_by_side) -> None:
        first = self.initiative()
        self.initiatives.append(first)
        for side in (first, 1 - first):
            for c, l in plays_by_side[side]:
                self.sides[side].hand.remove(c)
                p = Played(c, self.turn, self.order)
                self.order += 1
                # Sursaut locks when the card is revealed: was this side behind here just before?
                p.sursaut = self.lane_power(l, side) < self.lane_power(l, 1 - side)
                self.lanes[l][side].append(p)
                self.log.append((self.turn, side, c.id, l))
                if c.signature == "mobilisation":
                    self.draw(side)

    def result(self):
        """0 / 1 for the winner, None for a draw. Rule: most territories won, then total power."""
        diff, margin = self.standing(0)
        if diff > 0:
            return 0
        if diff < 0:
            return 1
        if margin > 0:
            return 0
        if margin < 0:
            return 1
        return None


def play_match(deck_a, deck_b, bot_a, bot_b, rng: random.Random, config: dict | None = None):
    m = Match(deck_a, deck_b, rng, config)
    for _ in range(m.cfg["turns"]):
        m.start_turn()
        plays = [bot_a.plan(m, 0, rng), bot_b.plan(m, 1, rng)]
        for s in (0, 1):
            if not m.legal(s, plays[s]):
                raise AssertionError(f"illegal plan from side {s}: {plays[s]}")
        m.reveal(plays)
    return m
