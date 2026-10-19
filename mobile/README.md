# MANDAT mobile

Expo SDK 58 app (expo-router, TypeScript strict), run as an EAS **development build**
(`expo-dev-client`). Expo Go is not supported: the app uses native modules it does not ship (MMKV).

## First setup

1. `npm install`
2. Copy `.env.example` to `.env`. By default the app talks to the production API
   (`https://mandat.cyber-dodo.fr`). To hit a local API from the phone, set
   `EXPO_PUBLIC_API_URL` to your PC's **LAN IP** (`hostname -I`), e.g. `http://192.168.1.42:8080`.
3. Link the project to EAS once: `npm exec -- eas-cli@latest init`, then put the printed id in
   `EAS_PROJECT_ID` (the config is dynamic, so `eas init` cannot write it itself).
4. Build and install the dev client on the iPhone (cloud build, no Mac needed):
   `npm exec -- eas-cli@latest build --profile development --platform ios`, then
   `npm exec -- eas-cli@latest submit --profile development --platform ios` and install it from TestFlight.
   The dev variant is "MANDAT Dev" (`fr.cyberdodo.mandat.dev`), next to the release app.

## Daily development

`npm start`, then open the project from the dev client (scan the QR code with the Camera).
JavaScript changes reload instantly. Rebuild the dev client only after adding a native library
(`npm exec -- expo install <package>`).

After changing `.env`, restart with `npm start -- --clear`.

## Sign in

- **Email / password** works out of the box.
- **Sign in with Apple** (iOS): the App ID needs the "Sign in with Apple" capability. EAS enables it
  from `ios.usesAppleSignIn` when it manages the credentials. The API accepts the bundle ids listed
  in `MANDAT_APPLE_CLIENT_IDS` (add `fr.cyberdodo.mandat.dev` for the dev build).
- **Google**: create OAuth client ids in Google Cloud and set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
  (and the Android/web ones if needed). The iOS URL scheme is derived from it at build time, so
  **rebuild the dev client** after setting it. Add the same ids to the API's `MANDAT_GOOGLE_CLIENT_IDS`.
  The Google button is hidden while no client id is configured.

## Scripts

| Script | Purpose |
|---|---|
| `npm start` | Dev server for the development build |
| `npm run start:tunnel` | Same, through a tunnel when phone and PC are not on the same network |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (expo config) |
| `npm test` | Jest |
| `npm run check:i18n` | Fails if FR and EN keys differ |
| `npm run api:gen` | Regenerates the typed API client from `../api/openapi.json` |
| `npm run sync:cards` | Copies `../data/cards.season1.json` into the app |
