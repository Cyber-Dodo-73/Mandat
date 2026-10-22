import type { ExpoConfig } from 'expo/config';

import { APP_NAME, APP_SCHEME, APP_SLUG, BUNDLE_ID } from './src/constants/app.ts';

const SPLASH_BACKGROUND = '#0A0D14';

/** Dev-client builds install next to the release app under their own bundle id. */
const IS_DEV_VARIANT = process.env.APP_VARIANT === 'development';
const bundleId = IS_DEV_VARIANT ? `${BUNDLE_ID}.dev` : BUNDLE_ID;

/** Google sign-in on iOS redirects to the reversed client id, which must be a registered URL scheme. */
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleIosScheme = googleIosClientId ? googleIosClientId.split('.').reverse().join('.') : null;

/**
 * Sentry source-map and debug-symbol upload at build time. Only wired when the Sentry project is
 * named (EAS env SENTRY_ORG, SENTRY_PROJECT, plus the SENTRY_AUTH_TOKEN secret): without them the
 * upload step would fail release builds. Runtime reporting only needs EXPO_PUBLIC_SENTRY_DSN.
 */
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const sentryPlugin: NonNullable<ExpoConfig['plugins']> =
  sentryOrg && sentryProject
    ? [['@sentry/react-native/expo', { organization: sentryOrg, project: sentryProject, url: 'https://sentry.io/' }]]
    : [];

/** Data the app collects, all linked to the account and used for app functionality only; no tracking. */
const collected = (type: string) => ({
  NSPrivacyCollectedDataType: type,
  NSPrivacyCollectedDataTypeLinked: true,
  NSPrivacyCollectedDataTypeTracking: false,
  NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
});

const config: ExpoConfig = {
  name: IS_DEV_VARIANT ? `${APP_NAME} Dev` : APP_NAME,
  slug: APP_SLUG,
  scheme: IS_DEV_VARIANT ? `${APP_SCHEME}-dev` : APP_SCHEME,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: SPLASH_BACKGROUND,
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    usesAppleSignIn: true,
    // Required-reason APIs used by React Native and the Expo modules in this app (their own
    // PrivacyInfo.xcprivacy files): UserDefaults, file timestamps, boot time, disk space.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
      ],
      NSPrivacyCollectedDataTypes: [
        collected('NSPrivacyCollectedDataTypeEmailAddress'),
        collected('NSPrivacyCollectedDataTypeUserID'),
        collected('NSPrivacyCollectedDataTypeGameplayContent'),
        // Expo push token.
        collected('NSPrivacyCollectedDataTypeDeviceID'),
      ],
    },
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
    // The dev launcher only belongs to development builds; release builds leave it out.
    ...(IS_DEV_VARIANT ? ['expo-dev-client'] : []),
    ...sentryPlugin,
    'expo-audio',
    'expo-image',
    'expo-font',
    'expo-localization',
    'expo-secure-store',
    'expo-apple-authentication',
    'expo-web-browser',
    [
      'expo-notifications',
      {
        // Android status-bar icon: white silhouette on transparent, tinted with the brand gold.
        icon: './assets/android-icon-monochrome.png',
        color: '#C9A227',
        // TestFlight and App Store builds (both EAS profiles use store distribution) talk to the
        // production APNs environment.
        mode: 'production',
      },
    ],
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
