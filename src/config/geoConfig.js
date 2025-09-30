// Конфигурация частоты геолокации для разных режимов
export const GEO_CONFIG = {
  // Тестовый режим (__DEV__ = true) - более агрессивные настройки для тестирования
  TEST_MODE: {
    // Дистанционный фильтр для BackgroundGeolocation (метры)
    DISTANCE_FILTER: 3, // Повышенная точность: шаг 3 метра
    
    // Heartbeat интервал для BackgroundGeolocation (секунды)
    HEARTBEAT_INTERVAL: 60, // Более частый heartbeat для тёплого старта
    
    // Максимальный возраст позиции (мс)
    MAX_AGE: 5000, // 5 секунд для тестирования

    // Настройки batch для dev режима - быстрые батчи
    AUTO_SYNC_THRESHOLD: 5, // Отправляем batch каждые 5 записей
    BATCH_SYNC: true,
    AUTO_SYNC: true,

    // Дополнительные настройки повышенной точности
    DISABLE_ELASTICITY: true,
  },
  
  // Обычный режим (продакшн) - более консервативные настройки для экономии батареи
  PRODUCTION_MODE: {
    // Дистанционный фильтр для BackgroundGeolocation (метры)
    DISTANCE_FILTER: 3, // Повышенная точность: шаг 3 метра
    
    // Heartbeat интервал для BackgroundGeolocation (секунды)
    HEARTBEAT_INTERVAL: 60, // 60 секунд — компромисс между точностью и батареей
    
    // Максимальный возраст позиции (мс)
    MAX_AGE: 10000, // 10 секунд для экономии батареи

    // Настройки batch для production режима - более консервативные
    AUTO_SYNC_THRESHOLD: 5, // Короткие батчи по 5 точек
    BATCH_SYNC: true,
    AUTO_SYNC: true,

    // Дополнительные настройки повышенной точности
    DISABLE_ELASTICITY: true,
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
