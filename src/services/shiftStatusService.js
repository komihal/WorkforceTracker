import { API_CONFIG } from '../config/api';

// Безопасный парсинг JSON с логированием сырого ответа
async function readJsonSafe(response, contextLabel = 'response') {
  try {
    const text = await response.text();
    try {
      return { ok: true, data: JSON.parse(text), raw: text };
    } catch (parseError) {
      console.warn(`[ShiftStatus] JSON parse error in ${contextLabel}:`, parseError?.message || parseError);
      console.warn(`[ShiftStatus] Raw ${contextLabel} body:`, (text || '').slice(0, 500));
      return { ok: false, error: 'JSON parse error', raw: text };
    }
  } catch (e) {
    console.warn(`[ShiftStatus] Failed to read body in ${contextLabel}:`, e?.message || e);
    return { ok: false, error: 'Body read error' };
  }
}

class ShiftStatusManager {
  constructor(userId, deviceId) {
    this.userId = userId;
    this.deviceId = deviceId;
    this.statusUpdateCallback = null;
    
    console.log('[ShiftStatus] Manager created for user:', userId);
  }
  
  // Устанавливаем callback для обновления UI
  setStatusUpdateCallback(callback) {
    this.statusUpdateCallback = callback;
    console.log('[ShiftStatus] Callback set');
  }
  
  // Заглушки для совместимости с существующим кодом
  connect() {
    console.log('[ShiftStatus] Connect called - no polling, using on-demand requests');
  }
  
  startPolling() {
    console.log('[ShiftStatus] StartPolling called - polling disabled, using on-demand requests');
  }
  
  stopPolling() {
    console.log('[ShiftStatus] StopPolling called - polling disabled');
  }
  
  disconnect() {
    console.log('[ShiftStatus] Disconnect called');
    this.statusUpdateCallback = null;
  }
  
  // Обновление UI через callback
  updateUI(data) {
    console.log('=== UPDATING UI ===');
    console.log('Shift status data:', data);
    
    if (this.statusUpdateCallback) {
      this.statusUpdateCallback(data);
    }
  }
  
  // Переключение смены
  async toggleShift() {
    const currentStatus = await this.getCurrentStatus();
    const isStarting = !currentStatus.has_active_shift;
    
    console.log('=== TOGGLE SHIFT ===');
    console.log('Current status:', currentStatus);
    console.log('Is starting:', isStarting);
    
    return await this.sendPunch(isStarting ? 1 : 0);
  }
  
  // Получение текущего статуса смены
  async getCurrentStatus() {
    try {
      console.log('[ShiftStatus] Fetching current status for user:', this.userId);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/active-shift/?user_id=${this.userId}&api_token=${API_CONFIG.API_TOKEN}`, {
        headers: {
          'Content-Type': 'application/json',
          'Api-token': API_CONFIG.API_TOKEN,
        },
      });
      
      if (response.ok) {
        const parsed = await readJsonSafe(response, 'active-shift getCurrentStatus');
        if (parsed.ok) {
          console.log('[ShiftStatus] Status received:', parsed.data);
          return parsed.data;
        }
        console.log('[ShiftStatus] Failed to parse response');
        return { has_active_shift: false };
      }
      console.log('[ShiftStatus] HTTP error:', response.status, response.statusText);
      return { has_active_shift: false };
    } catch (error) {
      console.error('[ShiftStatus] Error getting current status:', error);
      return { has_active_shift: false };
    }
  }
  
  // Отправка punch (начало/конец смены)
  async sendPunch(status, photoName, tsOverride) {
    const timestamp = tsOverride || Math.floor(Date.now() / 1000);
    const punchData = {
      api_token: API_CONFIG.API_TOKEN,
      user_id: this.userId,
      status: status,
      timestamp: timestamp,
      phone_imei: this.deviceId,
      photo_name: photoName || `punch_${status}_${timestamp}.jpg`
    };
    
    console.log('=== SENDING PUNCH ===');
    console.log('Punch data:', punchData);
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/punch/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-token': API_CONFIG.API_TOKEN,
        },
        body: JSON.stringify(punchData)
      });
      
      const parsed = await readJsonSafe(response, 'punch');
      if (!parsed.ok) {
        console.log('Punch response (raw, not JSON):', parsed.raw ? parsed.raw.slice(0, 500) : '');
        return { success: false, error: parsed.error || 'Invalid server response' };
      }
      const result = parsed.data;
      console.log('Punch response:', result);
      
      if (result.success) {
        console.log('Punch отправлен успешно');
        
        // После успешного punch обновляем статус с задержкой и повторными попытками
        try {
          // Небольшая задержка, чтобы сервер успел обновить статус
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          let newStatus = await this.getCurrentStatus();
          console.log('[ShiftStatus] First status check after punch:', newStatus);
          
          // Если статус еще не обновился, делаем еще одну попытку через 2 секунды
          if (status === 1 && !newStatus.has_active_shift) {
            console.log('[ShiftStatus] Status not updated yet, retrying...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            newStatus = await this.getCurrentStatus();
            console.log('[ShiftStatus] Second status check after punch:', newStatus);
          } else if (status === 0 && newStatus.has_active_shift) {
            console.log('[ShiftStatus] Status not updated yet, retrying...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            newStatus = await this.getCurrentStatus();
            console.log('[ShiftStatus] Second status check after punch:', newStatus);
          }
          
          this.updateUI(newStatus);
        } catch (e) {
          console.log('[ShiftStatus] Failed to refresh status after punch:', e?.message || e);
        }
        
        return { success: true, data: result };
      } else {
        console.log('Ошибка punch:', result.error);
        return { success: false, error: result.error };
      }
      
    } catch (error) {
      console.error('Ошибка отправки punch:', error);
      return { success: false, error: error.message };
    }
  }
}

export default ShiftStatusManager;

// Функция для принудительного обновления статуса смены с обновлением store
export async function forceRefreshShiftStatus(userId) {
  try {
    console.log('[ShiftStatus] Force refresh requested for user:', userId);
    
    const status = await refreshShiftStatusNow(userId);
    
    // Импортируем и обновляем store
    const { setFromServer } = require('../store/shiftStore');
    setFromServer(status);
    
    console.log('[ShiftStatus] Force refresh completed:', status);
    return status;
  } catch (e) {
    console.log('[ShiftStatus] Force refresh error:', e?.message || e);
    return { has_active_shift: false };
  }
}

// Функция для обновления статуса смены по требованию
export async function refreshShiftStatusNow(userId) {
  try {
    console.log('[ShiftStatus] Manual refresh requested for user:', userId);
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/active-shift/?user_id=${userId}&api_token=${API_CONFIG.API_TOKEN}`, {
      headers: {
        'Content-Type': 'application/json',
        'Api-token': API_CONFIG.API_TOKEN,
      },
    });
    
    if (response.ok) {
      const parsed = await readJsonSafe(response, 'active-shift manual refresh');
      if (parsed.ok) {
        console.log('[ShiftStatus] Manual refresh successful:', parsed.data);
        return parsed.data;
      }
    }
    
    console.log('[ShiftStatus] Manual refresh failed');
    return { has_active_shift: false };
  } catch (e) {
    console.log('[ShiftStatus] Manual refresh error:', e?.message || e);
    return { has_active_shift: false };
  }
}