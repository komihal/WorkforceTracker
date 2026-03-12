import { API_CONFIG } from '../config/api';
import { setCachedShiftStatus, getCachedShiftStatus } from '../store/shiftStore';
import httpClient from '../api/httpClient';
import { normalizeApiError } from '../utils/apiError';

function genIdemp() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

class PunchService {
  async punchIn(userId, phoneImei, photoName) {
    try {
      const response = await httpClient.post(API_CONFIG.ENDPOINTS.PUNCH, {
        api_token: API_CONFIG.API_TOKEN,
        user_id: userId,
        timestamp: Math.floor(Date.now() / 1000),
        status: 1,
        phone_imei: phoneImei,
        photo_name: photoName,
      }, {
        headers: { 'Idempotency-Key': genIdemp() },
      });

      if (response.data?.success) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.data?.message || 'Ошибка начала смены' };
    } catch (error) {
      return normalizeApiError(error, { checkBlocked: true });
    }
  }

  async punchOut(userId, phoneImei, photoName) {
    try {
      const response = await httpClient.post(API_CONFIG.ENDPOINTS.PUNCH, {
        api_token: API_CONFIG.API_TOKEN,
        user_id: userId,
        timestamp: Math.floor(Date.now() / 1000),
        status: 0,
        phone_imei: phoneImei,
        photo_name: photoName,
      }, {
        headers: { 'Idempotency-Key': genIdemp() },
      });

      if (response.data?.success) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.data?.message || 'Ошибка завершения смены' };
    } catch (error) {
      return normalizeApiError(error, { checkBlocked: true });
    }
  }

  async autoPunchOut(userId, phoneImei) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const response = await httpClient.post(API_CONFIG.ENDPOINTS.PUNCH, {
        api_token: API_CONFIG.API_TOKEN,
        user_id: userId,
        timestamp,
        status: 0,
        phone_imei: phoneImei,
        photo_name: `auto_close_${timestamp}.jpg`,
      }, {
        headers: { 'Idempotency-Key': genIdemp() },
      });

      if (response.data?.success) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.data?.message || 'Ошибка автоматического завершения смены' };
    } catch (error) {
      return normalizeApiError(error, { checkBlocked: true });
    }
  }

  async getWorkerStatus(userId) {
    try {
      const response = await httpClient.get(API_CONFIG.ENDPOINTS.WORKER_STATUS, {
        params: {
          api_token: API_CONFIG.API_TOKEN,
          user_id: userId,
        },
      });

      if (response.data && (response.data.user_id || response.data.worker_status)) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.data?.message || 'Не удалось получить статус рабочего' };
    } catch (error) {
      return normalizeApiError(error);
    }
  }

  async getShiftStatus(userId) {
    try {
      const response = await httpClient.get(
        `${API_CONFIG.ENDPOINTS.ACTIVE_SHIFT}/?user_id=${userId}`,
        { timeout: 5000 }
      );

      const data = response.data;
      const isShiftActive = data.has_active_shift || false;

      setCachedShiftStatus({
        hasActiveShift: isShiftActive,
        timestamp: Date.now(),
        userId,
        fullData: data,
      });

      return {
        success: true,
        data: {
          is_working: isShiftActive,
          shift_active: isShiftActive,
          has_active_shift: data.has_active_shift,
          worker: data.worker,
          active_shift: data.active_shift,
          last_shift: data.last_shift,
        },
      };
    } catch (error) {
      const cached = getCachedShiftStatus();
      if (cached && cached.userId === userId) {
        const cacheAge = Date.now() - cached.timestamp;
        const maxCacheAge = 5 * 60 * 1000;

        if (cacheAge < maxCacheAge) {
          const cachedData = cached.fullData || {};
          return {
            success: true,
            data: {
              is_working: cached.hasActiveShift,
              shift_active: cached.hasActiveShift,
              has_active_shift: cached.hasActiveShift,
              worker: cachedData.worker,
              active_shift: cachedData.active_shift,
              last_shift: cachedData.last_shift,
            },
          };
        }
      }

      return normalizeApiError(error);
    }
  }

  async requestUnblock(userId) {
    try {
      const response = await httpClient.post(API_CONFIG.ENDPOINTS.UNBLOCK_REQUEST, {
        api_token: API_CONFIG.API_TOKEN,
        user_id: userId,
      });

      if (response.data?.success) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.data?.message || 'Ошибка отправки запроса на разблокировку' };
    } catch (error) {
      return normalizeApiError(error, { checkBlocked: true });
    }
  }
}

export default new PunchService();
