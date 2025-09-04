// Конфигурация частоты геолокации для разных режимов
export const GEO_CONFIG = {
  // Тестовый режим (__DEV__ = true)
  TEST_MODE: {
    // Интервал сбора геоданных в активном режиме (мс)
    ACTIVE_INTERVAL: 10 * 1000, // 10 секунд
    
    // Интервал сбора геоданных в фоновом режиме (мс)
    BACKGROUND_INTERVAL: 10 * 1000, // 10 секунд
    
    // Интервал отправки данных на сервер (мс)
    UPLOAD_INTERVAL: 30 * 1000, // 30 секунд
    
    // Дистанционный фильтр для BackgroundGeolocation (метры)
    DISTANCE_FILTER: 10, // 10 метров (уменьшено для более частых обновлений)
    
    // Heartbeat интервал для BackgroundGeolocation (секунды)
    HEARTBEAT_INTERVAL: 30, // 30 секунд (увеличено для уменьшения звуков)
    
    // Таймаут остановки (секунды) - 0 = не останавливаться
    STOP_TIMEOUT: 0,
    
    // Максимальный возраст позиции (мс)
    MAX_AGE: 10000, // 10 секунд (увеличено для уменьшения частоты)
  },
  
  // Обычный режим (продакшн)
  PRODUCTION_MODE: {
    // Интервал сбора геоданных в активном режиме (мс)
    ACTIVE_INTERVAL: 60 * 1000, // 1 минута
    
    // Интервал сбора геоданных в фоновом режиме (мс)
    BACKGROUND_INTERVAL: 60 * 1000, // 1 минута
    
    // Интервал отправки данных на сервер (мс)
    UPLOAD_INTERVAL: 5 * 60 * 1000, // 5 минут
    
    // Дистанционный фильтр для BackgroundGeolocation (метры)
    DISTANCE_FILTER: 100, // 100 метров (увеличено для продакшена)
    
    // Heartbeat интервал для BackgroundGeolocation (секунды)
    HEARTBEAT_INTERVAL: 60, // 60 секунд
    
    // Таймаут остановки (секунды) - 0 = не останавливаться
    STOP_TIMEOUT: 0,
    
    // Максимальный возраст позиции (мс)
    MAX_AGE: 30000, // 30 секунд
  }
};

// Функция для получения текущей конфигурации
export function getGeoConfig() {
  return __DEV__ ? GEO_CONFIG.TEST_MODE : GEO_CONFIG.PRODUCTION_MODE;
}

// Функция для получения конфигурации по режиму
export function getGeoConfigByMode(isTestMode) {
  return isTestMode ? GEO_CONFIG.TEST_MODE : GEO_CONFIG.PRODUCTION_MODE;
}
