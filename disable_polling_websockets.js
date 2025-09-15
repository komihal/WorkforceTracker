// Файл больше не нужен - polling полностью удален из проекта
// Оставляем для совместимости, но все функции теперь работают без polling

export const DISABLE_POLLING = true; // Polling полностью отключен
export const DISABLE_WEBSOCKETS = true; // WebSockets отключены

// Функции для совместимости
export function isPollingDisabled() {
  return true; // Polling всегда отключен
}

export function isWebSocketsDisabled() {
  return true; // WebSockets всегда отключены
}

// Заглушки больше не нужны - используем обычный ShiftStatusManager
console.log('Polling and WebSockets permanently disabled - using on-demand requests only');