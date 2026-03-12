module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // Unit tests — Jest globals
      files: ['__tests__/**/*.js', 'jest.setup.js'],
      env: {
        jest: true,
      },
      globals: {
        AbortSignal: 'readonly',
      },
    },
    {
      // E2E tests — Detox globals + Jest
      files: ['e2e/**/*.js'],
      env: {
        jest: true,
      },
      globals: {
        device: 'readonly',
        element: 'readonly',
        by: 'readonly',
        waitFor: 'readonly',
        expect: 'readonly',
      },
    },
  ],
};
