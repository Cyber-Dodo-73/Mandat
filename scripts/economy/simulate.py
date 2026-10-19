#!/usr/bin/env python3
"""
MANDAT economy simulator (Monte Carlo, one step = one day).

Mirrors the server rules of season 1 (values copied from the API, keep them in sync):
  - api/.../pack/draw/DrawOdds.java        odds, pity, finishes
  - api/.../pack/FreePackTimer.java        12 h / stock 2
  - api/.../collection/EconomyRules.java   duplicate bonus, recycle, craft
  - api/.../progression/**                 XP, levels, season pass, missions, achievements
  - api/.../quiz/QuizRules.java, duel/DuelRules.java

Usage:
  python3 scripts/economy/simulate.py              # all scenarios, 300 runs each, markdown on stdout
  python3 scripts/economy/simulate.py --runs 100 --seed 7 --scenario current

No dependency besides the Python 3.10+ standard library.
"""
from __future__ import annotations

import argparse
import json
import random
import statistics
from dataclasses import dataclass, field, replace
from pathlib import Path

RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"]
RANK = {r: i for i, r in enumerate(RARITIES)}
DEFAULT_COUNTS = {"common": 180, "uncommon": 120, "rare": 100, "epic": 60, "legendary": 30, "mythic": 10}

# ---- DrawOdds.java -------------------------------------------------------------------------
REGULAR_SLOT = {"common": 65.0, "uncommon": 25.0, "rare": 10.0}
GUARANTEED_SLOT = {"rare": 70.0, "epic": 22.0, "legendary": 7.0, "mythic": 1.0}
EPIC_PITY, LEGENDARY_PITY = 10, 40
GOLD, FULL_ART, HOLO = 0.003, 0.03, 0.08
FINISH_MULT = {"standard": 1, "holo": 2, "full_art": 4, "gold": 10}

# ---- Missions (MissionCatalog.java): (type, xp, influence, packs) ---------------------------
CONTINENTS = 6
DAILY_POOL = [
    ("OPEN_PACKS", 40, 20, 0), ("OPEN_PACKS", 60, 30, 0), ("PULL_RARE", 50, 30, 0),
    ("NEW_CARDS", 50, 25, 0), ("COMPLETE_QUIZ", 50, 25, 0), ("PERFECT_QUIZ", 80, 40, 0),
    ("PLAY_DUEL", 40, 20, 0), ("WIN_DUEL", 70, 35, 0), ("RECYCLE", 40, 20, 0),
] + [("NEW_CARDS_CONTINENT", 60, 30, 0)] * CONTINENTS
WEEKLY_POOL = [
    ("OPEN_PACKS", 250, 0, 1), ("OPEN_PACKS", 350, 0, 1), ("PULL_RARE", 250, 150, 0),
    ("NEW_CARDS", 300, 0, 1), ("COMPLETE_QUIZ", 250, 150, 0), ("PERFECT_QUIZ", 300, 0, 1),
    ("PLAY_DUEL", 250, 150, 0), ("WIN_DUEL", 300, 0, 1), ("RECYCLE", 200, 200, 0), ("CRAFT", 200, 100, 0),
] + [("NEW_CARDS_CONTINENT", 300, 0, 1)] * CONTINENTS


def mission_inf(rules, value):
    """MissionCatalog Influence after scaling: rounded to 5, at least 5 (0 stays 0)."""
    if value == 0 or rules.mission_inf_mult == 1.0:
        return value
    return max(5, 5 * round(value * rules.mission_inf_mult / 5))


def assign(pool, rng, n=3):
    """MissionAssigner: shuffle, keep the first template of each distinct type."""
    shuffled = pool[:]
    rng.shuffle(shuffled)
    picked, types = [], set()
    for t in shuffled:
        if t[0] not in types:
            types.add(t[0])
            picked.append(t)
            if len(picked) == n:
                break
    return picked


@dataclass(frozen=True)
class Rules:
    """Tunable economy. Defaults = what the API ships today (2026-10-19)."""
    craft_cost: dict = field(default_factory=lambda: {"common": 40, "uncommon": 80, "rare": 200, "epic": 500, "legendary": 1200, "mythic": 3000})
    recycle: dict = field(default_factory=lambda: {"common": 5, "uncommon": 10, "rare": 25, "epic": 60, "legendary": 150, "mythic": 400})
    dup_bonus: dict = field(default_factory=lambda: {"common": 1, "uncommon": 2, "rare": 5, "epic": 12, "legendary": 30, "mythic": 80})
    free_per_day: float = 2.0            # FreePackTimer: 12 h, stock 2 -> a once-a-day player still gets 2
    season_days: int = 91
    pass_tiers: int = 50
    xp_per_tier: int = 200
    level_base: int = 100
    level_step: int = 50
    max_level: int = 100
    quiz_perfect_per_booster: int = 5
    # Achievements are one-off: ~31 boosters and ~5 000 Influence over the catalog. Spread over 120 days.
    achievement_packs: int = 31
    achievement_influence: int = 5000
    achievement_days: int = 120
    # Influence faucets (defaults = API on 2026-10-19)
    level_influence: int = 50                 # LevelRewardCatalog.INFLUENCE_PER_LEVEL
    mission_inf_mult: float = 1.0             # scales every mission Influence reward of MissionCatalog
    pass_inf_base: int = 50                   # SeasonPassCatalog: base + step * (tier // 10)
    pass_inf_step: int = 10
    quiz_inf_correct: int = 2                 # QuizRules
    quiz_inf_perfect: int = 10
    duel_inf_win: int = 20                    # DuelRules, NORMAL difficulty
    duel_inf_loss: int = 3
    finish_mult: dict = field(default_factory=lambda: dict(FINISH_MULT))
    dup_bonus_uses_finish: bool = True        # duplicate bonus × finish multiplier (before 2026-10-19)
    quiz_rewarded_per_day: int = 10**6        # daily caps (none before 2026-10-19)
    duel_rewarded_wins_per_day: int = 10**6
    # crafting allowance (RewardLimits): one craft earned every N days, stock max, starting stock
    craft_interval_days: float = 0.0          # 0 = no allowance (before 2026-10-19)
    craft_max_stock: int = 3
    craft_start_stock: int = 1


@dataclass(frozen=True)
class Profile:
    name: str
    active_days_per_week: float      # days the player opens the app
    quizzes: float                   # per active day
    perfect_rate: float
    duels: float                     # per active day
    duel_win_rate: float
    daily_mission_rate: float        # share of the 3 daily missions completed on an active day
    weekly_mission_rate: float
    premium: bool = False
    # Premium perks (Mandat Premium)
    premium_extra_per_day: float = 0.0   # extra boosters per day from the premium gauge
    premium_track_packs: int = 0         # boosters on the premium season-pass track
    premium_track_influence: int = 0
    premium_weekly_influence: int = 0    # weekly "dotation"
    premium_craft_discount: float = 0.0  # e.g. 0.2 = -20 % craft cost


def sim_run(counts, rules: Rules, prof: Profile, rng: random.Random, days: int, policy: str):
    cards = {r: [f"{r[0]}{i}" for i in range(counts[r])] for r in RARITIES}
    rarity_of = {c: r for r in RARITIES for c in cards[r]}
    total = sum(counts.values())
    owned: set[str] = set()
    pairs: dict[tuple[str, str], int] = {}
    missing = {r: set(cards[r]) for r in RARITIES}
    influence = 0
    bonus_packs = 0
    since_epic = since_leg = 0
    xp_total = 0
    season_xp = 0
    level = 1
    season_tier = 0
    perfect_count = 0
    pass_done_day = None
    packs_opened = 0
    inf_earned = 0
    src = {}

    cur_day = [0]
    src_season = {}
    crafts_season = []  # (rarity, cost) of crafts during the first season

    def earn(k, v):
        nonlocal influence, inf_earned
        influence += v; inf_earned += v
        src[k] = src.get(k, 0) + v
        if cur_day[0] <= rules.season_days:
            src_season[k] = src_season.get(k, 0) + v
    done_day = {r: None for r in RARITIES}
    full_day = None
    snap = {}
    packs_by_day = {}
    free_acc = 0.0
    prem_acc = 0.0
    allowance = [float(rules.craft_start_stock)]

    def level_xp(n):  # cumulative XP to reach level n
        k = n - 1
        return rules.level_base * k + rules.level_step * k * (k - 1) // 2

    def gain_xp(x):
        nonlocal xp_total, season_xp, level, season_tier, influence, bonus_packs, inf_earned, pass_done_day
        xp_total += x
        season_xp += x
        while level < rules.max_level and xp_total >= level_xp(level + 1):
            level += 1
            earn("niveaux", rules.level_influence)
            if level % 2 == 0:
                bonus_packs += 1
        new_tier = min(rules.pass_tiers, season_xp // rules.xp_per_tier)
        while season_tier < new_tier:
            season_tier += 1
            t = season_tier
            if t == rules.pass_tiers:
                bonus_packs += 3
                if pass_done_day is None:
                    pass_done_day = cur_day[0]
            elif t % 5 == 0:
                bonus_packs += 1
            else:
                earn("passe saison", rules.pass_inf_base + rules.pass_inf_step * (t // 10))
            if prof.premium:  # premium track spread evenly over the tiers
                bonus_packs_f = prof.premium_track_packs / rules.pass_tiers
                gain_fraction_pack(bonus_packs_f)
                earn("premium", prof.premium_track_influence // rules.pass_tiers)

    frac = [0.0]

    def gain_fraction_pack(f):
        nonlocal bonus_packs
        frac[0] += f
        while frac[0] >= 1:
            frac[0] -= 1
            bonus_packs += 1

    def pick(weights):
        tot = sum(weights.values())
        x = rng.random() * tot
        last = None
        for k, w in weights.items():
            last = k
            x -= w
            if x < 0:
                return k
        return last

    def finish(rar, slot5):
        x = rng.random()
        if x < GOLD:
            return "gold"
        x -= GOLD
        if slot5 and RANK[rar] >= RANK["rare"]:
            if x < FULL_ART:
                return "full_art"
            x -= FULL_ART
        if x < HOLO:
            return "holo"
        return "standard"

    def open_pack():
        nonlocal since_epic, since_leg, influence, packs_opened, inf_earned
        drawn = []
        for _ in range(4):
            r = pick(REGULAR_SLOT)
            drawn.append((r, False))
        forced = None
        if since_leg + 1 >= LEGENDARY_PITY:
            forced = "legendary"
        elif since_epic + 1 >= EPIC_PITY:
            forced = "epic"
        w = GUARANTEED_SLOT if forced is None else {k: v for k, v in GUARANTEED_SLOT.items() if RANK[k] >= RANK[forced]}
        drawn.append((pick(w), True))
        new_cards = 0
        rare_plus = False
        for r, s5 in drawn:
            c = rng.choice(cards[r])
            f = finish(r, s5)
            if c in owned:
                earn("bonus doublons", rules.dup_bonus[r] * (rules.finish_mult[f] if rules.dup_bonus_uses_finish else 1))
            else:
                owned.add(c)
                missing[r].discard(c)
                new_cards += 1
            pairs[(c, f)] = pairs.get((c, f), 0) + 1
            if RANK[r] >= RANK["rare"]:
                rare_plus = True
        rs = [r for r, _ in drawn]
        since_epic = 0 if any(RANK[r] >= RANK["epic"] for r in rs) else since_epic + 1
        since_leg = 0 if any(RANK[r] >= RANK["legendary"] for r in rs) else since_leg + 1
        packs_opened += 1
        return new_cards, rare_plus

    # expected copies per pack of one specific card, for the crafting priority
    per_pack = {}
    for r in RARITIES:
        e = 4 * REGULAR_SLOT.get(r, 0) / 100 + GUARANTEED_SLOT.get(r, 0) / 100
        per_pack[r] = e / counts[r] if counts[r] else 0
    craft_cost = {r: int(round(rules.craft_cost[r] * (1 - prof.premium_craft_discount))) for r in RARITIES}
    ratio_order = sorted(RARITIES, key=lambda r: -(1 / (per_pack[r] * craft_cost[r])))
    rarest_first = list(reversed(RARITIES))

    limited = rules.craft_interval_days > 0

    def craft():
        nonlocal influence
        crafted = 0
        # With an allowance, crafts are scarce: spend them on the rarest affordable missing card.
        order = rarest_first if limited else (ratio_order if policy == "ratio" else rarest_first)
        while True:
            if limited and allowance[0] < 1:
                return crafted
            for r in order:
                if missing[r]:
                    if influence >= craft_cost[r]:
                        if limited:
                            allowance[0] -= 1
                        c = next(iter(missing[r]))
                        influence -= craft_cost[r]
                        missing[r].discard(c)
                        owned.add(c)
                        pairs[(c, "standard")] = pairs.get((c, "standard"), 0) + 1
                        crafted += 1
                        if cur_day[0] <= rules.season_days:
                            crafts_season.append((r, craft_cost[r]))
                        break
                    if policy == "rarest" and not limited:
                        return crafted  # save up for the rarest missing card
            else:
                return crafted

    def recycle():
        nonlocal influence, inf_earned
        n = 0
        for (c, f), q in pairs.items():
            if q > 1:
                earn("recyclage", rules.recycle[rarity_of[c]] * rules.finish_mult[f] * (q - 1))
                pairs[(c, f)] = 1
                n += q - 1
        return n

    p_active = prof.active_days_per_week / 7
    weekly = []
    weekly_progress = {}
    for day in range(1, days + 1):
        cur_day[0] = day
        if (day - 1) % rules.season_days == 0:
            season_xp = 0
            season_tier = 0
        if (day - 1) % 7 == 0:
            weekly = assign(WEEKLY_POOL, rng)
            weekly_progress = {}
        # achievements (one-off, spread)
        if day <= rules.achievement_days:
            gain_fraction_pack(rules.achievement_packs / rules.achievement_days)
            earn("succès", rules.achievement_influence // rules.achievement_days)
        if prof.premium and prof.premium_weekly_influence and (day - 1) % 7 == 0:
            earn("premium", prof.premium_weekly_influence)
        if limited:
            allowance[0] = min(rules.craft_max_stock, allowance[0] + 1 / rules.craft_interval_days)
        # timers accrue every day; the stock (2 free, 4 premium) absorbs one missed day
        free_acc = min(free_acc + rules.free_per_day, 2 * rules.free_per_day)
        if prof.premium:
            prem_acc = min(prem_acc + prof.premium_extra_per_day, 2 * prof.premium_extra_per_day)
        active = rng.random() < p_active
        if not active:
            packs_by_day[day] = packs_opened
            if day in (7, 30, 91, 182, 365):
                snap[day] = len(owned)
            continue
        opened_today = 0
        new_today = 0
        rare_today = False
        while free_acc >= 1:
            free_acc -= 1
            n, rp = open_pack(); opened_today += 1; new_today += n; rare_today |= rp
        while prem_acc >= 1:
            prem_acc -= 1
            n, rp = open_pack(); opened_today += 1; new_today += n; rare_today |= rp
        while bonus_packs > 0:
            bonus_packs -= 1
            n, rp = open_pack(); opened_today += 1; new_today += n; rare_today |= rp
        recycled = recycle()
        crafted = craft()
        new_today += crafted
        xp = 20 * opened_today + 5 * new_today + 5 * (1 if recycled else 0) + 10 * crafted
        # quiz & duels
        nq = int(prof.quizzes) + (1 if rng.random() < prof.quizzes % 1 else 0)
        perfects = 0
        for qi in range(nq):
            perfect = rng.random() < prof.perfect_rate
            correct = 10 if perfect else rng.randint(4, 9)
            xp += 30 + (20 if perfect else 0)
            if qi >= rules.quiz_rewarded_per_day:
                continue  # beyond the daily cap: XP only, no Influence nor bonus-booster progress
            earn("quiz", correct * rules.quiz_inf_correct + (rules.quiz_inf_perfect if perfect else 0))
            if perfect:
                perfects += 1
                perfect_count += 1
                if perfect_count % rules.quiz_perfect_per_booster == 0:
                    bonus_packs += 1
        nd = int(prof.duels) + (1 if rng.random() < prof.duels % 1 else 0)
        wins = 0
        rewarded_wins = 0
        for _ in range(nd):
            win = rng.random() < prof.duel_win_rate
            wins += win
            xp += 15 + (25 if win else 0)
            if rewarded_wins >= rules.duel_rewarded_wins_per_day:
                continue  # daily cap reached: the duel still plays, no Influence
            if win:
                rewarded_wins += 1
            earn("duels", rules.duel_inf_win if win else rules.duel_inf_loss)
        # missions
        missing_total = total - len(owned)
        daily = assign(DAILY_POOL, rng)
        for t in daily:
            if t[0] in ("NEW_CARDS", "NEW_CARDS_CONTINENT") and missing_total < 30:
                continue
            if t[0] in ("PERFECT_QUIZ",) and perfects == 0:
                continue
            if t[0] in ("WIN_DUEL",) and wins == 0:
                continue
            if rng.random() < prof.daily_mission_rate:
                xp += t[1]; earn("missions", mission_inf(rules, t[2]))
        for t in weekly:
            key = id(t)
            if weekly_progress.get(key):
                continue
            if t[0] in ("NEW_CARDS", "NEW_CARDS_CONTINENT") and missing_total < 30:
                continue
            # spread the weekly completion chance over the active days of the week
            if rng.random() < prof.weekly_mission_rate / max(1, prof.active_days_per_week):
                weekly_progress[key] = True
                xp += t[1]; earn("missions", mission_inf(rules, t[2])); bonus_packs += t[3]
        gain_xp(xp)
        crafted2 = craft()  # spend Influence from quiz/duel/missions too
        # milestones
        for r in RARITIES:
            if done_day[r] is None and not missing[r]:
                done_day[r] = day
        if full_day is None and len(owned) == total:
            full_day = day
        packs_by_day[day] = packs_opened
        if day in (7, 30, 91, 182, 365):
            snap[day] = len(owned)
        if full_day is not None and day >= 365:
            break
    for d in (7, 30, 91, 182, 365):
        snap.setdefault(d, len(owned))
    finishes_owned = {f: sum(1 for (c, ff) in pairs if ff == f) for f in ("holo", "full_art", "gold")}
    return {
        "done": done_day, "full": full_day, "snap": snap, "packs91": packs_by_day.get(91, packs_opened),
        "packs365": packs_by_day.get(365, packs_opened), "level": level, "inf": inf_earned,
        "finishes": finishes_owned, "src": src, "pass": pass_done_day,
        "src_season": src_season, "crafts_season": crafts_season,
    }


def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None


def pct(xs, q):
    xs = sorted(x if x is not None else 10**9 for x in xs)
    v = xs[min(len(xs) - 1, int(q * len(xs)))]
    return None if v >= 10**9 else v


def fmt(v):
    return "> horizon" if v is None else f"{v:.0f}"


# ---- Profiles -------------------------------------------------------------------------------
F2P_CASUAL = Profile("F2P occasionnel", 5, 0.5, 0.35, 1, 0.5, 0.6, 0.5)
F2P_ENGAGED = Profile("F2P assidu", 7, 1, 0.5, 3, 0.6, 0.95, 0.95)
PREMIUM = dict(premium=True, premium_extra_per_day=2.0, premium_track_packs=15,
               premium_track_influence=2000, premium_weekly_influence=300, premium_craft_discount=0.0)
PREM_CASUAL = replace(F2P_CASUAL, name="Premium occasionnel", **PREMIUM)
PREM_ENGAGED = replace(F2P_ENGAGED, name="Premium assidu", **PREMIUM)
F2P_GRINDER = Profile("F2P acharné", 7, 6, 0.6, 12, 0.6, 1.0, 1.0)  # farms quizzes and duels
PROFILES = [F2P_CASUAL, F2P_ENGAGED, F2P_GRINDER, PREM_CASUAL, PREM_ENGAGED]

# ---- Scenarios ------------------------------------------------------------------------------
CURRENT = Rules()
TUNED = Rules(
    # 14-week seasons (98 days) and a pass that takes ~7 weeks of assiduous play instead of ~3.5
    season_days=98,
    xp_per_tier=400,
    # crafting the chase tiers costs more: the last legendaries/mythics stay a goal for F2P,
    # while assiduous Premium players still complete the set inside the season
    craft_cost={"common": 40, "uncommon": 80, "rare": 200, "epic": 600, "legendary": 1500, "mythic": 4000},
)
def rebalanced(**overrides):
    """Crafting ≈ 1 card every 2 days for an active free player (user request, 2026-10-19).

    "10 duplicates of a rarity = 1 craft of that rarity" (TCG review §3.4) makes recycling alone
    worth ~1 craft/day, so the pace comes from a server-side allowance (1 craft / 48 h, stock 3)
    plus daily caps on rewarded quizzes (3) and duel wins (5); the other faucets are cut.
    Season length and pass XP are left as shipped (91 days, 200 XP per tier). These are the
    values the API ships since 2026-10-19 (EconomyRules, economy.RewardLimits, MissionCatalog,
    AchievementCatalog, LevelRewardCatalog, SeasonPassCatalog, QuizRules, DuelRules).
    """
    base = dict(
        # TCG review §3.4: "10 duplicates of a rarity = 1 craft of that rarity" (recycle = craft / 10)
        craft_cost={"common": 100, "uncommon": 200, "rare": 500, "epic": 1200, "legendary": 3000, "mythic": 8000},
        recycle={"common": 10, "uncommon": 20, "rare": 50, "epic": 120, "legendary": 300, "mythic": 800},
        dup_bonus={"common": 2, "uncommon": 4, "rare": 10, "epic": 25, "legendary": 60, "mythic": 150},
        finish_mult={"standard": 1, "holo": 2, "full_art": 4, "gold": 5},
        dup_bonus_uses_finish=False,
        quiz_rewarded_per_day=3,
        duel_rewarded_wins_per_day=5,
        craft_interval_days=2.0,
        craft_max_stock=3,
        craft_start_stock=1,
        level_influence=20,
        mission_inf_mult=0.3,
        pass_inf_base=20,
        pass_inf_step=5,
        quiz_inf_correct=1,
        quiz_inf_perfect=5,
        duel_inf_win=6,
        duel_inf_loss=1,
        achievement_influence=2000,
    )
    base.update(overrides)
    return Rules(**base)


REBALANCED = rebalanced()
# Variants used in docs/BUSINESS.md to show why the pace needs an allowance with a 1:10 ratio.
NO_ALLOWANCE = rebalanced(craft_interval_days=0.0)
MIN_FAUCETS = rebalanced(
    craft_interval_days=0.0,
    dup_bonus={r: 0 for r in RARITIES}, level_influence=0, mission_inf_mult=0.0001, pass_inf_base=0,
    pass_inf_step=0, quiz_inf_correct=0, quiz_inf_perfect=0, duel_inf_win=0, duel_inf_loss=0, achievement_influence=0)
RATIO_20 = rebalanced(
    craft_interval_days=0.0,
    recycle={"common": 5, "uncommon": 10, "rare": 25, "epic": 60, "legendary": 150, "mythic": 400},
    dup_bonus={"common": 1, "uncommon": 2, "rare": 5, "epic": 12, "legendary": 30, "mythic": 75})
SCENARIOS = {"current": CURRENT, "tuned": TUNED, "rebalanced": REBALANCED, "rebalanced_no_allowance": NO_ALLOWANCE,
             "ratio10_min_faucets": MIN_FAUCETS, "ratio20": RATIO_20}
# "ratio" = craft as soon as affordable, best value first (what an impatient player does: max crafts);
# "rarest" = save up for the rarest missing card. By default the faster set completion is reported.
POLICIES = ("ratio", "rarest")


def load_counts():
    path = Path(__file__).resolve().parents[2] / "data" / "cards.season1.json"
    try:
        data = json.loads(path.read_text())
        cards = data["cards"] if isinstance(data, dict) else data
        counts = {r: 0 for r in RARITIES}
        for c in cards:
            counts[c["rarity"]] += 1
        return counts
    except (OSError, KeyError, ValueError):
        return dict(DEFAULT_COUNTS)


def run_scenario(name, rules, counts, runs, seed, days):
    print(f"\n### Scénario `{name}`\n")
    print(f"Règles : saison {rules.season_days} j, passe {rules.pass_tiers} paliers × {rules.xp_per_tier} XP, "
          f"craft {rules.craft_cost}, bonus doublon {rules.dup_bonus}.\n")
    rows = []
    for prof in PROFILES:
        best = None
        for policy in POLICIES:
            rng = random.Random(seed)
            res = [sim_run(counts, rules, prof, rng, days, policy) for _ in range(runs)]
            m = med([r["full"] for r in res])
            score = m if m is not None else 10**9
            if best is None or score < best[0]:
                best = (score, policy, res)
        _, policy, res = best
        rows.append((prof, policy, res))
    total = sum(counts.values())
    print("| Profil | Boosters/j (moy. 91 j) | Cartes/j | % set J30 | % set J91 | % set J182 | Passe saison 1 fini (j) | Niveau final |")
    print("|---|---|---|---|---|---|---|---|")
    for prof, policy, res in rows:
        p91 = statistics.mean(r["packs91"] for r in res) / 91
        s = {d: statistics.mean(r["snap"][d] for r in res) / total * 100 for d in (30, 91, 182)}
        print(f"| {prof.name} | {p91:.2f} | {p91 * 5:.1f} | {s[30]:.0f} % | {s[91]:.0f} % | {s[182]:.0f} % | "
              f"{fmt(med([r['pass'] for r in res]))} | {statistics.mean(r['level'] for r in res):.0f} |")
    print("\nJours médians pour compléter chaque rareté (craft inclus, stratégie de craft la plus rapide) :\n")
    print("| Profil | Stratégie craft | Commune | Peu commune | Rare | Épique | Légendaire | Mythique | **Set 500 (médiane)** | Set 500 (P90) |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for prof, policy, res in rows:
        cells = [fmt(med([r["done"][rr] for r in res])) for rr in RARITIES]
        print(f"| {prof.name} | {policy} | " + " | ".join(cells) +
              f" | **{fmt(med([r['full'] for r in res]))}** | {fmt(pct([r['full'] for r in res], 0.9))} |")
    print("\nFinitions possédées au J365 (paires carte+finition, moyenne) et Influence gagnée :\n")
    print("| Profil | Holo | Full art | Or | Influence gagnée J365 |")
    print("|---|---|---|---|---|")
    for prof, policy, res in rows:
        fz = {f: statistics.mean(r["finishes"][f] for r in res) for f in ("holo", "full_art", "gold")}
        print(f"| {prof.name} | {fz['holo']:.0f} / 500 | {fz['full_art']:.0f} / 320 | {fz['gold']:.1f} / 500 | "
              f"{statistics.mean(r['inf'] for r in res):,.0f} |")
    keys = ["recyclage", "bonus doublons", "missions", "passe saison", "niveaux", "succès", "quiz", "duels", "premium"]
    sd = rules.season_days
    print(f"\nÉconomie de craft sur la saison 1 ({sd} j) : Influence gagnée par jour et fabrications :\n")
    print("| Profil | Influence/j | " + " | ".join(keys) + " | Crafts/j | Coût moyen d'un craft | Crafts par rareté (C/PC/R/É/L/M) |")
    print("|---|---|" + "---|" * len(keys) + "---|---|---|")
    for prof, policy, res in rows:
        per = {k: statistics.mean(r["src_season"].get(k, 0) for r in res) / sd for k in keys}
        crafts = [c for r in res for c in r["crafts_season"]]
        cpd = len(crafts) / len(res) / sd
        avg = statistics.mean(c[1] for c in crafts) if crafts else 0
        by = [sum(1 for c in crafts if c[0] == rr) / len(res) for rr in RARITIES]
        print(f"| {prof.name} | {sum(per.values()):.0f} | " + " | ".join(f"{per[k]:.0f}" for k in keys) +
              f" | **{cpd:.2f}** | {avg:.0f} | " + " / ".join(f"{b:.0f}" for b in by) + " |")
    print("\nSources d'Influence (part du total gagné sur l'horizon) :\n")
    print("| Profil | " + " | ".join(keys) + " |")
    print("|---|" + "---|" * len(keys))
    for prof, policy, res in rows:
        tot = sum(sum(r["src"].values()) for r in res) or 1
        print(f"| {prof.name} | " + " | ".join(
            f"{sum(r['src'].get(k, 0) for r in res) / tot * 100:.0f} %" for k in keys) + " |")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=300)
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--days", type=int, default=730)
    ap.add_argument("--scenario", choices=list(SCENARIOS) + ["all"], default="all")
    ap.add_argument("--profiles", default="all", help="comma-separated profile names subset, e.g. 'F2P assidu'")
    ap.add_argument("--policy", choices=["best", "ratio", "rarest"], default="best")
    args = ap.parse_args()
    global POLICIES
    if args.policy != "best":
        POLICIES = (args.policy,)
    counts = load_counts()
    print(f"Catalogue : {counts} ({sum(counts.values())} cartes). {args.runs} parties simulées par profil, "
          f"horizon {args.days} j, graine {args.seed}.")
    for name, rules in SCENARIOS.items():
        if args.scenario in ("all", name):
            run_scenario(name, rules, counts, args.runs, args.seed, args.days)


if __name__ == "__main__":
    main()
