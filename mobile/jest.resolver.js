// Port of the Jest resolvers shipped by Reanimated 4.7 / Worklets 0.13, which the
// Expo Go-pinned Reanimated 4.6 / Worklets 0.12 lack: resolve their web implementations.
// Remove this file (and use 'react-native-reanimated/jest/resolver') once the pins are lifted.
const WEB_ONLY_IN_JEST = new Set([
  'initializers',
  'mutables',
  'mappers',
  'ConfigHelper',
  'UpdateLayoutAnimations',
  'useAnimatedRef',
  'useAnimatedStyle',
  'WorkletEventHandler',
  'JSPropsUpdater',
  'updateProps',
  'util',
  'css/component/AnimatedComponent',
]);

const withoutNativeExtensions = (options) => ({
  ...options,
  extensions: options.extensions?.filter((ext) => !ext.includes('native')),
});

/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) => {
  const basename = request.split('/').pop();
  const isWebOnly = [...WEB_ONLY_IN_JEST].some((entry) =>
    entry.includes('/') ? request.endsWith(entry) : basename === entry,
  );
  if (request.startsWith('.') && isWebOnly && options.basedir.includes('react-native-reanimated')) {
    return options.defaultResolver(request, withoutNativeExtensions(options));
  }
  if (options.basedir.includes('react-native-worklets') || request.includes('react-native-worklets')) {
    return options.defaultResolver(request, withoutNativeExtensions(options));
  }
  return options.defaultResolver(request, options);
};
