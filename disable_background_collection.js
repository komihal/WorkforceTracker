// Скрипт для отключения фонового сбора данных
// Запустите этот скрипт в консоли React Native для остановки фоновых запросов

import backgroundService from './src/services/backgroundService';

console.log('🛑 Отключение фонового сбора данных...');

// Останавливаем фоновый сервис
backgroundService.disableBackgroundCollection();

// Очищаем очереди
backgroundService.pendingPhotos = [];
backgroundService.pendingGeoData = [];
backgroundService.savePendingData();

console.log('✅ Фоновый сбор данных отключен');
console.log('📊 Статистика:', backgroundService.getStats());

// Для повторного включения используйте:
// backgroundService.enableBackgroundCollection();

