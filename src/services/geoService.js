import axios from 'axios';
import BackgroundGeolocation from 'react-native-background-geolocation';
import { API_CONFIG, sendGeoDataToWebhook } from '../config/api';
import { Platform } from 'react-native';

class GeoService {
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: 10000,
    });
    this.geoData = [];
    this.isEmulator = false;
    this.checkIfEmulator();
  }

  // Проверка, запущено ли приложение в эмуляторе
  checkIfEmulator() {
    if (Platform.OS === 'android') {
      // Проверяем признаки эмулятора
      this.isEmulator = __DEV__ && (Platform.constants?.Brand === 'generic' || Platform.constants?.Model === 'sdk_gphone');
    }
  }

  // Добавление новой геопозиции
  addGeoPoint(lat, lon, alt, altMsl, hasAlt, hasAltMsl, hasAltMslAccuracy, mslAccuracyMeters) {
    const geoPoint = {
      lat: lat,
      lon: lon,
      utm: Math.floor(Date.now() / 1000),
      alt: alt || 0,
      altmsl: altMsl || 0,
      hasalt: hasAlt || false,
      hasaltmsl: hasAltMsl || false,
      hasaltmslaccucacy: hasAltMslAccuracy || false,
      mslaccucacyMeters: mslAccuracyMeters || 0,
    };

    this.geoData.push(geoPoint);
    return geoPoint;
  }

  // Отправка геоданных на сервер
  async saveGeoData(userId, placeId, phoneImei) {
    try {
      if (this.geoData.length === 0) {
        return { success: false, error: 'Нет данных для отправки' };
      }

      const payload = {
        user_id: userId,
        place_id: placeId,
        phone_imei: phoneImei,
        geo_array: this.geoData,
        api_token: API_CONFIG.API_TOKEN,
      };

      const response = await this.axiosInstance.post(
        API_CONFIG.ENDPOINTS.DB_SAVE,
        payload,
        { headers: { 'API_TOKEN': API_CONFIG.API_TOKEN, 'Content-Type': 'application/json' } }
      );

      if (response?.data && (response.data.success === true || response.status >= 200 && response.status < 300)) {
        // Отправляем данные на webhook для мониторинга
        try {
          await sendGeoDataToWebhook({
            success: true,
            userId,
            placeId,
            phoneImei,
            geoCount: this.geoData.length,
            serverResponse: response.data,
            timestamp: new Date().toISOString()
          });
        } catch (webhookError) {
          console.log('Webhook error (non-critical):', webhookError.message);
        }
        
        // Очищаем отправленные данные
        this.geoData = [];
        return { success: true, data: response.data };
      } else {
        // Отправляем ошибку на webhook
        try {
          await sendGeoDataToWebhook({
            success: false,
            userId,
            placeId,
            phoneImei,
            geoCount: this.geoData.length,
            error: response.data.message || 'Ошибка сохранения геоданных',
            timestamp: new Date().toISOString()
          });
        } catch (webhookError) {
          console.log('Webhook error (non-critical):', webhookError.message);
        }
        
        return { success: false, error: response.data.message || 'Ошибка сохранения геоданных' };
      }
    } catch (error) {
      console.error('Save geo data error:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка сети' 
      };
    }
  }

  // Получение текущих геоданных
  getCurrentGeoData() {
    return [...this.geoData];
  }

  // Очистка геоданных
  clearGeoData() {
    this.geoData = [];
  }

  // Получение количества точек
  getGeoDataCount() {
    return this.geoData.length;
  }

  // Получение актуальной геолокации через BackgroundGeolocation
  async getCurrentLocation() {
    console.log('=== GeoService.getCurrentLocation ===');
    console.log('Is emulator:', this.isEmulator);
    
    try {
      console.log('Requesting position from BackgroundGeolocation...');
      
      const loc = await BackgroundGeolocation.getCurrentPosition({
        timeout: 15,
        samples: 1,
        persist: false,
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      });
      
      console.log('Raw BackgroundGeolocation response:', loc);
      
      const c = loc?.coords || {};
      console.log('Extracted coords:', c);
      
      // Проверяем, не являются ли координаты fallback значениями эмулятора
      if (this.isEmulator && this.isEmulatorFallbackCoords(c.latitude, c.longitude)) {
        console.warn('Detected emulator fallback coordinates, requesting manual input');
        throw new Error('EMULATOR_FALLBACK_COORDS');
      }
      
      const result = {
        latitude: c.latitude,
        longitude: c.longitude,
        altitude: c.altitude,
        accuracy: c.accuracy,
      };
      
      console.log('Processed location result:', result);
      
      // Проверяем валидность результата
      if (typeof result.latitude !== 'number' || typeof result.longitude !== 'number') {
        console.error('Invalid coordinates in result:', result);
        throw new Error(`Invalid coordinates: lat=${result.latitude}, lon=${result.longitude}`);
      }
      
      if (isNaN(result.latitude) || isNaN(result.longitude)) {
        console.error('NaN coordinates in result:', result);
        throw new Error(`NaN coordinates: lat=${result.latitude}, lon=${result.longitude}`);
      }
      
      console.log('Location validation passed');
      console.log('=== End GeoService.getCurrentLocation ===');
      
      return result;
    } catch (e) {
      console.error('Error in getCurrentLocation:', e);
      
      // Если это ошибка fallback координат эмулятора, предлагаем ручной ввод
      if (e.message === 'EMULATOR_FALLBACK_COORDS') {
        throw new Error('EMULATOR_FALLBACK_COORDS');
      }
      
      console.log('=== End GeoService.getCurrentLocation (ERROR) ===');
      // Возвращаем ошибку вызывающей стороне
      throw e;
    }
  }

  // Проверка, являются ли координаты fallback значениями эмулятора
  isEmulatorFallbackCoords(lat, lon) {
    // Google HQ coordinates (часто используются как fallback)
    const googleHQ = { lat: 37.421794, lon: -122.083922 };
    const tolerance = 0.000001; // 1 метр
    
    return Math.abs(lat - googleHQ.lat) < tolerance && Math.abs(lon - googleHQ.lon) < tolerance;
  }

  // Получение тестовых координат для эмулятора
  getTestCoordinates() {
    // Возвращаем координаты Москвы для тестирования
    return {
      latitude: 55.7558,
      longitude: 37.6176,
      altitude: 156,
      accuracy: 5,
    };
  }
}

export default new GeoService();

