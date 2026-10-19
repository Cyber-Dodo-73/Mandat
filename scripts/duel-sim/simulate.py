#!/usr/bin/env python3
"""
MANDAT Duel v2 balance simulator.

Plays thousands of matches between bots with legal decks drawn from the real catalog
(data/cards.season1.json) and prints markdown tables: skill gap between AI levels, archetype win rates,
initiative (first player) advantage, game length, outlier cards, keyword and rarity win rates.

Usage:
  python3 scripts/duel-sim/simulate.py                 # every section, default sizes (~10 min)
  python3 scripts/duel-sim/simulate.py --quick         # smaller samples (~1 min)
  python3 scripts/duel-sim/simulate.py --section cards --games 40000
  python3 scripts/duel-sim/simulate.py --variants      # compares rule variants (tuning log)
  python3 scripts/duel-sim/simulate.py --golden out.json  # reference matches for the Java engine tests

Standard library only (Python 3.10+).
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import random
import statistics
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import engine  # noqa: E402
from bots import BOTS, GreedyBot, HardBot  # noqa: E402
from engine import CONFIG, load_catalog, play_match  # noqa: E402

RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"]

# --------------------------------------------------------------------------------------------------
# Deck building (same constraints as the server: 10 distinct owned cards)

CURVE = [1, 1, 2, 2, 3, 3, 4, 4, 5, 6]
AGGRO = [1, 1, 1, 2, 2, 2, 2, 3, 3, 4]
BIG = [1, 2, 2, 3, 4, 4, 5, 5, 6, 6]
TOO_BIG = [1, 2, 3, 4, 4, 5, 5, 6, 6, 6]  # 42 capital of cards for 21 available: the deck builder warns


def pick(pool, rng, quality, key=lambda c: c.value):
    """Pick one card from `pool`: quality 0 = uniform, 0.8 = among the best 20% by `key`."""
    if not pool:
        return None
    ranked = sorted(pool, key=lambda c: (-key(c), c.id))
    top = max(1, int(math.ceil(len(ranked) * (1 - quality))))
    return rng.choice(ranked[:top])


def build_curve(pool, rng, quality, curve=CURVE, prefer=None):
    deck, used = [], set()
    for cost in curve:
        cands = [c for c in pool if c.cost == cost and c.id not in used]
        if prefer:
            pref = [c for c in cands if prefer(c)]
            cands = pref or cands
        if not cands:  # fall back on the nearest cost
            cands = sorted((c for c in pool if c.id not in used), key=lambda c: abs(c.cost - cost))[:15]
        c = pick(cands, rng, quality)
        deck.append(c)
        used.add(c.id)
    return deck


def archetype_deck(name, catalog, rng, quality=0.7):
    if name == "aleatoire":
        return rng.sample(catalog, 10)
    if name == "courbe":
        return build_curve(catalog, rng, quality)
    if name == "valeur_brute":  # best raw value per cost, no synergy at all ("netdeck" of stats)
        return build_curve(catalog, rng, 0.97)
    if name == "rapide":
        return build_curve(catalog, rng, quality, AGGRO)
    if name == "lourd":
        return build_curve(catalog, rng, quality, BIG)
    if name == "trop_lourd":
        return build_curve(catalog, rng, quality, TOO_BIG)
    if name == "delegation":
        cont = rng.choice(["europe", "north_america", "asia", "africa", "south_america"])
        pool = [c for c in catalog if c.continent == cont]
        return build_curve(pool, rng, quality)
    if name == "compatriotes":
        by_country = Counter(c.country for c in catalog)
        country = rng.choice([k for k, n in by_country.items() if n >= 10])
        cont = next(c.continent for c in catalog if c.country == country)
        pool = [c for c in catalog if c.continent == cont]
        return build_curve(pool, rng, quality, prefer=lambda c: c.country == country)
    if name == "pression":
        return build_curve(catalog, rng, quality, prefer=lambda c: c.etype == "pression")
    if name == "veto":
        return build_curve(catalog, rng, quality, prefer=lambda c: c.etype == "veto")
    if name == "sursaut":
        return build_curve(catalog, rng, quality, prefer=lambda c: c.keyword in ("sursaut", "outsider"))
    if name == "histoire":  # pre-contemporary figures, Archives/Riposte flavour
        return build_curve(catalog, rng, quality, prefer=lambda c: c.era != "contemporary")
    raise ValueError(name)


ARCHETYPES = ["courbe", "valeur_brute", "rapide", "lourd", "delegation", "compatriotes",
              "pression", "veto", "sursaut", "histoire", "aleatoire", "trop_lourd"]


# --------------------------------------------------------------------------------------------------
# Running matches


ERRORS = []


def run(deck_a, deck_b, bot_a, bot_b, rng, cfg):
    try:
        m = play_match(deck_a, deck_b, bot_a, bot_b, rng, cfg)
    except Exception as e:  # never silently: reported at the end of the run
        ERRORS.append(f"{type(e).__name__}: {e} ({[c.id for c in deck_a]} vs {[c.id for c in deck_b]})")
        if len(ERRORS) > 5:
            raise
        return run(deck_a, deck_b, bot_a, bot_b, rng, cfg)
    return m, m.result()


def pct(x):
    return f"{100 * x:.1f} %"


def ci95(p, n):
    return 1.96 * math.sqrt(max(p * (1 - p), 1e-9) / max(n, 1))


def section_skill(catalog, cfg, games, rng):
    names = ["random", "easy", "normal", "hard"]
    out = ["### Écart de niveau entre IA (decks « courbe » tirés au hasard, camps alternés)", "",
           "| Ligne vs colonne | " + " | ".join(names) + " |", "|---|" + "---|" * len(names)]
    for a in names:
        row = [a]
        for b in names:
            if a == b:
                row.append("—")
                continue
            w = n = 0
            for i in range(games):
                da, db = archetype_deck("courbe", catalog, rng, 0.5), archetype_deck("courbe", catalog, rng, 0.5)
                if i % 2:
                    _, r = run(db, da, BOTS[b](), BOTS[a](), rng, cfg)
                    r = None if r is None else 1 - r
                else:
                    _, r = run(da, db, BOTS[a](), BOTS[b](), rng, cfg)
                n += 1
                w += 1 if r == 0 else 0.5 if r is None else 0
            row.append(pct(w / n))
        out.append("| " + " | ".join(row) + " |")
    return out


def section_archetypes(catalog, cfg, games, rng, bot=GreedyBot):
    stats = defaultdict(lambda: [0.0, 0])
    matrix = defaultdict(lambda: [0.0, 0])
    for i in range(games):
        a, b = rng.choice(ARCHETYPES), rng.choice(ARCHETYPES)
        da, db = archetype_deck(a, catalog, rng), archetype_deck(b, catalog, rng)
        _, r = run(da, db, bot(), bot(), rng, cfg)
        sa = 1 if r == 0 else 0.5 if r is None else 0
        stats[a][0] += sa; stats[a][1] += 1
        stats[b][0] += 1 - sa; stats[b][1] += 1
        matrix[(a, b)][0] += sa; matrix[(a, b)][1] += 1
        matrix[(b, a)][0] += 1 - sa; matrix[(b, a)][1] += 1
    out = [f"### Taux de victoire par archétype ({games} parties, IA « {bot.name} » des deux côtés)", "",
           "| Archétype | Parties | Victoires | IC 95 % |", "|---|---|---|---|"]
    for a in sorted(ARCHETYPES, key=lambda a: -stats[a][0] / max(1, stats[a][1])):
        w, n = stats[a]
        out.append(f"| {a} | {n} | {pct(w / n)} | ± {100 * ci95(w / n, n):.1f} |")
    junk = {"aleatoire", "trop_lourd"}
    worst = max(((w / n, x) for x, (w, n) in matrix.items()
                 if n >= 60 and x[0] != x[1] and not (set(x) & junk)), default=None)
    if worst:
        (a, b) = worst[1]
        w, n = matrix[(a, b)]
        out += ["", f"Pire confrontation entre decks construits (hors aléatoire et trop lourd) : "
                    f"{a} contre {b} = {pct(w / n)} sur {n} parties."]
    return out


def section_game(catalog, cfg, games, rng, bot=GreedyBot):
    """Initiative, length, draws, comebacks, Véto usage."""
    first_wins = draws = veto_lanes = lanes = comebacks = leads = 0
    plays, cards_left, capital_spent = [], [], []
    active = revealed = 0
    decided = Counter()
    for i in range(games):
        da, db = archetype_deck(rng.choice(ARCHETYPES), catalog, rng), archetype_deck(rng.choice(ARCHETYPES), catalog, rng)
        m = engine.Match(da, db, rng, cfg)
        bots = (bot(), bot())
        lead_t4 = None
        spent = 0
        for _ in range(cfg["turns"]):
            m.start_turn()
            ps = [bots[0].plan(m, 0, rng), bots[1].plan(m, 1, rng)]
            spent += sum(c.cost for p in ps for c, _ in p)
            m.reveal(ps)
            if m.turn == 4:
                d, _ = m.standing(0)
                lead_t4 = 0 if d > 0 else 1 if d < 0 else None
        for l in range(3):
            for side in (0, 1):
                for p in m.lanes[l][side]:
                    revealed += 1
                    active += m.effect_active(p, side, l)
        r = m.result()
        if r is None:
            draws += 1
        elif r == m.first_initiative:
            first_wins += 1
        if lead_t4 is not None:
            leads += 1
            if r is not None and r != lead_t4:
                comebacks += 1
        for l in range(3):
            lanes += 1
            a, b = m.lane_power(l, 0), m.lane_power(l, 1)
            if a == b and m.lane_winner(l) is not None:
                veto_lanes += 1
        diff, margin = m.standing(0)
        decided["territoires" if diff != 0 else "puissance totale" if margin != 0 else "nul"] += 1
        plays.append(len(m.log))
        capital_spent.append(spent / 2)
        cards_left.append(sum(len(s.hand) for s in m.sides) / 2)
    decisive = games - draws
    p_first = first_wins / max(1, decisive)
    # duration model: 6 planning phases (median 14 s each, measured on the v1 board), reveal animation
    # 1.2 s per card, 3 s intro + 6 s end screen
    secs = [3 + 6 * 14 + 1.2 * p + 6 for p in plays]
    out = [f"### Déroulement ({games} parties, IA « {bot.name} », archétypes mélangés)", "",
           "| Mesure | Valeur |", "|---|---|",
           f"| Victoires du joueur qui a l'initiative au tour 1 (hors nuls) | {pct(p_first)} ± {100 * ci95(p_first, decisive):.1f} |",
           f"| Matchs nuls | {pct(draws / games)} |",
           f"| Partie décidée aux territoires / à la puissance totale / nulle | "
           f"{pct(decided['territoires'] / games)} / {pct(decided['puissance totale'] / games)} / {pct(decided['nul'] / games)} |",
           f"| Retournements (le meneur après le tour 4 perd) | {pct(comebacks / max(1, leads))} |",
           f"| Territoires gagnés au Véto | {pct(veto_lanes / lanes)} |",
           f"| Cartes dont le mot-clé est actif en fin de partie | {pct(active / revealed)} |",
           f"| Cartes jouées par joueur | {statistics.mean(plays) / 2:.1f} |",
           f"| Capital dépensé par joueur (sur 21) | {statistics.mean(capital_spent):.1f} |",
           f"| Cartes restées en main à la fin | {statistics.mean(cards_left):.1f} |",
           f"| Durée estimée (médiane) | {statistics.median(secs) / 60:.1f} min |"]
    return out


def section_cards(catalog, cfg, games, rng, quality=0.0):
    """Deck-inclusion win rate per card with uniformly random curve decks (no selection bias)."""
    seen = defaultdict(lambda: [0.0, 0])
    played = defaultdict(lambda: [0.0, 0])
    by = {k: defaultdict(lambda: [0.0, 0]) for k in ("cost", "keyword", "type", "rarity", "era", "continent")}
    for i in range(games):
        da, db = archetype_deck("courbe", catalog, rng, quality), archetype_deck("courbe", catalog, rng, quality)
        m, r = run(da, db, GreedyBot(), GreedyBot(), rng, cfg)
        if r is None:
            res = (0.5, 0.5)
        else:
            res = (1.0, 0.0) if r == 0 else (0.0, 1.0)
        on_board = [set(), set()]
        for _, side, cid, _ in m.log:
            on_board[side].add(cid)
        for side, deck in ((0, da), (1, db)):
            for c in deck:
                seen[c.id][0] += res[side]; seen[c.id][1] += 1
                if c.id in on_board[side]:
                    played[c.id][0] += res[side]; played[c.id][1] += 1
                by["cost"][c.cost][0] += res[side]; by["cost"][c.cost][1] += 1
                by["keyword"][c.keyword][0] += res[side]; by["keyword"][c.keyword][1] += 1
                by["type"][c.etype][0] += res[side]; by["type"][c.etype][1] += 1
                by["rarity"][c.rarity][0] += res[side]; by["rarity"][c.rarity][1] += 1
                by["era"][c.era][0] += res[side]; by["era"][c.era][1] += 1
                by["continent"][c.continent][0] += res[side]; by["continent"][c.continent][1] += 1
    cards = {c.id: c for c in catalog}
    wr = {cid: w / n for cid, (w, n) in seen.items() if n >= 30}
    vals = sorted(wr.values())
    sd = statistics.pstdev(vals)
    mean_n = statistics.mean(n for _, n in seen.values())
    out = [f"### Cartes ({games} parties, decks « courbe » uniformes, IA « normal ») — "
           f"{mean_n:.0f} apparitions par carte en moyenne", "",
           f"Taux de victoire quand la carte est dans le deck : écart-type {100 * sd:.1f} pts, "
           f"P5 {pct(vals[len(vals) // 20])}, P95 {pct(vals[-len(vals) // 20])}. "
           f"Bruit statistique attendu (± 1 σ) : {100 * math.sqrt(0.25 / mean_n):.1f} pts.", ""]
    for title, key in (("mot-clé", "keyword"), ("type d'effet", "type"), ("rareté", "rarity"),
                       ("ère", "era"), ("continent", "continent")):
        rows = by[key]
        order = RARITIES if key == "rarity" else sorted(rows, key=str)
        out += [f"| Par {title} | " + " | ".join(str(k) for k in order if k in rows) + " |",
                "|---|" + "---|" * sum(1 for k in order if k in rows),
                "| Victoires | " + " | ".join(pct(rows[k][0] / rows[k][1]) for k in order if k in rows) + " |", ""]
    ranked = sorted(wr.items(), key=lambda kv: kv[1])
    fmt = lambda cid: (f"| {cards[cid].label()} | {cards[cid].cost} | {cards[cid].rarity} | {cards[cid].keyword}/"
                       f"{cards[cid].etype} {cards[cid].amount or ''} | {pct(wr[cid])} |")
    out += ["Les 8 cartes les plus fortes et les 8 plus faibles :", "",
            "| Carte | Coût | Rareté | Mot-clé | Victoires |", "|---|---|---|---|---|"]
    out += [fmt(cid) for cid, _ in ranked[-8:][::-1]]
    out += ["| … | | | | |"]
    out += [fmt(cid) for cid, _ in ranked[:8]]
    outliers = [cid for cid, v in wr.items() if abs(v - 0.5) > 3 * math.sqrt(0.25 / seen[cid][1])]
    out += ["", f"Cartes hors de ± 3 σ du bruit : {len(outliers)} sur {len(wr)}"
            + (" : " + ", ".join(cards[c].label() for c in sorted(outliers, key=lambda c: -wr[c])) if outliers else ".")]
    return out


def section_collection(catalog, cfg, games, rng):
    """Does a big collection beat a small one? Best deck from N random owned cards vs best from 500."""
    out = ["### Effet de la taille de collection (deck « courbe » de qualité 0,8 tiré de la collection, IA « normal »)", "",
           "| Collection A | Collection B | Victoires de A |", "|---|---|---|"]
    for size_a, size_b in ((30, 500), (60, 500), (120, 500), (250, 500), (60, 120)):
        w = 0.0
        for i in range(games):
            ca = rng.sample(catalog, size_a)
            cb = rng.sample(catalog, size_b)
            da, db = build_curve(ca, rng, 0.8), build_curve(cb, rng, 0.8)
            if i % 2:
                _, r = run(db, da, GreedyBot(), GreedyBot(), rng, cfg)
                r = None if r is None else 1 - r
            else:
                _, r = run(da, db, GreedyBot(), GreedyBot(), rng, cfg)
            w += 1 if r == 0 else 0.5 if r is None else 0
        out.append(f"| {size_a} cartes | {size_b} cartes | {pct(w / games)} |")
    return out


def section_costs(catalog):
    by = defaultdict(list)
    for c in catalog:
        by[c.cost].append(c)
    out = [f"### Coûts obtenus (catalogue réel, {len(catalog)} cartes)", "",
           "| Coût | Cartes | Stat. max moyenne | Total moyen | Puissance moyenne au meilleur territoire* | Envergure moyenne |",
           "|---|---|---|---|---|---|"]
    for k in sorted(by):
        cs = by[k]
        out.append(f"| {k} | {len(cs)} | {statistics.mean(max(c.stats.values()) for c in cs):.1f} | "
                   f"{statistics.mean(sum(c.stats.values()) for c in cs):.1f} | "
                   f"{statistics.mean(max(c.stats.values()) + c.envergure for c in cs):.1f} | "
                   f"{statistics.mean(c.envergure for c in cs):.1f} |")
    rar = defaultdict(list)
    for c in catalog:
        rar[c.rarity].append(c.cost)
    out += ["", "*stat la plus haute + Envergure, hors capacité.", "",
            "| Rareté | " + " | ".join(RARITIES) + " |", "|---|" + "---|" * 6,
            "| Coût moyen | " + " | ".join(f"{statistics.mean(rar[r]):.2f}" for r in RARITIES) + " |"]
    return out


VARIANTS = {
    "v2.0 (retenue)": {},
    "sans Envergure": {"envergure": (0,) * 7},
    "4 cartes par territoire": {"lane_cap": 4},
    "capital = tour + 1": {"capital_bonus": 1},
    "Délégation +2, Compatriotes dès 2 cartes": {"delegation_bonus": 2, "compatriots_min": 2},
    "effets limités au territoire de leur stat (v1)": {"stat_lock": True},
    "sans contextes": {"contexts": False},
    "sans signatures": {"signatures": False},
}

def section_variants(games, seed):
    out = ["### Journal de réglage (variantes comparées, mêmes graines)", "",
           "| Variante | Cartes jouées / joueur | rapide | lourd | délégation | compatriotes | histoire | valeur brute | "
           "Écart-type cartes |", "|---|---|---|---|---|---|---|---|---|"]
    for name, over in VARIANTS.items():
        cfg = dict(CONFIG)
        cfg.update(over)
        catalog = load_catalog(config=cfg)
        rng = random.Random(seed)
        stats = defaultdict(lambda: [0.0, 0])
        plays = []
        for i in range(games):
            a, b = rng.choice(ARCHETYPES), rng.choice(ARCHETYPES)
            da, db = archetype_deck(a, catalog, rng), archetype_deck(b, catalog, rng)
            m, r = run(da, db, GreedyBot(), GreedyBot(), rng, cfg)
            plays.append(len(m.log) / 2)
            sa = 1 if r == 0 else 0.5 if r is None else 0
            stats[a][0] += sa; stats[a][1] += 1
            stats[b][0] += 1 - sa; stats[b][1] += 1
        rng2 = random.Random(seed + 1)
        seen = defaultdict(lambda: [0.0, 0])
        for i in range(games * 2):
            da, db = archetype_deck("courbe", catalog, rng2, 0), archetype_deck("courbe", catalog, rng2, 0)
            _, r = run(da, db, GreedyBot(), GreedyBot(), rng2, cfg)
            res = (0.5, 0.5) if r is None else ((1, 0) if r == 0 else (0, 1))
            for side, deck in ((0, da), (1, db)):
                for c in deck:
                    seen[c.id][0] += res[side]; seen[c.id][1] += 1
        sd = statistics.pstdev([w / n for w, n in seen.values() if n >= 10])
        g = lambda a: pct(stats[a][0] / max(1, stats[a][1]))
        out.append(f"| {name} | {statistics.mean(plays):.1f} | {g('rapide')} | {g('lourd')} | {g('delegation')} | "
                   f"{g('compatriotes')} | {g('histoire')} | {g('valeur_brute')} | {100 * sd:.1f} pts |")
    return out


def autotune(iterations, games, seed):
    """Balance patch loop: cards out of ±2 σ get their value nudged (strong -> costs more), then the
    cost curve is re-cut. Writes value_overrides.json, read by engine.load_catalog."""
    path = Path(__file__).resolve().parent / "value_overrides.json"
    overrides = json.loads(path.read_text()) if path.exists() else {}
    for it in range(iterations):
        catalog = load_catalog()
        rng = random.Random(seed + it)
        seen = defaultdict(lambda: [0.0, 0])
        for _ in range(games):
            da, db = archetype_deck("courbe", catalog, rng, 0), archetype_deck("courbe", catalog, rng, 0)
            _, r = run(da, db, GreedyBot(), GreedyBot(), rng, CONFIG)
            res = (0.5, 0.5) if r is None else ((1, 0) if r == 0 else (0, 1))
            for side, deck in ((0, da), (1, db)):
                for c in deck:
                    seen[c.id][0] += res[side]; seen[c.id][1] += 1
        moved = 0
        for cid, (w, n) in seen.items():
            wr = w / n
            if abs(wr - 0.5) > 2 * math.sqrt(0.25 / n):
                overrides[cid] = round(max(-2.5, min(2.5, overrides.get(cid, 0.0) + (wr - 0.5) * 12)), 2)
                moved += 1
        path.write_text(json.dumps(dict(sorted(overrides.items())), indent=1) + "\n")
        sd = statistics.pstdev([w / n for w, n in seen.values()])
        print(f"iteration {it + 1}: {moved} cards nudged, card win-rate sd {100 * sd:.2f} pts", flush=True)


def export(path):
    """Duel profile of every card (cost, keyword, signature...), loaded by the API with the catalog."""
    catalog = load_catalog()
    rows = []
    for c in sorted(catalog, key=lambda c: c.id):
        row = {"id": c.id, "cost": c.cost, "envergure": c.envergure, "keyword": c.keyword,
               "effect": c.etype, "stat": c.estat, "amount": c.amount, "param": c.kvalue, "signature": c.signature}
        if c.keyword == "tempo":
            row["turns"] = sorted(engine.tempo_turns(int(c.kvalue), c.cost))
        rows.append(row)
    rules = {k: v for k, v in CONFIG.items()}
    Path(path).write_text(json.dumps({"rules": rules, "cards": rows}, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {path} ({len(rows)} cards)")


def golden(path, seed):
    """A few fully logged matches for the Java engine parity test (same seed => same log)."""
    catalog = load_catalog()
    matches = []
    for k in range(5):
        rng = random.Random(seed + k)
        da, db = archetype_deck("courbe", catalog, rng), archetype_deck("delegation", catalog, rng)
        m, r = run(da, db, HardBot(), HardBot(), rng, CONFIG)
        matches.append({
            "seed": seed + k,
            "territories": [{"domain": t.domain, "context": t.context} for t in m.territories],
            "drawOrderA": m.sides[0].initial_order, "drawOrderB": m.sides[1].initial_order,
            "firstInitiative": m.first_initiative,
            "plays": [{"turn": t, "side": s, "card": cid, "lane": l} for t, s, cid, l in m.log],
            "lanePower": [[m.lane_power(l, 0), m.lane_power(l, 1)] for l in range(3)],
            "winner": r,
        })
    Path(path).write_text(json.dumps({"costs": {c.id: c.cost for c in catalog}, "matches": matches}, indent=1))
    print(f"wrote {path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=0, help="override sample size of every section")
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--section", choices=["costs", "skill", "archetypes", "game", "cards", "collection"])
    ap.add_argument("--variants", action="store_true")
    ap.add_argument("--golden")
    ap.add_argument("--export", metavar="PATH", help="write the per-card duel profiles (JSON)")
    ap.add_argument("--autotune", type=int, metavar="ITERATIONS")
    args = ap.parse_args()
    if args.autotune:
        return autotune(args.autotune, args.games or 20000, args.seed)
    if args.export:
        return export(args.export)
    if args.golden:
        return golden(args.golden, args.seed)
    scale = 0.15 if args.quick else 1.0
    n = lambda default: args.games or max(200, int(default * scale))
    if args.variants:
        print("\n".join(section_variants(n(3000), args.seed)))
        return
    catalog = load_catalog()
    rng = random.Random(args.seed)
    t0 = time.time()
    sections = {
        "costs": lambda: section_costs(catalog),
        "skill": lambda: section_skill(catalog, CONFIG, n(300), rng),
        "archetypes": lambda: section_archetypes(catalog, CONFIG, n(12000), rng)
        + [""] + section_archetypes(catalog, CONFIG, n(1500), rng, HardBot),
        "game": lambda: section_game(catalog, CONFIG, n(6000), rng)
        + [""] + section_game(catalog, CONFIG, n(800), rng, HardBot),
        "cards": lambda: section_cards(catalog, CONFIG, n(40000), rng),
        "collection": lambda: section_collection(catalog, CONFIG, n(1500), rng),
    }
    for key, fn in sections.items():
        if args.section and key != args.section:
            continue
        print("\n".join(fn()))
        print()
        sys.stdout.flush()
    if ERRORS:
        print(f"**{len(ERRORS)} partie(s) rejouée(s) après une erreur du moteur :**")
        print("\n".join("- " + e for e in ERRORS))
    version = json.loads((Path(__file__).resolve().parents[2] / "data" / "cards.season1.json").read_text())["version"]
    print(f"_({time.time() - t0:.0f} s, graine {args.seed}, catalogue {version})_")


if __name__ == "__main__":
    main()
