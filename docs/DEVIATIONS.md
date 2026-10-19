# Deviations from the original brief

Every place where the implementation knowingly differs from the original MANDAT brief.
Review this file before the first public release.

## Temporary: Expo Go compatibility (revert before the first release)

During development the app runs in a custom Expo Go installed through TestFlight (`eas go`),
because the dev machine is Linux (no Xcode) and testing happens on an iPhone.
Expo Go only ships its own bundled native modules, so the brief's dev-client setup was relaxed.

| # | Brief | Current (Expo Go) | To restore for release |
|---|---|---|---|
| 1 | `react-native-mmkv` for fast local persistence | `expo-sqlite/kv-store` behind `mobile/src/lib/storage.ts` | Reinstall `react-native-mmkv`, swap the implementation inside `storage.ts` only (same `getItem`/`setItem`/`removeItem` interface). The React Query persister must keep going through `storage.ts`. |
| 2 | `expo-dev-client` dev build as the default workflow | `npm start` runs `expo start --go` | Make `npm start` run `expo start --dev-client`; build with `eas build --profile development` / `production`. |
| 3 | Sign in with Google (native) | Phase 3 must use a flow that works in Expo Go | Switch to the native Google Sign-In module in the dev/production build. Sign in with Apple (`expo-apple-authentication`) is unaffected. |
| 4 | Notifications | Local notifications only (remote push is not available in Expo Go) | v1 only needs local notifications; nothing to restore unless remote push is added. |
| 5 | Reanimated / Worklets at the SDK versions (4.7.1 / 0.13.0) | Pinned to `react-native-reanimated@4.6.0` + `react-native-worklets@0.12.2`, the native versions compiled into the Expo Go 58.0.4 binary that `eas go` repackages. Kept by `expo.install.exclude` and peer `overrides` in `mobile/package.json`; `mobile/jest.resolver.js` ports the Jest resolver those versions lack | Remove the pins, overrides, `install.exclude` and `jest.resolver.js`; `npx expo install --fix`; set `resolver: 'react-native-reanimated/jest/resolver'` back in `jest.config.js`. |

Rule for all future phases: any native library that Expo Go does not bundle must not be added
without an Expo Go-compatible fallback, and must be listed in this table.

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
- **Sensitive figures** keep their rarity but are never "Figure of the day" and never used in onboarding.
- **Body font**: Figtree instead of Inter (the brief only suggested Inter; the project design rules exclude it).
  Titles stay in Bricolage Grotesque.
- **Monorepo**: `mobile/` keeps its own `node_modules` instead of npm workspaces, to avoid Expo/Metro
  hoisting issues. The root `package.json` only holds shortcut scripts.
- **API build**: Gradle (Kotlin DSL) instead of an unspecified build tool; JDK 25 is provisioned by the toolchain.
- **openapi-typescript** runs through `npm exec` (not a devDependency) because it does not yet accept TypeScript 6.
