# MANDAT mobile

Expo SDK 58 app (expo-router, TypeScript strict), run as an EAS **development build**
(`expo-dev-client`). Expo Go is not supported: the app uses native modules it does not ship (MMKV).

## First setup

1. `npm install`
2. Copy `.env.example` to `.env`. By default the app talks to the production API
   (`https://mandat.cyber-dodo.fr`). To hit a local API from the phone, set
   `EXPO_PUBLIC_API_URL` to your PC's **LAN IP** (`hostname -I`), e.g. `http://192.168.1.42:8080`.
3. Link the project to EAS once: `npm exec -- eas-cli@latest init`, then put the printed id in

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

## Push notifications

Server pushes go through the Expo push service (no Firebase SDK in the app).

- **iOS**: nothing to code. Let EAS manage the credentials (`eas credentials` → iOS → *Push
  Notifications: Manage your Apple Push Notifications Key*, or accept when `eas build` offers to
  create the push key). The `expo-notifications` plugin adds the `aps-environment: production`
  entitlement (TestFlight and App Store builds). **Rebuild** after enabling it.
- **Android**: upload an FCM V1 service account key with `eas credentials` → Android (only when an
  Android build ships).
- **API**: works without configuration. Set `MANDAT_EXPO_ACCESS_TOKEN` only if "Enhanced push
  security" is enabled for the project on expo.dev. `MANDAT_PUSH_ENABLED=false` mutes every send.
- The app registers the device after the player allows notifications (never on first launch),
  refreshes the token on start and when Expo rotates it, and unregisters it on sign out or when
  notifications are turned off in Settings. Per-category toggles (booster, streak, friends,
  rewards, marketing — off by default) sit under the notifications switch.
- Local reminders (booster ready, streak at risk) remain as an offline fallback and are cancelled
  as soon as the device is registered for server pushes, so nothing arrives twice.

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
