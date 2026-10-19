# build-cards

Builds the Season 1 catalog (`data/cards.season1.json`) from Wikidata and Wikipedia pageviews.

```bash
cd scripts/build-cards
npm install
npm run build -- all --allow-missing-content   # build + report, placeholders for missing content
npm run build -- build                          # strict: fails if any card lacks data/content/<QID>.json
npm run build -- report                         # distribution, top 40, sensitive cards
npm test
```

Every HTTP response is cached in `.cache/` (gitignored), so reruns are offline and deterministic.
`--refetch` rebuilds the raw candidate list from the (cached) Wikidata queries; delete `.cache/`
to download everything again. `--as-of YYYY-MM-DD` pins the end of the pageview window.

## Steps

1. **Candidates** (`src/wikidata.ts`): humans surfaced by category queries (positions under
   head of state / head of government / monarch, and occupations: politician, statesperson,
   revolutionary, civil rights advocate, human rights activist, political activist, freedom
   fighter, diplomat, monarch), each with a minimum sitelink count to bound the query.
2. **Scope** (`src/politics.ts`, `data/exclusions.json`): drops people whose occupations are
   non-political (painter, poet, physicist, actor…) unless they show a strong political
   signal: the revolutionary category (activist categories are also given to artists such as
   John Lennon, so they don't count), a
   sovereign-level position while in a leadership category (Charles III, Churchill, Reagan), or
   a notable (≥ 30 sitelinks) sovereign-level position otherwise (Julius Caesar as consul).
   Wikidata occupations are noisy (Caesar is tagged "poet"), hence the signals. Local offices
   (a small-town mayor, a seat in a legislature) don't keep a novelist or an actor in.
   Religious offices (popes, Dalai Lama, Rashidun caliphs) and founders of religions are out
   of scope, as are explorers, conquistadors, drug lords and criminals without a notable
   sovereign office.
3. **Place** (`src/geo.ts`, `data/historic-states.json`): one country per person, by weighted
   vote (citizenships ×2, jurisdiction of their most notable position ×1.5, birth country ×1).
   Historic states resolve through the manual table first, then their own ISO code, their
   containing country, or the modern country of their capital(s). Continents follow the UN M49
   geoscheme (Russia → Europe, Türkiye → Asia, Egypt → Africa, Central America → North America).
4. **Era** (`src/era.ts`): from birth year: < 450 antiquity, < 1450 medieval, < 1860 modern,
   then contemporary (people born from 1860 were active in the 20th century).
5. **Fame** (`src/score.ts`, weights and window in `src/config.ts`):
   `0.4·log10(pageviews) + 0.6·log10(sitelinks)`, with human (`agent=user`) English Wikipedia
   views from July 2015 (the first month the per-article API serves) to the last full month.
   Validated change from the brief's 0.7 / 0.3 over 24 months, which ranked recent news
   figures above historical ones. log10 of 0 is taken as 0. Scores are min-max normalized to
   0–100 over the whole pool, a monotonic transform that never changes the ranking.
6. **Selection** (`src/select.ts`): the top-N of each continent per quota (Africa, Asia,
   Europe, North America, South America ≥ 75; Oceania ≥ 15), then the remaining slots by pure
   merit. Rarity is then assigned by fame rank among the 500 selected cards (10 / 30 / 60 /
   100 / 120 / 180), with per-tier country caps applied top tier down: at most 2 mythic and 6
   legendary cards from one country, at most 20 % of the tier for the other rarities. A card
   over the cap is pushed to the next tier, keeping its rank order, and can cascade further;
   the last tier (common) takes everyone left. Collector numbers follow rarity, then fame rank.
   No manual exceptions: every push is mechanical and listed in the report.
7. **Content** (`src/content.ts`, `data/content/<QID>.json`, see `TEMPLATE.json`): bios,
   stats and abilities are written by hand, keyed by Wikidata ID so they survive re-ranking.
   Validation: 2–3 sentences per bio and language, stats integers 1–10, sensitive cards capped
   at 8 per stat and below the best regular card, and no correlation between rarity and stat
   totals (|Spearman ρ| ≤ 0.3). Optional `name` / `role` override the Wikidata labels.
8. **Sensitive** (`data/sensitive.json`): perpetrators of genocide, crimes against humanity or
   major war crimes, convicted by an international or national tribunal, or dead and
   identified as such by historical consensus. The flag never affects rarity.

9. **Onboarding pack** (`src/firstPack.ts` → `data/firstPackRules.json`): 1 card epic or
   better, 2 rare/uncommon, 2 common, 5 distinct continents, ≥ 3 distinct eras, never
   sensitive. The API draws it server-side. The build fails if the catalog cannot satisfy it.

## Outputs

- `data/candidates.season1.json`: the full ranked pool with scores and dropped people with
  their reason, for audit.
- `data/firstPackRules.json`: the onboarding pack rules consumed by the API.
- `data/cards.season1.json`: `{ season, version, cards }` where `version` is a content hash
  used by the API seed and the app to detect catalog changes.
