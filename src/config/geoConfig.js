// Конфигурация частоты геолокации для разных режимов
export const GEO_CONFIG = {
  // Тестовый режим (__DEV__ = true) - более агрессивные настройки для тестирования
  TEST_MODE: {
    // Дистанционный фильтр для BackgroundGeolocation (метры)
    DISTANCE_FILTER: 10, // 10 метров для точного контроля на стройке
    
    // Heartbeat интервал для BackgroundGeolocation (секунды)
    HEARTBEAT_INTERVAL: 120, // 120 секунд (2 минуты) для регулярной отправки геолокации
    
    // Максимальный возраст позиции (мс)
    MAX_AGE: 5000, // 5 секунд для тестирования
  },
  
  // Обычный режим (продакшн) - более консервативные настройки для экономии батареи
  PRODUCTION_MODE: {
    // Дистанционный фильтр для BackgroundGeolocation (метры)
    DISTANCE_FILTER: 5, // 5 метров для точного контроля на стройке
    
    // Heartbeat интервал для BackgroundGeolocation (секунды)
    HEARTBEAT_INTERVAL: 120, // 120 секунд (2 минуты) для регулярной отправки геолокации
    
    // Максимальный возраст позиции (мс)
    MAX_AGE: 10000, // 10 секунд для экономии батареи
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
