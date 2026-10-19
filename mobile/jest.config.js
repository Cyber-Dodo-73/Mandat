/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Resolves the web implementations of Reanimated and Worklets in Jest.
  resolver: 'react-native-reanimated/jest/resolver',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(wav|mp3)$': '<rootDir>/jest.assetStub.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
