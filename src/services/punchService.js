import axios from 'axios';
import { API_CONFIG, getBearerHeaders } from '../config/api';

class PunchService {
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: 10000,
    });
  }

  async punchIn(userId, phoneImei, photoName) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      
      const response = await this.axiosInstance.post(API_CONFIG.ENDPOINTS.PUNCH, {
        api_token: API_CONFIG.API_TOKEN,
        user_id: userId,
        timestamp: timestamp,
        status: 0, // 0 = punch in
        phone_imei: phoneImei,
        photo_name: photoName,
      }, {
        headers: getBearerHeaders(),
      });

      if (response.data && response.data.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.data.message || 'Ошибка начала смены' };
      }
    } catch (error) {
      console.error('Punch in error:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка сети' 
      };
    }
  }

  async punchOut(userId, phoneImei, photoName) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      
      const response = await this.axiosInstance.post(API_CONFIG.ENDPOINTS.PUNCH, {
        api_token: API_CONFIG.API_TOKEN,
        user_id: userId,
        timestamp: timestamp,
        status: 1, // 1 = punch out
        phone_imei: phoneImei,
        photo_name: photoName,
      }, {
        headers: getBearerHeaders(),
      });

      if (response.data && response.data.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.data.message || 'Ошибка завершения смены' };
      }
    } catch (error) {
      console.error('Punch out error:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка сети' 
      };
    }
  }

  async getWorkerStatus(userId) {
    try {
      const response = await this.axiosInstance.get(
        `${API_CONFIG.ENDPOINTS.WORKER_STATUS}?user_id=${userId}`,
        { headers: getBearerHeaders() }
      );

      if (response.data && response.data.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.data.message || 'Ошибка получения статуса' };
      }
    } catch (error) {
      console.error('Get worker status error:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка сети' 
      };
    }
  }
}

export default new PunchService();

