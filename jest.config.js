module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-community|react-native-vector-icons)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/', '<rootDir>/__tests__/helpers/', '<rootDir>/__tests__/manual/'],
  globals: {
    jest: true,
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.js',
    '!src/bggeo-demoapp/**',
    '!src/examples/**',
    '!src/location-backup.js',
    '!src/**/*.styles.{js,ts}',
  ],
  coverageReporters: ['text', 'text-summary', 'lcov', 'clover'],
  coverageThreshold: {
    global: {
      branches: 18,
      functions: 35,
      lines: 25,
      statements: 25,
    },
  },
};
