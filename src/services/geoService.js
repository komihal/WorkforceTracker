import axios from 'axios';
import { API_CONFIG, getBearerHeaders } from '../config/api';

class GeoService {
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: 10000,
    });
    this.geoData = [];
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

      const response = await this.axiosInstance.post(API_CONFIG.ENDPOINTS.DB_SAVE, {
        api_token: API_CONFIG.API_TOKEN,
        user_id: userId,
        place_id: placeId,
        phone_imei: phoneImei,
        geo_array: this.geoData,
      }, {
        headers: getBearerHeaders(),
      });

      if (response.data && response.data.success) {
        // Очищаем отправленные данные
        this.geoData = [];
        return { success: true, data: response.data };
      } else {
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

  // Симуляция получения геолокации (в реальном приложении здесь будет нативная геолокация)
  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      // В реальном приложении здесь будет вызов нативной геолокации
      // Пока возвращаем тестовые данные
      const mockLocation = {
        latitude: 55.751244,
        longitude: 37.618423,
        altitude: 120.5,
        accuracy: 10,
      };
      
      setTimeout(() => {
        resolve(mockLocation);
      }, 1000);
    });
  }
}

export default new GeoService();

