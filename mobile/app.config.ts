import type { ExpoConfig } from 'expo/config';

import { APP_NAME, APP_SCHEME, APP_SLUG, BUNDLE_ID } from './src/constants/app.ts';

const SPLASH_BACKGROUND = '#0A0D14';

/** Dev-client builds install next to the release app under their own bundle id. */
const IS_DEV_VARIANT = process.env.APP_VARIANT === 'development';
const bundleId = IS_DEV_VARIANT ? `${BUNDLE_ID}.dev` : BUNDLE_ID;

/** Google sign-in on iOS redirects to the reversed client id, which must be a registered URL scheme. */
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleIosScheme = googleIosClientId ? googleIosClientId.split('.').reverse().join('.') : null;

const config: ExpoConfig = {
  name: IS_DEV_VARIANT ? `${APP_NAME} Dev` : APP_NAME,
  slug: APP_SLUG,
  scheme: IS_DEV_VARIANT ? `${APP_SCHEME}-dev` : APP_SCHEME,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: SPLASH_BACKGROUND,
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    usesAppleSignIn: true,
    ...(googleIosScheme ? { infoPlist: { CFBundleURLTypes: [{ CFBundleURLSchemes: [googleIosScheme] }] } } : {}),
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      backgroundColor: SPLASH_BACKGROUND,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  owner: 'dodolereporter',
  extra: {
    eas: { projectId: '9c376721-0de1-493c-b62a-86922eb1490f' },
  },
  plugins: [
    ['expo-sensors', { motionPermission: 'MANDAT uses motion to tilt cards and boosters.' }],
    'expo-router',
    'expo-dev-client',
    'expo-audio',
    'expo-image',
    'expo-font',
    'expo-localization',
    'expo-secure-store',
    'expo-apple-authentication',
    'expo-web-browser',
    'expo-notifications',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: SPLASH_BACKGROUND,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
