import { Platform } from 'react-native';

jest.mock('react-native-config', () => ({
  DEVICE_IMEI: 'config-imei-123',
}));

// Must import after mocks
import DeviceUtils from '../src/utils/deviceUtils';

const DeviceInfo = require('react-native-device-info');

beforeEach(() => {
  // Reset cached deviceInfo
  DeviceUtils.deviceInfo = null;
  Platform.OS = 'android';
  Platform.Version = 30;
  jest.clearAllMocks();
  // Restore mock implementations after clearing
  DeviceInfo.getBrand.mockReturnValue('Samsung');
  DeviceInfo.getModel.mockReturnValue('Galaxy S21');
  DeviceInfo.getSystemVersion.mockReturnValue('12');
  DeviceInfo.getUniqueId.mockReturnValue('test-unique-id');
  DeviceInfo.getAndroidId.mockResolvedValue('android-id-123');
  DeviceInfo.isTablet.mockReturnValue(false);
  DeviceInfo.getDeviceNameSync.mockReturnValue('Test Device');
});

describe('DeviceUtils', () => {
  describe('getDeviceInfo', () => {
    it('returns device info on android', async () => {
      const info = await DeviceUtils.getDeviceInfo();
      expect(info.platform).toBe('android');
      expect(info.brand).toBe('Samsung');
      expect(info.model).toBe('Galaxy S21');
      expect(info.uniqueId).toBe('android-id-123');
      expect(info.userAgent).toBe('React Native Workforce Tracker');
    });

    it('caches device info on subsequent calls', async () => {
      const first = await DeviceUtils.getDeviceInfo();
      const second = await DeviceUtils.getDeviceInfo();
      expect(first).toBe(second); // Same reference
    });

    it('returns iOS info', async () => {
      Platform.OS = 'ios';
      DeviceInfo.getAndroidId.mockResolvedValue(undefined);
      DeviceInfo.getUniqueId.mockReturnValue('ios-vendor-id');

      const info = await DeviceUtils.getDeviceInfo();
      expect(info.platform).toBe('ios');
      expect(info.uniqueId).toBe('ios-vendor-id');
    });

    it('falls back to Config.DEVICE_IMEI when no ids', async () => {
      DeviceInfo.getAndroidId.mockResolvedValue(undefined);
      DeviceInfo.getUniqueId.mockReturnValue(undefined);

      const info = await DeviceUtils.getDeviceInfo();
      expect(info.uniqueId).toBe('config-imei-123');
    });

    it('returns basic info on error', async () => {
      DeviceInfo.getBrand.mockImplementation(() => { throw new Error('fail'); });

      const info = await DeviceUtils.getDeviceInfo();
      expect(info.platform).toBe('android');
      expect(info.uniqueId).toBe('config-imei-123');
    });
  });

  describe('getDeviceId', () => {
    it('returns uniqueId from device info', async () => {
      const id = await DeviceUtils.getDeviceId();
      expect(id).toBe('android-id-123');
    });
  });

  describe('getDeviceModel', () => {
    it('returns model name', async () => {
      const model = await DeviceUtils.getDeviceModel();
      expect(model).toBe('Galaxy S21');
    });
  });

  describe('getOSVersion', () => {
    it('returns system version', async () => {
      const version = await DeviceUtils.getOSVersion();
      expect(version).toBe('12');
    });
  });

  describe('isTablet', () => {
    it('returns false for phone', async () => {
      const result = await DeviceUtils.isTablet();
      expect(result).toBe(false);
    });
  });

  describe('getScreenDimensions', () => {
    it('returns width and height', () => {
      const dims = DeviceUtils.getScreenDimensions();
      expect(dims).toHaveProperty('width');
      expect(dims).toHaveProperty('height');
    });
  });

  describe('checkFeatureSupport', () => {
    it('returns feature availability', async () => {
      const features = await DeviceUtils.checkFeatureSupport();
      expect(features).toHaveProperty('camera');
      expect(features).toHaveProperty('location');
      expect(features).toHaveProperty('network');
      expect(features).toHaveProperty('battery');
    });
  });

  describe('getNetworkInfo', () => {
    it('returns network info', async () => {
      const info = await DeviceUtils.getNetworkInfo();
      expect(info.isConnected).toBe(true);
      expect(info.type).toBe('wifi');
    });
  });

  describe('getBatteryInfo', () => {
    it('returns battery info', async () => {
      const info = await DeviceUtils.getBatteryInfo();
      expect(info.level).toBe(85);
      expect(info.isCharging).toBe(false);
    });
  });
});
