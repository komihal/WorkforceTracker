# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WorkforceTracker is a React Native mobile app (0.80.2) for workforce time tracking. Workers punch in/out of shifts with photos, the app tracks geolocation in the background, and data syncs to a REST API at `api.tabelshik.com`. The UI language is Russian.

## Common Commands

```bash
# Install dependencies
npm install

# Run
npm run android
npm run ios
npm start              # Metro bundler

# Lint
npx eslint .

# Tests (Jest, preset: react-native)
npm test               # run all unit tests
npx jest __tests__/authService.test.js   # single test file
npx jest --watch       # watch mode
npm run test:coverage  # with coverage report
npm run test:ci        # CI mode (no watch, with coverage)

# E2E (Detox, Android emulator Pixel_4_API_30)
npm run test:e2e:build
npm run test:e2e

# iOS release prep
npm run prepare:ios    # runs scripts/prepare_ios_release.sh
```

## Architecture

### Entry Point
`index.js` → registers `App.js` and imports the headless background task (`src/bg/headless.js`).

`App.js` manages three screens via state (`currentScreen`): `LoginScreen`, `MainScreen`, `StatsScreen`. No navigation library — screen switching is done with a simple state machine. Background geolocation (`initBgGeo`) is initialized on app boot if a user is already authenticated.

### Key Layers

- **`src/services/`** — Business logic and API calls. Each service is a singleton module (not a class). Key services: `authService` (login/session via AsyncStorage), `punchService` (shift punch in/out), `geoService` (geo data persistence), `shiftStatusService` (shift state polling), `backgroundService` (photo-only background fetch), `cameraService`, `fileUploadService`, `permissionsService`.

- **`src/bg/`** — Background processing. `trackingController.js` wraps `react-native-background-geolocation` start/stop. `headless.js` is the headless JS task registered for background HTTP.

- **`src/location.js`** — Central background geolocation module (`initBgGeo`, `startTracking`, `getLicenseInfo`). Configures `react-native-background-geolocation` with license key, server upload URL, and event handlers.

- **`src/store/shiftStore.js`** — Lightweight reactive store using `useSyncExternalStore`. Holds shift active state, caches shift status, persists to AsyncStorage with 10-min TTL. Used across components via `useShiftStore(selector)`.

- **`src/hooks/`** — Custom hooks: `useShiftManager` (shift punch operations), `useIndicators` (status indicators), `useMonthlyStats`.

- **`src/config/`** — `api.js` (API base URL, endpoints, webhook config), `geoConfig.js` / `geoEndpointConfig.js` (background geo settings). Config values come from `react-native-config` (`.env` file).

- **`src/components/`** — Screen components. Styles are co-located in `.styles.js` files (e.g., `MainScreen.styles.js`).

- **`src/ui/`** — UI utilities (`alert.js` — guarded Alert wrapper).

### Environment Configuration
Copy `env.template` to `.env`. Key vars: `API_URL`, `API_TOKEN`, `BG_GEO_LICENSE_ANDROID`, `BG_WEBHOOK_URL`. Config is read via `react-native-config`.

### API Integration
All API calls go through axios. Endpoints are defined in `src/config/api.js`. Authentication uses Bearer token from env. Geo data and photos upload via webhook/multipart endpoints.

## Testing

- Unit tests live in `__tests__/` (flat structure, named `<module>.test.js`)
- E2E tests live in `e2e/` (Detox)
- `__tests__/helpers/` and `__tests__/manual/` are excluded from test runs
- `jest.setup.js` mocks `AsyncStorage` globally
- Coverage thresholds: branches 18%, functions 35%, lines 25%, statements 24%

## Code Style

- ESLint extends `@react-native`
- Prettier: single quotes, trailing commas, no parens on single arrow params
- UI buttons must use `react-native-paper` components (`Button`, `FAB`, `IconButton`) — not plain `TouchableOpacity`
- Color palette: primary `#007AFF`, secondary `#FF9800`, success `#4CAF50`, error `#F44336`, warning `#FFC107`
- Always add `accessibilityLabel` to interactive elements
- Always add `testID` to elements that need test targeting
- Use `useCallback` for button press handlers
