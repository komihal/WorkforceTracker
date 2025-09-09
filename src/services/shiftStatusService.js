import { API_CONFIG } from '../config/api';
// import { fetchWithTimeout } from '../utils/net';

// Single-instance поллер для всего приложения
let globalPollTimer = null;
let globalInFlight = false;
let globalLastRun = 0;
let globalStatusUpdateCallback = null;
let globalUserId = null;

const POLL_MIN_INTERVAL_MS = 30000; // 30s - увеличиваем интервал для снижения нагрузки
const POLL_TIMEOUT_MS = 10000;      // timeout для запроса
const RETRY_BACKOFF_MS = 60000;     // 60s при ошибке - увеличиваем backoff

function now() { return Date.now(); }

async function pollShiftStatusOnce(controller) {
  if (globalInFlight) return; // drop если предыдущий не завершился
  const t = now();
  if (t - globalLastRun < POLL_MIN_INTERVAL_MS) return; // троттлинг
  globalInFlight = true;
  globalLastRun = t;
  try {
    console.log('[ShiftPoll] Fetching status...');
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/active-shift/?user_id=${globalUserId}&api_token=${API_CONFIG.API_TOKEN}`, 
      {
        headers: {
          'Content-Type': 'application/json',
          'Api-token': API_CONFIG.API_TOKEN,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('[ShiftPoll] Shift status API response:', data);
    
    if (globalStatusUpdateCallback) {
      globalStatusUpdateCallback(data);
    }
  } catch (e) {
    console.log('[ShiftPoll] error → backoff', e?.message || e);
    // при ошибке — поднимем «паузу» до backoff
    globalLastRun = now() - (POLL_MIN_INTERVAL_MS - RETRY_BACKOFF_MS);
  } finally {
    globalInFlight = false;
  }
}

function startGlobalShiftPolling(userId, callback) {
  if (globalPollTimer) {
    console.log('[ShiftPoll] Already running, updating callback');
    globalStatusUpdateCallback = callback;
    return () => {}; // пустой стоппер
  }
  globalUserId = userId;
  globalStatusUpdateCallback = callback;
  const controller = new AbortController();
  globalPollTimer = setInterval(() => {        // тик раз в 1s, но реальный вызов — по троттлингу
    pollShiftStatusOnce(controller);
  }, 1000);
  // немедленный первый запуск
  pollShiftStatusOnce(controller);
  console.log('[ShiftPoll] started');
  return () => {
    try { controller.abort(); } catch {}
    if (globalPollTimer) { clearInterval(globalPollTimer); globalPollTimer = null; }
    globalInFlight = false;
    globalStatusUpdateCallback = null;
    globalUserId = null;
    console.log('[ShiftPoll] stopped');
  };
}

function stopGlobalShiftPolling() {
  if (globalPollTimer) { clearInterval(globalPollTimer); globalPollTimer = null; }
  globalInFlight = false;
  globalStatusUpdateCallback = null;
  globalUserId = null;
  console.log('[ShiftPoll] stopped (manual)');
}

class ShiftStatusManager {
  constructor(userId, deviceId) {
    this.userId = userId;
    this.deviceId = deviceId;
    this.websocket = null;
    this.isConnected = false;
    this.statusUpdateCallback = null;
    this.stopPollingFn = null;
    
    this.connect();
  }
  
  // Устанавливаем callback для обновления UI
  setStatusUpdateCallback(callback) {
    this.statusUpdateCallback = callback;
  }
  
  connect() {
    // ВРЕМЕННО ОТКЛЮЧАЕМ WEBSOCKET - используем только polling
    console.log('WebSocket temporarily disabled - using polling only');
    console.log('Starting shift status polling...');
    this.startPolling();
  }
  
  startPolling() {
    if (this.stopPollingFn) return; // уже запущен
    
    console.log('[ShiftPoll] Starting global polling for user:', this.userId);
    this.stopPollingFn = startGlobalShiftPolling(this.userId, (data) => {
      this.updateUI(data);
    });
  }
  
  stopPolling() {
    if (this.stopPollingFn) {
      this.stopPollingFn();
      this.stopPollingFn = null;
    }
  }
  
  
  updateUI(data) {
    console.log('=== UPDATING UI ===');
    console.log('Shift status data:', data);
    
    if (this.statusUpdateCallback) {
      this.statusUpdateCallback(data);
    }
  }
  
  async toggleShift() {
    const currentStatus = await this.getCurrentStatus();
    const isStarting = !currentStatus.has_active_shift;
    
    console.log('=== TOGGLE SHIFT ===');
    console.log('Current status:', currentStatus);
    console.log('Is starting:', isStarting);
    
    await this.sendPunch(isStarting ? 1 : 0);
  }
  
  async getCurrentStatus() {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/active-shift/?user_id=${this.userId}&api_token=${API_CONFIG.API_TOKEN}`, {
        headers: {
          'Content-Type': 'application/json',
          'Api-token': API_CONFIG.API_TOKEN,
        },
      });
      
      if (response.ok) {
        return await response.json();
      }
      return { has_active_shift: false };
    } catch (error) {
      console.error('Error getting current status:', error);
      return { has_active_shift: false };
    }
  }
  
  async sendPunch(status) {
    const timestamp = Math.floor(Date.now() / 1000);
    const punchData = {
      api_token: API_CONFIG.API_TOKEN,
      user_id: this.userId,
      status: status,
      timestamp: timestamp,
      phone_imei: this.deviceId,
      photo_name: `punch_${status}_${timestamp}.jpg`
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
      
      const result = await response.json();
      console.log('Punch response:', result);
      
      if (result.success) {
        console.log('Punch отправлен успешно');
        // WebSocket или polling автоматически обновит UI
        // Дополнительно форсим немедленную проверку статуса, чтобы UI обновился без задержки троттлинга
        try {
          // сбрасываем троттлинг и запускаем опрос прямо сейчас
          globalLastRun = 0;
          await pollShiftStatusOnce(new AbortController());
        } catch (e) {
          console.log('[ShiftPoll] immediate post-punch poll failed:', e?.message || e);
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
  
  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.stopPolling();
    this.isConnected = false;
  }
}

export default ShiftStatusManager;
