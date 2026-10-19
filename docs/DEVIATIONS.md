# Deviations from the original brief

Every place where the implementation knowingly differs from the original MANDAT brief.
Review this file before the first public release.

## Resolved: Expo Go period (2026-10-19)

The app briefly ran in a custom Expo Go (`eas go`) and needed compromises (expo-sqlite instead of MMKV,
pinned Reanimated/Worklets). That Expo Go binary was an early SDK 58 build whose native libraries
(Skia 2.11, Screens 4.28, RN 0.88.0-rc.1…) did not match the published SDK 58 packages, and froze the app.
Everything was reverted: the project now uses an EAS **development build** (`expo-dev-client`) as the
brief specifies, MMKV is back, and all SDK 58 versions are the official ones.

Rule: do not target Expo Go again; native libraries are fine as long as they are added through `expo install`
(then rebuild the dev client).

## Permanent (validated or technical)

- **Continent quotas**: Africa, Asia, Europe, North America, South America ≥ 15% each, Oceania ≥ 3%
  (the brief's 15% for every inhabited continent was mathematically impossible). Quotas only drive
  the selection of the 500 figures; rarity stays strictly rank-based.
- **Fame score** (user decision 2026-10-19): the brief's 24-month window and 70/30 weights made the mythic tier
  mostly current US politicians. Now: English Wikipedia pageviews over the full API history (2015-07 →),
  `fameScore = 0.4·log10(pageviews) + 0.6·log10(sitelinks)`, plus per-rarity country caps (max 2 mythic and
  6 legendary per country, max 20% of any other tier; overflow is pushed to the next tier).
- **First booster** (onboarding): server-side composition rules in `data/firstPackRules.json` — 1 epic+,
  2 rare/uncommon, 2 common, 5 distinct continents, ≥ 3 eras, never sensitive.
- **Card finishes** (user request 2026-10-19, not in the brief): each drawn card gets a finish rolled server-side —
  `holo` 8% (any rarity), `full_art` 3% (rare+, slot 5), `gold` 0.3% (any), else `standard`. The collection
  counts card + finish pairs; odds screens show finish odds. Legendary/mythic get a premium animated frame in every finish.
- **Real portraits** (user decision 2026-10-19; the brief asked for procedural visuals in v1): cards show the
  Wikimedia Commons image of the person (Wikidata P18), bundled in the app as WebP (`mobile/assets/portraits/`,
  ~20 MB, offline). License, author and source of each photo are in `data/portraits.manifest.json` and shown in
  Settings → Photo credits and on the card detail screen (required by CC BY / CC BY-SA). Cards without a photo keep
  the procedural artwork. Sensitive figures are displayed desaturated and muted (no color, no foil glamour).
  Regenerate with `npm run build -- portraits` then `portraits-web` (scripts/build-cards) and `npm run sync:cards` (mobile).
- **Sensitive figures** keep their rarity but are never "Figure of the day" and never used in onboarding.
- **Body font**: Figtree instead of Inter (the brief only suggested Inter; the project design rules exclude it).
  Titles stay in Bricolage Grotesque.
- **Monorepo**: `mobile/` keeps its own `node_modules` instead of npm workspaces, to avoid Expo/Metro
  hoisting issues. The root `package.json` only holds shortcut scripts.
- **API build**: Gradle (Kotlin DSL) instead of an unspecified build tool; JDK 25 is provisioned by the toolchain.
- **openapi-typescript** runs through `npm exec` (not a devDependency) because it does not yet accept TypeScript 6.
