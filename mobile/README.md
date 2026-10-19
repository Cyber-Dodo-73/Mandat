# MANDAT mobile

Expo SDK 58 app (expo-router, TypeScript strict). Every dependency is bundled in
Expo Go, so no native build is needed during development.

## Run on iPhone with Expo Go

1. Install **Expo Go** from the App Store (it must support SDK 58).
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to your PC's
   **LAN IP**, e.g. `http://192.168.1.42:8080` (find it with `ip -4 addr` or `hostname -I`).
   `localhost` points to the phone itself and will not reach the API.
4. Start the dev server: `npm start` (runs `expo start --go`).
5. Scan the QR code with the iPhone **Camera** app; it opens in Expo Go.

The phone and the PC must be on the **same Wi-Fi**. If that is not possible
(guest network, client isolation, VPN), use `npm run start:tunnel` instead.
With a tunnel, the API still has to be reachable from the phone (same network
or a public URL).

After changing `.env`, restart with `npm start -- --clear`.

## Development build (later)

`expo-dev-client` stays installed so the app can move to a development build
without changes: `npm run start:dev-client` with `npx expo run:android|ios` or EAS.

## Scripts

| Script | Purpose |
|---|---|
| `npm start` | Dev server for Expo Go |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (expo config) |
| `npm test` | Jest |
| `npm run check:i18n` | Fails if FR and EN keys differ |
| `npm run api:gen` | Regenerates the typed API client from `../api/openapi.json` |
