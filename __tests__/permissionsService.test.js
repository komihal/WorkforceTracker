import { Platform, Alert, AppState } from 'react-native';
import { check, request, RESULTS, PERMISSIONS, openSettings } from 'react-native-permissions';

jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 30, select: jest.fn() },
  Alert: { alert: jest.fn() },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
  Linking: { openSettings: jest.fn() },
}));

jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
  openSettings: jest.fn(),
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
    LIMITED: 'limited',
  },
  PERMISSIONS: {
    ANDROID: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
      ACTIVITY_RECOGNITION: 'android.permission.ACTIVITY_RECOGNITION',
    },
    IOS: {
      LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
      LOCATION_ALWAYS: 'ios.permission.LOCATION_ALWAYS',
    },
  },
}));

jest.mock('../src/utils/batteryOptimization', () => ({
  ensureBatteryOptimizationDisabled: jest.fn(() => Promise.resolve()),
}));

// Explicitly import the .js file since .ts has priority in moduleFileExtensions
const permissionsService = require('../src/services/permissionsService.js');

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  Platform.Version = 30;
  AppState.currentState = 'active';
});

describe('permissionsService', () => {
  describe('resetBackgroundPermissionDialog', () => {
    it('resets flags without error', () => {
      expect(() => permissionsService.resetBackgroundPermissionDialog()).not.toThrow();
    });
  });

  describe('initAppStateListener', () => {
    it('registers AppState listener', () => {
      // cleanup first in case previous test left it
      permissionsService.cleanupAppStateListener();
      permissionsService.initAppStateListener();
      expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      permissionsService.cleanupAppStateListener();
    });
  });

  describe('cleanupAppStateListener', () => {
    it('cleans up without error', () => {
      expect(() => permissionsService.cleanupAppStateListener()).not.toThrow();
    });
  });

  describe('checkNotificationsPermissionOnAppActive', () => {
    it('returns true if not Android', async () => {
      Platform.OS = 'ios';
      const result = await permissionsService.checkNotificationsPermissionOnAppActive();
      expect(result).toBe(true);
    });

    it('returns true if Android < 33', async () => {
      Platform.Version = 28;
      const result = await permissionsService.checkNotificationsPermissionOnAppActive();
      expect(result).toBe(true);
    });

    it('returns true if notifications already granted', async () => {
      Platform.Version = 33;
      check.mockResolvedValue(RESULTS.GRANTED);

      const result = await permissionsService.checkNotificationsPermissionOnAppActive();

      expect(result).toBe(true);
    });

    it('requests permission and returns true if granted', async () => {
      Platform.Version = 33;
      check.mockResolvedValue(RESULTS.DENIED);
      request.mockResolvedValue(RESULTS.GRANTED);

      const result = await permissionsService.checkNotificationsPermissionOnAppActive();

      expect(result).toBe(true);
    });

    it('shows alert if denied and returns false', async () => {
      Platform.Version = 33;
      check.mockResolvedValue(RESULTS.DENIED);
      request.mockResolvedValue(RESULTS.DENIED);

      const result = await permissionsService.checkNotificationsPermissionOnAppActive();

      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalled();
    });

    it('returns false on error', async () => {
      Platform.Version = 33;
      check.mockRejectedValue(new Error('Permission error'));

      const result = await permissionsService.checkNotificationsPermissionOnAppActive();

      expect(result).toBe(false);
    });
  });

  describe('forceShowBackgroundPermissionDialog', () => {
    it('returns false if not Android', async () => {
      Platform.OS = 'ios';
      const result = await permissionsService.forceShowBackgroundPermissionDialog();
      expect(result).toBe(false);
    });

    it('returns true if already granted', async () => {
      check.mockResolvedValue(RESULTS.GRANTED);

      const result = await permissionsService.forceShowBackgroundPermissionDialog();

      expect(result).toBe(true);
    });

    it('requests permission and returns true if granted', async () => {
      check.mockResolvedValue(RESULTS.DENIED);
      request.mockResolvedValue(RESULTS.GRANTED);

      const result = await permissionsService.forceShowBackgroundPermissionDialog();

      expect(result).toBe(true);
    });

    it('shows alert if denied', async () => {
      check.mockResolvedValue(RESULTS.DENIED);
      request.mockResolvedValue(RESULTS.DENIED);

      const result = await permissionsService.forceShowBackgroundPermissionDialog();

      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalled();
    });

    it('returns false on error', async () => {
      check.mockRejectedValue(new Error('error'));

      const result = await permissionsService.forceShowBackgroundPermissionDialog();

      expect(result).toBe(false);
    });
  });

  describe('requestBackgroundLocationTwoClicks', () => {
    it('returns true if not Android', async () => {
      Platform.OS = 'ios';
      const result = await permissionsService.requestBackgroundLocationTwoClicks();
      expect(result).toBe(true);
    });

    it('requests fine location first, then background on Android Q+', async () => {
      check.mockResolvedValueOnce(RESULTS.GRANTED); // fine
      check.mockResolvedValueOnce(RESULTS.GRANTED); // background

      const result = await permissionsService.requestBackgroundLocationTwoClicks();

      expect(result).toBe(true);
    });

    it('shows alert when fine location denied', async () => {
      check.mockResolvedValueOnce(RESULTS.DENIED);
      request.mockResolvedValueOnce(RESULTS.DENIED);

      const result = await permissionsService.requestBackgroundLocationTwoClicks();

      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalled();
    });

    it('shows alert when background location denied', async () => {
      check.mockResolvedValueOnce(RESULTS.GRANTED); // fine
      check.mockResolvedValueOnce(RESULTS.DENIED); // background check
      request.mockResolvedValueOnce(RESULTS.DENIED); // background request

      const result = await permissionsService.requestBackgroundLocationTwoClicks();

      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalled();
    });

    it('skips background on pre-Q Android', async () => {
      Platform.Version = 28;
      check.mockResolvedValueOnce(RESULTS.GRANTED); // fine

      const result = await permissionsService.requestBackgroundLocationTwoClicks();

      expect(result).toBe(true);
    });
  });

  describe('ensureAlwaysLocationPermission', () => {
    it('calls Android flow on Android', async () => {
      check.mockResolvedValue(RESULTS.GRANTED);

      const result = await permissionsService.ensureAlwaysLocationPermission();

      expect(check).toHaveBeenCalled();
    });

    it('calls iOS flow on iOS', async () => {
      Platform.OS = 'ios';
      check.mockResolvedValue(RESULTS.GRANTED);

      const result = await permissionsService.ensureAlwaysLocationPermission();

      expect(check).toHaveBeenCalled();
    });
  });

  describe('requestActivityRecognitionPermission', () => {
    it('returns true on iOS', async () => {
      Platform.OS = 'ios';
      const result = await permissionsService.requestActivityRecognitionPermission();
      expect(result).toBe(true);
    });

    it('returns true if already granted on Android', async () => {
      check.mockResolvedValue(RESULTS.GRANTED);

      const result = await permissionsService.requestActivityRecognitionPermission();

      expect(result).toBe(true);
    });

    it('requests and returns result', async () => {
      check.mockResolvedValue(RESULTS.DENIED);
      request.mockResolvedValue(RESULTS.GRANTED);

      const result = await permissionsService.requestActivityRecognitionPermission();

      expect(result).toBe(true);
    });

    it('shows alert if denied', async () => {
      check.mockResolvedValue(RESULTS.DENIED);
      request.mockResolvedValue(RESULTS.DENIED);

      const result = await permissionsService.requestActivityRecognitionPermission();

      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  describe('ensureNotificationsPermission', () => {
    it('returns true on iOS', async () => {
      Platform.OS = 'ios';
      const result = await permissionsService.ensureNotificationsPermission();
      expect(result).toBe(true);
    });

    it('returns true on Android < 33', async () => {
      Platform.Version = 28;
      const result = await permissionsService.ensureNotificationsPermission();
      expect(result).toBe(true);
    });

    it('returns true if granted', async () => {
      Platform.Version = 33;
      check.mockResolvedValue(RESULTS.GRANTED);

      const result = await permissionsService.ensureNotificationsPermission();

      expect(result).toBe(true);
    });

    it('requests and returns result', async () => {
      Platform.Version = 33;
      check.mockResolvedValue(RESULTS.DENIED);
      request.mockResolvedValue(RESULTS.GRANTED);

      const result = await permissionsService.ensureNotificationsPermission();

      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      Platform.Version = 33;
      check.mockRejectedValue(new Error('error'));

      const result = await permissionsService.ensureNotificationsPermission();

      expect(result).toBe(false);
    });
  });

  describe('requestAllPermissions', () => {
    it('returns true when all permissions granted', async () => {
      check.mockResolvedValue(RESULTS.GRANTED);

      const result = await permissionsService.requestAllPermissions();

      expect(result).toBe(true);
    });
  });
});
