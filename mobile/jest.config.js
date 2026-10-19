/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Web implementations of Reanimated and Worklets in Jest (see jest.resolver.js).
  resolver: '<rootDir>/jest.resolver.js',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(wav|mp3)$': '<rootDir>/jest.assetStub.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
