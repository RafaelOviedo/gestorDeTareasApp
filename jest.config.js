module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'App.tsx',
    'src/**/*.{ts,tsx}',
    '!src/types/**',
    '!src/styles.ts',
  ],
  coverageReporters: ['text', 'html', 'json-summary', 'lcov'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@notifee/react-native|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-file-access)/)',
  ],
};
