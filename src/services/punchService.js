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
        status: 1, // 1 = punch in (открытие смены)
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
        status: 0, // 0 = punch out (закрытие смены)
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

  // Новый метод для автоматического закрытия смены без фото
  async autoPunchOut(userId, phoneImei) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      
      console.log('=== AUTO PUNCH OUT ===');
      console.log('Auto-closing shift for user_id:', userId);
      console.log('Timestamp:', timestamp);
      
      const response = await this.axiosInstance.post(API_CONFIG.ENDPOINTS.PUNCH, {
        api_token: API_CONFIG.API_TOKEN,
        user_id: userId,
        timestamp: timestamp,
        status: 0, // 0 = punch out (закрытие смены)
        phone_imei: phoneImei,
        photo_name: 'auto_close_' + timestamp + '.jpg', // Автоматическое имя фото
      }, {
        headers: getApiTokenHeaders(),
      });

      console.log('Auto punch out response:', JSON.stringify(response.data, null, 2));

      if (response.data && response.data.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.data.message || 'Ошибка автоматического завершения смены' };
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



  // Метод для проверки статуса рабочего
  async getWorkerStatus(userId) {
    try {
      console.log('=== GET WORKER STATUS DEBUG ===');
      console.log('Requesting worker status for user_id:', userId);
      
      const response = await this.axiosInstance.get(
        API_CONFIG.ENDPOINTS.WORKER_STATUS,
        {
          params: {
            api_token: API_CONFIG.API_TOKEN,
            user_id: userId,
          },
          headers: getApiTokenHeaders(),
        }
      );

      console.log('Worker status response:', JSON.stringify(response.data, null, 2));
      console.log('=== END GET WORKER STATUS DEBUG ===');

      // Проверяем, что ответ содержит данные (API не возвращает success поле)
      if (response.data && (response.data.user_id || response.data.worker_status)) {
        return {
          success: true,
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.data?.message || 'Не удалось получить статус рабочего'
        };
      }
    } catch (error) {
      console.warn('Get worker status error:', error?.message || 'Unknown error');
      
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

  // Новый метод для проверки статуса смены согласно инструкции
  async getShiftStatus(userId) {
    try {
      console.log('=== GET SHIFT STATUS DEBUG ===');
      console.log('Requesting shift status for user_id:', userId);
      
      // Используем новый API endpoint согласно инструкции
      const response = await this.axiosInstance.get(
        `${API_CONFIG.ENDPOINTS.ACTIVE_SHIFT}/?user_id=${userId}`,
        { 
          headers: getApiTokenHeaders(),
          timeout: 5000 // 5 секунд таймаут
        }
      );
      
      console.log('Active shift response:', JSON.stringify(response.data, null, 2));
      console.log('=== END GET SHIFT STATUS DEBUG ===');
      
      // Анализируем данные согласно новому API
      const data = response.data;
      
      // Определяем статус смены
      const isShiftActive = data.has_active_shift || false;
      
      // Сохраняем успешный ответ в кэш
      global.cachedShiftStatus = {
        hasActiveShift: isShiftActive,
        timestamp: Date.now(),
        userId: userId,
        fullData: data
      };
      
      return {
        success: true,
        data: {
          is_working: isShiftActive,
          shift_active: isShiftActive,
          has_active_shift: data.has_active_shift,
          worker: data.worker,
          active_shift: data.active_shift,
          last_shift: data.last_shift
        }
      };
      
    } catch (error) {
      console.warn('Get shift status error:', error?.message || 'Unknown error');
      
      // Используем кэшированный статус при ошибках сети
      if (global.cachedShiftStatus && global.cachedShiftStatus.userId === userId) {
        const cacheAge = Date.now() - global.cachedShiftStatus.timestamp;
        const maxCacheAge = 5 * 60 * 1000; // 5 минут
        
        if (cacheAge < maxCacheAge) {
          console.log(`getShiftStatus: Using cached status (age: ${Math.round(cacheAge/1000)}s) for user ${userId}`);
          
          const cachedData = global.cachedShiftStatus.fullData || {};
          return {
            success: true,
            data: {
              is_working: global.cachedShiftStatus.hasActiveShift,
              shift_active: global.cachedShiftStatus.hasActiveShift,
              has_active_shift: global.cachedShiftStatus.hasActiveShift,
              worker: cachedData.worker,
              active_shift: cachedData.active_shift,
              last_shift: cachedData.last_shift
            }
          };
        } else {
          console.log(`getShiftStatus: Cached status too old (age: ${Math.round(cacheAge/1000)}s)`);
        }
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
      
      const statusCode = error?.response?.status;
      const serverMessage = error?.response?.data?.message;
      
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

