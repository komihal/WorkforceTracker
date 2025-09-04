import axios from 'axios';
import { API_CONFIG, getApiTokenHeaders } from '../config/api';

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
        headers: getApiTokenHeaders(),
      });

      if (response.data && response.data.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.data.message || 'Ошибка начала смены' };
      }
    } catch (error) {
      
      // Проверяем тип ошибки
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        return {
          success: false,
          error: 'Ошибка подключения к серверу. Проверьте интернет-соединение.',
        };
      }
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
          success: false,
          error: 'Превышено время ожидания ответа сервера. Попробуйте позже.',
        };
      }
      
      const statusCode = error?.response?.status;
      const serverMessage = error?.response?.data?.message;
      
      // Специальная обработка для заблокированного пользователя
      const isBlockedByStatus = statusCode === 423; // HTTP 423 Locked
      const isBlockedByMessage = typeof serverMessage === 'string' && /(block|заблок)/i.test(serverMessage);
      
      if (isBlockedByStatus || isBlockedByMessage) {
        return { success: false, error: 'Пользователь заблокирован. Обратитесь к администратору.' };
      }
      
      // Обработка HTTP ошибок
      if (statusCode) {
        switch (statusCode) {
          case 400:
            return { success: false, error: 'Неверный запрос. Проверьте данные.' };
          case 401:
            return { success: false, error: 'Не авторизован. Войдите в систему заново.' };
          case 403:
            return { success: false, error: 'Доступ запрещен.' };
          case 404:
            return { success: false, error: 'Сервис временно недоступен.' };
          case 500:
            return { success: false, error: 'Ошибка сервера. Попробуйте позже.' };
          case 502:
          case 503:
          case 504:
            return { success: false, error: 'Сервис временно недоступен. Попробуйте позже.' };
          default:
            return { success: false, error: serverMessage || `Ошибка сервера (${statusCode})` };
        }
      }
      
      // Если нет статуса, но есть сообщение от сервера
      if (serverMessage) {
        return { success: false, error: serverMessage };
      }
      
      // Общая ошибка сети
      return {
        success: false,
        error: 'Не удалось подключиться к серверу. Проверьте интернет-соединение.',
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
        headers: getApiTokenHeaders(),
      });

      if (response.data && response.data.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.data.message || 'Ошибка завершения смены' };
      }
    } catch (error) {
      console.error('Punch out error:', error);
      
      // Проверяем тип ошибки
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        return {
          success: false,
          error: 'Ошибка подключения к серверу. Проверьте интернет-соединение.',
        };
      }
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
          success: false,
          error: 'Превышено время ожидания ответа сервера. Попробуйте позже.',
        };
      }
      
      const statusCode = error?.response?.status;
      const serverMessage = error?.response?.data?.message;
      
      // Специальная обработка для заблокированного пользователя
      const isBlockedByStatus = statusCode === 423; // HTTP 423 Locked
      const isBlockedByMessage = typeof serverMessage === 'string' && /(block|заблок)/i.test(serverMessage);
      
      if (isBlockedByStatus || isBlockedByMessage) {
        return { success: false, error: 'Пользователь заблокирован. Обратитесь к администратору.' };
      }
      
      // Обработка HTTP ошибок
      if (statusCode) {
        switch (statusCode) {
          case 400:
            return { success: false, error: 'Неверный запрос. Проверьте данные.' };
          case 401:
            return { success: false, error: 'Не авторизован. Войдите в систему заново.' };
          case 403:
            return { success: false, error: 'Доступ запрещен.' };
          case 404:
            return { success: false, error: 'Сервис временно недоступен.' };
          case 500:
            return { success: false, error: 'Ошибка сервера. Попробуйте позже.' };
          case 502:
          case 503:
          case 504:
            return { success: false, error: 'Сервис временно недоступен. Попробуйте позже.' };
          default:
            return { success: false, error: serverMessage || `Ошибка сервера (${statusCode})` };
        }
      }
      
      // Если нет статуса, но есть сообщение от сервера
      if (serverMessage) {
        return { success: false, error: serverMessage };
      }
      
      // Общая ошибка сети
      return {
        success: false,
        error: 'Не удалось подключиться к серверу. Проверьте интернет-соединение.',
      };
    }
  }

  async getWorkerStatus(userId) {
    try {
      // Добавляем детальное логирование для отладки
      console.log('=== GET WORKER STATUS DEBUG ===');
      console.log('Requesting status for user_id:', userId);
      console.log('User ID type:', typeof userId);
      console.log('Full URL:', `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.WORKER_STATUS}?user_id=${userId}`);
      console.log('Headers:', getApiTokenHeaders());
      
      const response = await this.axiosInstance.get(
        `${API_CONFIG.ENDPOINTS.WORKER_STATUS}?user_id=${userId}`,
        { headers: getApiTokenHeaders() }
      );

      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      console.log('=== END GET WORKER STATUS DEBUG ===');

      // Эндпоинт может возвращать как обёртку с { success, ... }, так и объект без success
      const data = response?.data;
      if (!data) {
        return { success: false, error: 'Пустой ответ сервера' };
      }
      if (typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'success')) {
        return data.success ? { success: true, data } : { success: false, error: data.message || 'Ошибка получения статуса' };
      }
      // Если success нет, считаем успешным ответом c данными пользователя
      return { success: true, data };
    } catch (error) {
      // В dev-режиме console.error вызывает красный экран. Понижаем уровень логирования.
      const statusCode = error?.response?.status;
      const serverData = error?.response?.data;
      const message = error?.message || 'Unknown error';
      console.warn('Get worker status error:', message);
      if (__DEV__) {
        console.log('Error details:', {
          statusCode,
          serverData,
          isNetworkError: error?.code === 'NETWORK_ERROR' || message.includes('Network Error'),
        });
      }
      
      // Проверяем тип ошибки
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        return {
          success: false,
          error: 'Ошибка подключения к серверу. Проверьте интернет-соединение.',
        };
      }
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
          success: false,
          error: 'Превышено время ожидания ответа сервера. Попробуйте позже.',
        };
      }
      
      const serverMessage = error?.response?.data?.message;
      
      // Специальная обработка для заблокированного пользователя
      const isBlockedByStatus = statusCode === 423; // HTTP 423 Locked
      const isBlockedByMessage = typeof serverMessage === 'string' && /(block|заблок)/i.test(serverMessage);
      
      if (isBlockedByStatus || isBlockedByMessage) {
        return { success: false, error: 'Пользователь заблокирован. Обратитесь к администратору.' };
      }
      
      // Обработка HTTP ошибок
      if (statusCode) {
        switch (statusCode) {
          case 400:
            return { success: false, error: 'Неверный запрос. Проверьте данные.' };
          case 401:
            return { success: false, error: 'Не авторизован. Войдите в систему заново.' };
          case 403:
            return { success: false, error: 'Доступ запрещен.' };
          case 404:
            return { success: false, error: 'Сервис временно недоступен.' };
          case 500:
            return { success: false, error: 'Ошибка сервера. Попробуйте позже.' };
          case 502:
          case 503:
          case 504:
            return { success: false, error: 'Сервис временно недоступен. Попробуйте позже.' };
          default:
            return { success: false, error: serverMessage || `Ошибка сервера (${statusCode})` };
        }
      }
      
      // Если нет статуса, но есть сообщение от сервера
      if (serverMessage) {
        return { success: false, error: serverMessage };
      }
      
      // Общая ошибка сети
      return {
        success: false,
        error: 'Не удалось подключиться к серверу. Проверьте интернет-соединение.',
      };
    }
  }

  async requestUnblock(userId) {
    try {
      const response = await this.axiosInstance.post(
        API_CONFIG.ENDPOINTS.UNBLOCK_REQUEST,
        {
          api_token: API_CONFIG.API_TOKEN,
          user_id: userId,
        },
        { headers: getApiTokenHeaders() }
      );

      if (response.data && response.data.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.data.message || 'Ошибка отправки запроса на разблокировку' };
      }
    } catch (error) {
      console.error('Request unblock error:', error);
      
      // Проверяем тип ошибки
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        return {
          success: false,
          error: 'Ошибка подключения к серверу. Проверьте интернет-соединение.',
        };
      }
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
          success: false,
          error: 'Превышено время ожидания ответа сервера. Попробуйте позже.',
        };
      }
      
      const statusCode = error?.response?.status;
      const serverMessage = error?.response?.data?.message;
      
      // Специальная обработка для заблокированного пользователя
      const isBlockedByStatus = statusCode === 423; // HTTP 423 Locked
      const isBlockedByMessage = typeof serverMessage === 'string' && /(block|заблок)/i.test(serverMessage);
      
      if (isBlockedByStatus || isBlockedByMessage) {
        return { success: false, error: 'Пользователь заблокирован. Обратитесь к администратору.' };
      }
      
      // Обработка HTTP ошибок
      if (statusCode) {
        switch (statusCode) {
          case 400:
            return { success: false, error: 'Неверный запрос. Проверьте данные.' };
          case 401:
            return { success: false, error: 'Не авторизован. Войдите в систему заново.' };
          case 403:
            return { success: false, error: 'Доступ запрещен.' };
          case 404:
            return { success: false, error: 'Сервис временно недоступен.' };
          case 500:
            return { success: false, error: 'Ошибка сервера. Попробуйте позже.' };
          case 502:
          case 503:
          case 504:
            return { success: false, error: 'Сервис временно недоступен. Попробуйте позже.' };
          default:
            return { success: false, error: serverMessage || `Ошибка сервера (${statusCode})` };
        }
      }
      
      // Если нет статуса, но есть сообщение от сервера
      if (serverMessage) {
        return { success: false, error: serverMessage };
      }
      
      // Общая ошибка сети
      return {
        success: false,
        error: 'Не удалось подключиться к серверу. Проверьте интернет-соединение.',
      };
    }
  }
}

export default new PunchService();

