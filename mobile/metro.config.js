// Sentry's Metro config adds the Debug IDs that tie uploaded source maps to the bundle;
// it wraps Expo's default config unchanged.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
