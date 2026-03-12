import { Platform } from 'react-native';
import Config from 'react-native-config';
import DeviceInfo from 'react-native-device-info';

class DeviceUtils {
  constructor() {
    this.deviceInfo = null;
  }

  // Получение информации об устройстве
  async getDeviceInfo() {
    if (this.deviceInfo) {
      return this.deviceInfo;
    }

    try {
      const brand = DeviceInfo.getBrand?.() || 'Unknown';
      const model = DeviceInfo.getModel?.() || 'Unknown';
      const systemVersion = DeviceInfo.getSystemVersion?.() || String(Platform.Version);
      // На Android 10+ IMEI получить нельзя без привилегий. Используем стабильный ANDROID_ID.
      const androidId = Platform.OS === 'android'
        ? (await DeviceInfo.getAndroidId?.())
        : undefined;
      const vendorId = Platform.OS === 'ios'
        ? (DeviceInfo.getUniqueId?.())
        : undefined;
      const uniqueId = (androidId || vendorId || Config.DEVICE_IMEI || 'unknown-device');

      this.deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        isTablet: DeviceInfo.isTablet?.() || false,
        brand,
        model,
        systemVersion,
        uniqueId,
        deviceName: (DeviceInfo.getDeviceNameSync ? DeviceInfo.getDeviceNameSync() : 'Unknown Device'),
        userAgent: 'React Native Workforce Tracker',
      };

      return this.deviceInfo;
    } catch (error) {
      console.error('Error getting device info:', error);
      // Возвращаем базовую информацию
      return {
        platform: Platform.OS,
        version: Platform.Version,
        uniqueId: Config.DEVICE_IMEI || 'unknown-device',
      };
    }
  }

  // Получение IMEI или уникального идентификатора устройства
  async getDeviceId() {
    try {
      const deviceInfo = await this.getDeviceInfo();
      return deviceInfo.uniqueId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return Config.DEVICE_IMEI || 'unknown-device'; // Fallback ID из .env
    }
  }

  // Получение названия модели устройства
  async getDeviceModel() {
    try {
      const deviceInfo = await this.getDeviceInfo();
      return deviceInfo.model;
    } catch (error) {
      console.error('Error getting device model:', error);
      return 'Unknown Device';
    }
  }

  // Получение версии операционной системы
  async getOSVersion() {
    try {
      const deviceInfo = await this.getDeviceInfo();
      return deviceInfo.systemVersion;
    } catch (error) {
      console.error('Error getting OS version:', error);
      return 'Unknown Version';
    }
  }

  // Проверка, является ли устройство планшетом
  async isTablet() {
    try {
      const deviceInfo = await this.getDeviceInfo();
      return deviceInfo.isTablet;
    } catch (error) {
      console.error('Error checking if device is tablet:', error);
      return false;
    }
  }

  // Получение информации о сети
  // TODO: заменить заглушки на реальные вызовы (react-native-netinfo)
  async getNetworkInfo() {
    return {
      isConnected: true,
      type: 'wifi',
      strength: 'strong',
      carrier: 'Test Carrier',
    };
  }

  // Получение информации о батарее
  // TODO: заменить заглушку на реальный вызов (react-native-device-info)
  async getBatteryInfo() {
    return {
      level: 85,
      isCharging: false,
      isLow: false,
    };
  }

  // Проверка доступности камеры
  // TODO: заменить заглушку на реальную проверку
  async isCameraAvailable() {
    return true;
  }

  // Проверка доступности геолокации
  // TODO: заменить заглушку на реальную проверку
  async isLocationAvailable() {
    return true;
  }

  // Получение размера экрана
  getScreenDimensions() {
    try {
      const { Dimensions } = require('react-native');
      const { width, height } = Dimensions.get('window');
      return { width, height };
    } catch (error) {
      console.error('Error getting screen dimensions:', error);
      return { width: 375, height: 667 }; // Fallback dimensions
    }
  }

  // Проверка поддержки определенных функций
  async checkFeatureSupport() {
    try {
      const features = {
        camera: await this.isCameraAvailable(),
        location: await this.isLocationAvailable(),
        network: (await this.getNetworkInfo()).isConnected,
        battery: (await this.getBatteryInfo()).level > 20,
      };

      return features;
    } catch (error) {
      console.error('Error checking feature support:', error);
      return {
        camera: false,
        location: false,
        network: false,
        battery: false,
      };
    }
  }
}

export default new DeviceUtils();

