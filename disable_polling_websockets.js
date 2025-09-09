// Временное отключение polling и websockets для стабилизации приложения
// Этот файл можно импортировать для полного отключения этих функций

export const DISABLE_POLLING = false; // Включаем polling для работы смен
export const DISABLE_WEBSOCKETS = true; // Оставляем websockets отключенными

// Функция для проверки, отключены ли polling и websockets
export function isPollingDisabled() {
  return DISABLE_POLLING;
}

export function isWebSocketsDisabled() {
  return DISABLE_WEBSOCKETS;
}

// Заглушки для отключенных функций
export const disabledShiftStatusManager = {
  connect: () => {
    console.log('[DISABLED] ShiftStatusManager.connect() - polling and websockets disabled');
  },
  startPolling: () => {
    console.log('[DISABLED] ShiftStatusManager.startPolling() - polling disabled');
  },
  stopPolling: () => {
    console.log('[DISABLED] ShiftStatusManager.stopPolling() - polling disabled');
  },
  disconnect: () => {
    console.log('[DISABLED] ShiftStatusManager.disconnect() - polling and websockets disabled');
  },
  setStatusUpdateCallback: (callback) => {
    console.log('[DISABLED] ShiftStatusManager.setStatusUpdateCallback() - polling disabled');
  },
  updateUI: (data) => {
    console.log('[DISABLED] ShiftStatusManager.updateUI() - polling disabled');
  },
  toggleShift: async () => {
    console.log('[DISABLED] ShiftStatusManager.toggleShift() - polling disabled');
    return { success: false, error: 'Polling disabled' };
  },
  getCurrentStatus: async () => {
    console.log('[DISABLED] ShiftStatusManager.getCurrentStatus() - polling disabled');
    return { has_active_shift: false };
  },
  sendPunch: async (status) => {
    console.log('[DISABLED] ShiftStatusManager.sendPunch() - polling disabled');
    return { success: false, error: 'Polling disabled' };
  }
};

console.log('Polling enabled, WebSockets disabled for stability');
