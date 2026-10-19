# Card content guidelines (season 1)

One file per card: `data/content/<wikidataId>.json`, following `TEMPLATE.json`, plus the `effect` below.
The build validates every file (`npm run build -- all` in `scripts/build-cards`).

## Text

- **bio** (fr + en): 2 to 3 factual sentences, 80–600 characters each. Written originally — never copy or
  closely paraphrase Wikipedia. Dates and numbers must be accurate; when unsure, stay general rather than invent.
  Neutral tone: no praise, no mockery, no opinion on living people's current politics.
- **Sensitive cards** (`sensitive: true`): the bio states the crimes explicitly with events and orders of
  magnitude (e.g. "the Holocaust, the murder of six million Jews"), no heroic framing, no extremist symbols or slogans.
- French: correct typography (apostrophe ’ or ', non-breaking spaces are not required), "av. J.-C." for BC dates.
  English: "BC"/"AD".
- **role** (fr + en): always write it. The country or polity must appear ("Président de l'Afrique du Sud",
  "Pharaon d'Égypte", "Consul de la République romaine", "Empereur du Brésil"). Pick the office the person is
  famous for, not a minor one. No "Président ou présidente" forms: use the person's gender.
- **name** (optional override, fr + en): only to fix a bad label (vandalism, odd ordering, long noble titles).
  Use the common name ("Wellington" → "Duc de Wellington" / "Duke of Wellington", "Lee Kuan Yew").

## Stats

Four integers 1–10: `influence`, `diplomacy`, `charisma`, `strategy`. Their **sum must equal the card's
`statTotal`** from your batch file (precomputed from a hash, independent of rarity, so famous ≠ strong).
Distribute that budget according to the figure's profile (a negotiator gets diplomacy, a general strategy…).
Sensitive cards: no stat above 8 (their budget is already capped).

## Ability

`name` (≤ 40 chars) and `description` (≤ 220 chars) in fr + en, flavored after the person, plus a
machine-readable `effect` used by the duel engine (best of 3 rounds; each round draws a domain = one stat;
the higher value wins):

```json
"effect": {
  "type": "bonus",            // "bonus" (own card +amount) | "malus" (opposing card -amount) | "tieBreaker" (wins ties)
  "stat": "diplomacy",        // "influence" | "diplomacy" | "charisma" | "strategy" | "any" (= the round's domain); omit for tieBreaker
  "amount": 2,                // 1–3; omit for tieBreaker
  "condition": { "kind": "opponentContinent", "value": "same" }
}
```

Conditions (`kind` → `value`):
- `always` (no value) — amount must be 1
- `opponentContinent` → `same` | `different`
- `opponentEra` → `antiquity` | `medieval` | `modern` | `contemporary`
- `roundDomain` → a stat key (applies only when that domain is drawn)
- `round` → `1` | `2` | `3`
- `behind` (no value) — when this player has lost more rounds
- `opponentRarityHigher` (no value)

Balance: rarer conditions allow bigger amounts (always = 1, common conditions = 1–2, narrow ones = 2–3).
The description must say exactly what the effect does, e.g. "+2 en Diplomatie si la carte adverse vient du même continent."
Vary effects across a batch; don't give every card the same one.
