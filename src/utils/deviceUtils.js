import { Platform } from 'react-native';
import Config from 'react-native-config';

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
      // В реальном приложении здесь будет получение реальных данных устройства
      // Пока используем тестовые данные
      this.deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        isTablet: false,
        brand: 'Test Device',
        model: 'Test Model',
        systemVersion: 'Test Version',
        uniqueId: Config.DEVICE_IMEI || 'unknown-device', // IMEI из .env или fallback
        deviceName: 'Test Device Name',
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
  async getNetworkInfo() {
    try {
      // В реальном приложении здесь будет получение информации о сети
      return {
        isConnected: true,
        type: 'wifi', // wifi, cellular, none
        strength: 'strong',
        carrier: 'Test Carrier',
      };
    } catch (error) {
      console.error('Error getting network info:', error);
      return {
        isConnected: false,
        type: 'none',
        strength: 'unknown',
        carrier: 'Unknown',
      };
    }
  }

  // Получение информации о батарее
  async getBatteryInfo() {
    try {
      // В реальном приложении здесь будет получение информации о батарее
      return {
        level: 85, // Процент заряда (0-100)
        isCharging: false,
        isLow: false,
      };
    } catch (error) {
      console.error('Error getting battery info:', error);
      return {
        level: 0,
        isCharging: false,
        isLow: true,
      };
    }
  }

  // Проверка доступности камеры
  async isCameraAvailable() {
    try {
      // В реальном приложении здесь будет проверка доступности камеры
      return true;
    } catch (error) {
      console.error('Error checking camera availability:', error);
      return false;
    }
  }

  // Проверка доступности геолокации
  async isLocationAvailable() {
    try {
      // В реальном приложении здесь будет проверка доступности геолокации
      return true;
    } catch (error) {
      console.error('Error checking location availability:', error);
      return false;
    }
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

