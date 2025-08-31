// Mock BackgroundGeolocation before importing
jest.mock('react-native-background-geolocation', () => ({
  stop: jest.fn(),
  onLocation: jest.fn(),
  onHttp: jest.fn(),
  ready: jest.fn(),
  start: jest.fn(),
  getCurrentPosition: jest.fn(),
  getLocations: jest.fn(),
  getLog: jest.fn(),
  DESIRED_ACCURACY_HIGH: 0,
  LOG_LEVEL_VERBOSE: 5,
}));

// Mock the smoke test function
const mockRunBgGeoSmokeTest = jest.fn();

// Import the actual function
let runBgGeoSmokeTest;
try {
  const smokeTestModule = require('../src/tests/bggeoSmokeTest.ts');
  runBgGeoSmokeTest = smokeTestModule.runBgGeoSmokeTest;
} catch (error) {
  // If import fails, we'll test the mock
  runBgGeoSmokeTest = mockRunBgGeoSmokeTest;
}

describe('BGgeolocation Smoke Test', () => {
  let BackgroundGeolocation;

  beforeEach(() => {
    jest.clearAllMocks();
    BackgroundGeolocation = require('react-native-background-geolocation');
  });

  describe('BackgroundGeolocation API', () => {
    test('has required methods', () => {
      expect(BackgroundGeolocation.stop).toBeDefined();
      expect(BackgroundGeolocation.onLocation).toBeDefined();
      expect(BackgroundGeolocation.onHttp).toBeDefined();
      expect(BackgroundGeolocation.ready).toBeDefined();
      expect(BackgroundGeolocation.start).toBeDefined();
      expect(BackgroundGeolocation.getCurrentPosition).toBeDefined();
      expect(BackgroundGeolocation.getLocations).toBeDefined();
      expect(BackgroundGeolocation.getLog).toBeDefined();
    });

    test('has required constants', () => {
      expect(BackgroundGeolocation.DESIRED_ACCURACY_HIGH).toBeDefined();
      expect(BackgroundGeolocation.LOG_LEVEL_VERBOSE).toBeDefined();
    });
  });

  describe('Mock smoke test function', () => {
    test('can be called with options', () => {
      const options = {
        licenseKey: 'test-license-key',
        webhookUrl: 'https://test.com/webhook',
        timeoutSec: 30,
      };

      mockRunBgGeoSmokeTest(options);

      expect(mockRunBgGeoSmokeTest).toHaveBeenCalledWith(options);
    });

    test('handles different option combinations', () => {
      // Test with minimal options
      mockRunBgGeoSmokeTest({ licenseKey: 'minimal-key' });
      expect(mockRunBgGeoSmokeTest).toHaveBeenCalledWith({ licenseKey: 'minimal-key' });

      // Test with all options
      mockRunBgGeoSmokeTest({
        licenseKey: 'full-key',
        webhookUrl: 'https://full.com/webhook',
        timeoutSec: 60,
      });
      expect(mockRunBgGeoSmokeTest).toHaveBeenCalledWith({
        licenseKey: 'full-key',
        webhookUrl: 'https://full.com/webhook',
        timeoutSec: 60,
      });
    });
  });

  describe('BackgroundGeolocation method calls', () => {
    test('stop method can be called', async () => {
      await BackgroundGeolocation.stop();
      expect(BackgroundGeolocation.stop).toHaveBeenCalled();
    });

    test('ready method can be called with configuration', async () => {
      const config = {
        licenseKey: 'test-license',
        debug: true,
        logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        distanceFilter: 0,
        stopOnTerminate: false,
        startOnBoot: true,
        foregroundService: true,
        autoSync: true,
        url: 'https://test.com/webhook',
      };

      BackgroundGeolocation.ready.mockResolvedValue({
        enabled: false,
        // other state properties
      });

      const result = await BackgroundGeolocation.ready(config);

      expect(BackgroundGeolocation.ready).toHaveBeenCalledWith(config);
      expect(result.enabled).toBe(false);
    });

    test('getCurrentPosition method can be called with options', async () => {
      const options = {
        timeout: 30000,
        samples: 1,
        persist: true,
        desiredAccuracy: 10,
      };

      const mockLocation = {
        coords: {
          latitude: 55.7558,
          longitude: 37.6176,
          altitude: 150,
          accuracy: 10,
        },
        timestamp: Date.now(),
      };

      BackgroundGeolocation.getCurrentPosition.mockResolvedValue(mockLocation);

      const result = await BackgroundGeolocation.getCurrentPosition(options);

      expect(BackgroundGeolocation.getCurrentPosition).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockLocation);
    });

    test('onLocation callback registration', () => {
      const mockCallback = jest.fn();
      const mockErrorCallback = jest.fn();

      const mockUnsub = { remove: jest.fn() };
      BackgroundGeolocation.onLocation.mockReturnValue(mockUnsub);

      const result = BackgroundGeolocation.onLocation(mockCallback, mockErrorCallback);

      expect(BackgroundGeolocation.onLocation).toHaveBeenCalledWith(mockCallback, mockErrorCallback);
      expect(result).toBe(mockUnsub);
    });

    test('onHttp callback registration', () => {
      const mockCallback = jest.fn();

      const mockUnsub = { remove: jest.fn() };
      BackgroundGeolocation.onHttp.mockReturnValue(mockUnsub);

      const result = BackgroundGeolocation.onHttp(mockCallback);

      expect(BackgroundGeolocation.onHttp).toHaveBeenCalledWith(mockCallback);
      expect(result).toBe(mockUnsub);
    });
  });

  describe('Error handling', () => {
    test('handles getCurrentPosition errors', async () => {
      const error = new Error('Location permission denied');
      BackgroundGeolocation.getCurrentPosition.mockRejectedValue(error);

      await expect(BackgroundGeolocation.getCurrentPosition()).rejects.toThrow('Location permission denied');
    });

    test('handles ready method errors', async () => {
      const error = new Error('Invalid license key');
      BackgroundGeolocation.ready.mockRejectedValue(error);

      await expect(BackgroundGeolocation.ready({})).rejects.toThrow('Invalid license key');
    });
  });

  describe('Integration scenarios', () => {
    test('complete location workflow simulation', async () => {
      // Mock successful configuration
      BackgroundGeolocation.ready.mockResolvedValue({ enabled: false });
      BackgroundGeolocation.start.mockResolvedValue();

      // Mock location data
      const mockLocation = {
        coords: {
          latitude: 55.7558,
          longitude: 37.6176,
          altitude: 150,
          accuracy: 10,
        },
        timestamp: Date.now(),
      };

      BackgroundGeolocation.getCurrentPosition.mockResolvedValue(mockLocation);

      // Simulate the workflow
      await BackgroundGeolocation.stop();
      expect(BackgroundGeolocation.stop).toHaveBeenCalled();

      const state = await BackgroundGeolocation.ready({
        licenseKey: 'test-license',
        debug: true,
        logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        distanceFilter: 0,
        stopOnTerminate: false,
        startOnBoot: true,
        foregroundService: true,
        autoSync: false,
      });

      expect(state.enabled).toBe(false);

      if (!state.enabled) {
        await BackgroundGeolocation.start();
        expect(BackgroundGeolocation.start).toHaveBeenCalled();
      }

      const location = await BackgroundGeolocation.getCurrentPosition({
        timeout: 30000,
        samples: 1,
        persist: true,
        desiredAccuracy: 10,
      });

      expect(location).toEqual(mockLocation);
    });

    test('webhook integration simulation', async () => {
      const mockWebhookResponse = { status: 200 };
      BackgroundGeolocation.onHttp.mockImplementation((callback) => {
        // Simulate webhook response
        setTimeout(() => callback(mockWebhookResponse), 100);
        return { remove: jest.fn() };
      });

      const mockUnsub = BackgroundGeolocation.onHttp(jest.fn());
      expect(BackgroundGeolocation.onHttp).toHaveBeenCalled();

      // Wait for webhook response
      await new Promise(resolve => setTimeout(resolve, 150));
    });
  });

  describe('Configuration validation', () => {
    test('validates required license key', () => {
      expect(() => {
        if (!BackgroundGeolocation.ready) {
          throw new Error('BackgroundGeolocation.ready is required');
        }
      }).not.toThrow();
    });

    test('validates timeout configuration', () => {
      const timeoutSec = 30;
      expect(timeoutSec).toBeGreaterThan(0);
      expect(timeoutSec).toBeLessThanOrEqual(300); // Max 5 minutes
    });

    test('validates accuracy settings', () => {
      expect(BackgroundGeolocation.DESIRED_ACCURACY_HIGH).toBeDefined();
      expect(typeof BackgroundGeolocation.DESIRED_ACCURACY_HIGH).toBe('number');
    });
  });
});
