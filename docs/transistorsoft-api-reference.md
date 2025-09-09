# TransistorSoft Background Geolocation API Reference

## Основные методы

### Инициализация
```javascript
import BackgroundGeolocation from 'react-native-background-geolocation';

// Единая точка инициализации
await BackgroundGeolocation.ready({
  // Основные настройки
  reset: false,
  debug: false,
  logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
  
  // Лицензия
  license: 'YOUR_LICENSE_KEY',
  
  // Настройки точности
  desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
  distanceFilter: 10, // метров
  stationaryRadius: 25, // метров
  
  // Интервалы
  heartbeatInterval: 30, // секунд
  locationUpdateInterval: 1000, // миллисекунд
  fastestLocationUpdateInterval: 5000, // миллисекунд
  
  // Фоновый режим
  stopOnTerminate: false,
  startOnBoot: true,
  enableHeadless: true,
  foregroundService: true,
  preventSuspend: true, // iOS
  
  // Android специфичные
  notification: {
    title: 'Location Service',
    text: 'Tracking your location',
    color: '#000000',
    channelName: 'Location',
    priority: BackgroundGeolocation.NOTIFICATION_PRIORITY_LOW
  },
  
  // Автоматическая отправка
  autoSync: true,
  batchSync: true,
  syncUrl: 'https://your-api.com/locations',
  syncThreshold: 1,
  httpTimeout: 30000,
  
  // Параметры запроса
  params: {
    api_token: 'YOUR_API_TOKEN'
  },
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  
  // Трансформация данных
  transform: (location) => {
    return {
      lat: location.coords.latitude,
      lon: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: Math.floor(location.timestamp / 1000), // Unix timestamp в секундах
      speed: location.coords.speed,
      heading: location.coords.heading,
      altitude: location.coords.altitude
    };
  }
});
```

### Управление трекингом
```javascript
// Запуск трекинга
await BackgroundGeolocation.start();

// Остановка трекинга
await BackgroundGeolocation.stop();

// Получение текущего состояния
const state = await BackgroundGeolocation.getState();
console.log('BGGeo State:', state);

// Проверка включен ли трекинг
const isEnabled = await BackgroundGeolocation.getEnabled();
```

### Обработчики событий
```javascript
// Основные события
BackgroundGeolocation.onLocation((location) => {
  console.log('Location:', location);
  // location.coords.latitude
  // location.coords.longitude
  // location.coords.accuracy
  // location.timestamp
});

BackgroundGeolocation.onHeartbeat((heartbeat) => {
  console.log('Heartbeat:', heartbeat);
  // heartbeat.location
  // heartbeat.motion
});

BackgroundGeolocation.onSync((batch) => {
  console.log('Sync batch:', batch);
  // batch.length - количество записей
  // batch[0].location - данные локации
});

// Обработка ошибок
BackgroundGeolocation.onError((error) => {
  console.error('BGGeo Error:', error);
});

// Изменение состояния
BackgroundGeolocation.onMotionChange((motion) => {
  console.log('Motion changed:', motion);
  // motion.isMoving
  // motion.location
});

// Изменение активности
BackgroundGeolocation.onActivityChange((activity) => {
  console.log('Activity changed:', activity);
  // activity.activity
  // activity.confidence
});
```

### Headless Task (фоновый режим)
```javascript
// Регистрация headless task
await BackgroundGeolocation.registerHeadlessTask(async (event) => {
  const { name, params } = event;
  
  switch (name) {
    case 'location':
      console.log('Headless location:', params);
      break;
    case 'heartbeat':
      console.log('Headless heartbeat:', params);
      break;
    case 'sync':
      console.log('Headless sync:', params);
      break;
  }
});
```

### Работа с данными
```javascript
// Получение всех записей
const locations = await BackgroundGeolocation.getLocations();

// Получение текущей позиции
const location = await BackgroundGeolocation.getCurrentPosition({
  timeout: 30,
  maximumAge: 5000,
  enableHighAccuracy: true
});

// Очистка кэша
await BackgroundGeolocation.destroyLocations();

// Количество записей в очереди
const count = await BackgroundGeolocation.getCount();
```

### Настройки Android
```javascript
// Запрос игнорирования оптимизации батареи
await BackgroundGeolocation.requestIgnoreBatteryOptimizations();

// Проверка разрешений
const permissions = await BackgroundGeolocation.requestPermissions();

// Настройка уведомлений
await BackgroundGeolocation.setNotification({
  title: 'Location Service',
  text: 'Tracking your location',
  color: '#000000',
  channelName: 'Location',
  priority: BackgroundGeolocation.NOTIFICATION_PRIORITY_LOW
});
```

## Рекомендуемые настройки

### Для тестирования
```javascript
const TEST_CONFIG = {
  distanceFilter: 1,
  heartbeatInterval: 10,
  debug: true,
  logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE
};
```

### Для продакшена
```javascript
const PRODUCTION_CONFIG = {
  distanceFilter: 10,
  heartbeatInterval: 30,
  debug: false,
  logLevel: BackgroundGeolocation.LOG_LEVEL_ERROR
};
```

## Частые ошибки

### ❌ Неправильно
```javascript
// Множественные инициализации
await BackgroundGeolocation.ready(config1);
await BackgroundGeolocation.ready(config2); // ОШИБКА!

// Собственные HTTP-вызовы вместо встроенного uploader
fetch('/api/location', { method: 'POST', body: locationData }); // ОШИБКА!

// Слишком частые обновления
distanceFilter: 1, // ОШИБКА! Разряжает батарею
heartbeatInterval: 10, // ОШИБКА! Слишком часто
```

### ✅ Правильно
```javascript
// Единая инициализация
await BackgroundGeolocation.ready(config);

// Использование встроенного uploader
autoSync: true,
batchSync: true,
syncUrl: 'https://api.com/locations'

// Оптимальные настройки
distanceFilter: 10, // 10+ метров
heartbeatInterval: 30, // 30+ секунд
```

## Интеграция с проектом

### Структура файлов
```
src/
├── location.js          # Основная инициализация BGGeo
├── config/
│   ├── geoConfig.js     # Конфигурация интервалов
│   └── geoEndpointConfig.js # Настройки API
└── services/
    └── geoService.js    # Локальное кэширование
```

### Порядок инициализации
1. Проверка разрешений
2. Чтение лицензии из .env
3. BGGeo.ready() с полной конфигурацией
4. Регистрация обработчиков событий
5. Регистрация headless task
6. Запуск трекинга

### Обработка ошибок
```javascript
try {
  await BackgroundGeolocation.ready(config);
} catch (error) {
  console.error('BGGeo initialization failed:', error);
  // Fallback логика
}
```

## Ссылки на документацию

- [Официальная документация](https://transistorsoft.com/shop/products/react-native-background-geolocation)
- [API Reference](https://transistorsoft.com/shop/products/react-native-background-geolocation#api)
- [Configuration Options](https://transistorsoft.com/shop/products/react-native-background-geolocation#config)
- [Android Setup](https://transistorsoft.com/shop/products/react-native-background-geolocation#android-setup)
- [iOS Setup](https://transistorsoft.com/shop/products/react-native-background-geolocation#ios-setup)
