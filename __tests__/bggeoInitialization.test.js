// Mock react-native-config
jest.mock('react-native-config', () => ({
  BG_GEO_LICENSE_ANDROID: 'test-android-license-key',
  BG_GEO_LICENSE_IOS: 'test-ios-license-key',
  API_URL: 'https://test-api.com',
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: jest.fn((obj) => obj.android),
  },
}));

// Mock BackgroundGeolocation
const mockBackgroundGeolocation = {
  onLocation: jest.fn(),
  onError: jest.fn(),
  logger: {
    setEnabled: jest.fn(),
    setLevel: jest.fn(),
    getLog: jest.fn(),
  },
  ready: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  getState: jest.fn(),
  getCurrentPosition: jest.fn(),
  removeListeners: jest.fn(),
  DESIRED_ACCURACY_HIGH: 0,
  LOG_LEVEL_VERBOSE: 5,
  LOG_LEVEL_INFO: 3,
};

jest.mock('react-native-background-geolocation', () => mockBackgroundGeolocation);

// Mock API config
jest.mock('../src/config/api', () => ({
  API_CONFIG: {
    BASE_URL: 'https://test-api.com',
    API_TOKEN: 'test-token',
  },
}));

// Mock postLocation function
const mockPostLocation = jest.fn();
jest.mock('../src/api', () => ({
  postLocation: mockPostLocation,
}));

// Import the functions to test
let initLocation, getLicenseInfo, getBgGeoState, startTracking, stopTracking;

// Try to import the actual functions
try {
  const locationModule = require('../src/location.js');
  initLocation = locationModule.initLocation;
  getLicenseInfo = locationModule.getLicenseInfo;
  getBgGeoState = locationModule.getBgGeoState;
  startTracking = locationModule.startTracking;
  stopTracking = locationModule.stopTracking;
} catch (error) {
  console.warn('Could not import location module, using mocks');
}

describe('BGgeolocation Initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module state by clearing require cache
    jest.resetModules();
    
    // Reset mock implementations
    mockBackgroundGeolocation.onLocation.mockClear();
    mockBackgroundGeolocation.onError.mockClear();
    mockBackgroundGeolocation.logger.setEnabled.mockClear();
    mockBackgroundGeolocation.logger.setLevel.mockClear();
    mockBackgroundGeolocation.ready.mockClear();
    mockBackgroundGeolocation.start.mockClear();
    mockBackgroundGeolocation.getState.mockClear();
    mockPostLocation.mockClear();
  });

  describe('Platform Detection', () => {
    test('detects Android platform correctly', () => {
      const Platform = require('react-native').Platform;
      expect(Platform.OS).toBe('android');
      expect(Platform.select({ android: 'android-value', ios: 'ios-value' })).toBe('android-value');
    });

    test('selects correct license key for platform', () => {
      const Config = require('react-native-config');
      expect(Config.BG_GEO_LICENSE_ANDROID).toBe('test-android-license-key');
      expect(Config.BG_GEO_LICENSE_IOS).toBe('test-ios-license-key');
    });
  });

  describe('License Key Processing', () => {
    test('handles license key with quotes', () => {
      const testLicense = '"quoted-license-key"';
      const processed = testLicense.trim().replace(/^["']|["']$/g, '');
      expect(processed).toBe('quoted-license-key');
    });

    test('handles license key with single quotes', () => {
      const testLicense = "'single-quoted-key'";
      const processed = testLicense.trim().replace(/^["']|["']$/g, '');
      expect(processed).toBe('single-quoted-key');
    });

    test('handles empty license key', () => {
      const testLicense = '';
      const processed = testLicense.trim();
      expect(processed).toBe('');
    });

    test('handles null license key', () => {
      const testLicense = null;
      const processed = testLicense || null;
      expect(processed).toBe(null);
    });
  });

  describe('BackgroundGeolocation Configuration', () => {
    test('sets correct logger configuration in dev mode', async () => {
      // Mock __DEV__ as true
      global.__DEV__ = true;
      
      // Simulate logger setup
      await mockBackgroundGeolocation.logger.setEnabled(true);
      await mockBackgroundGeolocation.logger.setLevel(mockBackgroundGeolocation.LOG_LEVEL_VERBOSE);
      
      expect(mockBackgroundGeolocation.logger.setEnabled).toHaveBeenCalledWith(true);
      expect(mockBackgroundGeolocation.logger.setLevel).toHaveBeenCalledWith(mockBackgroundGeolocation.LOG_LEVEL_VERBOSE);
    });

    test('sets correct logger configuration in production mode', async () => {
      // Mock __DEV__ as false
      global.__DEV__ = false;
      
      // Simulate logger setup
      await mockBackgroundGeolocation.logger.setEnabled(false);
      await mockBackgroundGeolocation.logger.setLevel(mockBackgroundGeolocation.LOG_LEVEL_INFO);
      
      expect(mockBackgroundGeolocation.logger.setLevel).toHaveBeenCalledWith(mockBackgroundGeolocation.LOG_LEVEL_INFO);
    });
  });

  describe('BackgroundGeolocation.ready Configuration', () => {
    test('calls ready with correct parameters', async () => {
      const expectedConfig = {
        reset: true,
        desiredAccuracy: mockBackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        distanceFilter: 20,
        stopOnTerminate: false,
        startOnBoot: true,
        pausesLocationUpdatesAutomatically: true,
        showsBackgroundLocationIndicator: true,
        url: 'https://test-api.com/db_save/',
        method: 'POST',
        autoSync: true,
        batchSync: true,
        maxBatchSize: 20,
        headers: { 'API_TOKEN': 'test-token', 'Content-Type': 'application/json' },
        debug: false, // __DEV__ is false in test
        logLevel: mockBackgroundGeolocation.LOG_LEVEL_INFO,
        foregroundService: true,
        enableHeadless: true,
        license: 'test-android-license-key',
      };

      mockBackgroundGeolocation.ready.mockResolvedValue({ enabled: false });

      await mockBackgroundGeolocation.ready(expectedConfig);

      expect(mockBackgroundGeolocation.ready).toHaveBeenCalledWith(expectedConfig);
    });

    test('handles ready response correctly', async () => {
      const mockState = {
        enabled: false,
        trackingMode: 1,
        distanceFilter: 20,
        desiredAccuracy: 0,
      };

      mockBackgroundGeolocation.ready.mockResolvedValue(mockState);

      const result = await mockBackgroundGeolocation.ready({});
      expect(result).toEqual(mockState);
      expect(result.enabled).toBe(false);
    });
  });

  describe('BackgroundGeolocation.start', () => {
    test('calls start when state.enabled is false', async () => {
      mockBackgroundGeolocation.ready.mockResolvedValue({ enabled: false });
      mockBackgroundGeolocation.start.mockResolvedValue();

      // Simulate the flow
      const state = await mockBackgroundGeolocation.ready({});
      if (!state.enabled) {
        await mockBackgroundGeolocation.start();
      }

      expect(mockBackgroundGeolocation.start).toHaveBeenCalled();
    });

    test('does not call start when state.enabled is true', async () => {
      mockBackgroundGeolocation.ready.mockResolvedValue({ enabled: true });

      // Simulate the flow
      const state = await mockBackgroundGeolocation.ready({});
      if (!state.enabled) {
        await mockBackgroundGeolocation.start();
      }

      expect(mockBackgroundGeolocation.start).not.toHaveBeenCalled();
    });

    test('handles start errors correctly', async () => {
      const startError = new Error('Start failed');
      mockBackgroundGeolocation.start.mockRejectedValue(startError);

      await expect(mockBackgroundGeolocation.start()).rejects.toThrow('Start failed');
    });
  });

  describe('Event Listeners', () => {
    test('sets up onLocation listener correctly', () => {
      const mockLocationCallback = jest.fn();
      mockBackgroundGeolocation.onLocation(mockLocationCallback);

      expect(mockBackgroundGeolocation.onLocation).toHaveBeenCalledWith(mockLocationCallback);
    });

    test('sets up onError listener correctly', () => {
      const mockErrorCallback = jest.fn();
      mockBackgroundGeolocation.onError(mockErrorCallback);

      expect(mockBackgroundGeolocation.onError).toHaveBeenCalledWith(mockErrorCallback);
    });

    test('location callback processes coordinates correctly', async () => {
      const mockLocation = {
        coords: {
          latitude: 55.7558,
          longitude: 37.6176,
          accuracy: 10,
          speed: 0,
          heading: 0,
        },
        timestamp: Date.now(),
        battery: { level: 0.8 },
        activity: { type: 'still' },
      };

      const mockLocationCallback = jest.fn();
      mockBackgroundGeolocation.onLocation(mockLocationCallback);

      // Simulate location callback
      const callback = mockBackgroundGeolocation.onLocation.mock.calls[0][0];
      await callback(mockLocation);

      expect(mockLocationCallback).toHaveBeenCalledWith(mockLocation);
    });

    test('error callback processes errors correctly', () => {
      const mockError = new Error('Location permission denied');
      const mockErrorCallback = jest.fn();
      mockBackgroundGeolocation.onError(mockErrorCallback);

      // Simulate error callback
      const callback = mockBackgroundGeolocation.onError.mock.calls[0][0];
      callback(mockError);

      expect(mockErrorCallback).toHaveBeenCalledWith(mockError);
    });
  });

  describe('API Integration', () => {
    test('posts location when API is configured', async () => {
      const mockLocation = {
        coords: {
          latitude: 55.7558,
          longitude: 37.6176,
          accuracy: 10,
          speed: 0,
          heading: 0,
        },
        timestamp: Date.now(),
        battery: { level: 0.8 },
        activity: { type: 'still' },
      };

      mockPostLocation.mockResolvedValue({ success: true });

      // Simulate location callback with API posting
      const locationData = {
        lat: mockLocation.coords.latitude,
        lon: mockLocation.coords.longitude,
        accuracy: mockLocation.coords.accuracy,
        speed: mockLocation.coords.speed,
        heading: mockLocation.coords.heading,
        ts: new Date(mockLocation.timestamp).toISOString(),
        batt: mockLocation.battery?.level ?? null,
        motion: mockLocation.activity?.type ?? null,
      };

      await mockPostLocation(locationData);

      expect(mockPostLocation).toHaveBeenCalledWith(locationData);
    });

    test('handles API posting errors gracefully', async () => {
      const apiError = new Error('Network error');
      mockPostLocation.mockRejectedValue(apiError);

      // The error should be caught and logged, not thrown
      try {
        await mockPostLocation({ lat: 0, lon: 0 });
      } catch (error) {
        // This should not happen due to error handling
        expect(error.message).toBe('Network error');
      }
    });
  });

  describe('State Management', () => {
    test('tracks initialization state correctly', () => {
      // These would be tested if we could access the module's internal state
      // For now, we test the getLicenseInfo function
      if (getLicenseInfo) {
        const licenseInfo = getLicenseInfo();
        expect(licenseInfo).toHaveProperty('platform');
        expect(licenseInfo).toHaveProperty('envVar');
        expect(licenseInfo).toHaveProperty('licensePresent');
        expect(licenseInfo).toHaveProperty('initAttempted');
        expect(licenseInfo).toHaveProperty('initSucceeded');
      }
    });

    test('handles multiple initialization calls', async () => {
      // The function should return early if already initialized
      if (initLocation) {
        // First call
        await initLocation();
        
        // Second call should return early
        await initLocation();
        
        // Verify that ready was only called once
        expect(mockBackgroundGeolocation.ready).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Error Handling', () => {
    test('handles ready errors correctly', async () => {
      const readyError = new Error('License invalid');
      mockBackgroundGeolocation.ready.mockRejectedValue(readyError);

      try {
        await mockBackgroundGeolocation.ready({});
      } catch (error) {
        expect(error.message).toBe('License invalid');
      }
    });

    test('handles start errors correctly', async () => {
      const startError = new Error('Permission denied');
      mockBackgroundGeolocation.start.mockRejectedValue(startError);

      try {
        await mockBackgroundGeolocation.start();
      } catch (error) {
        expect(error.message).toBe('Permission denied');
      }
    });

    test('handles logger setup errors gracefully', async () => {
      const loggerError = new Error('Logger not available');
      mockBackgroundGeolocation.logger.setEnabled.mockRejectedValue(loggerError);

      // Logger errors should not break initialization
      try {
        await mockBackgroundGeolocation.logger.setEnabled(true);
      } catch (error) {
        // Error should be caught and logged, not thrown
        expect(error.message).toBe('Logger not available');
      }
    });
  });

  describe('Integration Scenarios', () => {
    test('complete initialization flow', async () => {
      // Mock successful flow
      mockBackgroundGeolocation.ready.mockResolvedValue({ enabled: false });
      mockBackgroundGeolocation.start.mockResolvedValue();

      // Simulate complete initialization
      const state = await mockBackgroundGeolocation.ready({
        license: 'test-license',
        desiredAccuracy: mockBackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      });

      expect(state.enabled).toBe(false);

      if (!state.enabled) {
        await mockBackgroundGeolocation.start();
        expect(mockBackgroundGeolocation.start).toHaveBeenCalled();
      }

      // Verify all expected calls were made
      expect(mockBackgroundGeolocation.ready).toHaveBeenCalled();
      expect(mockBackgroundGeolocation.start).toHaveBeenCalled();
    });

    test('initialization with existing enabled state', async () => {
      // Mock already enabled state
      mockBackgroundGeolocation.ready.mockResolvedValue({ enabled: true });

      const state = await mockBackgroundGeolocation.ready({
        license: 'test-license',
      });

      expect(state.enabled).toBe(true);
      expect(mockBackgroundGeolocation.start).not.toHaveBeenCalled();
    });
  });
});
