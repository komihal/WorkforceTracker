# BGGeo Batch Monitoring & Remote Logging

## Обзор

Данный документ описывает систему мониторинга batch-отправок BGGeo и удалённого сбора логов с устройств, реализованную согласно рекомендациям Transistorsoft.

## Мониторинг Batch-отправок

### 1. Определение Batch-запросов в Webhook'ах

#### Через onHttp событие:
```javascript
BGGeo.onHttp(async (r) => {
  // Анализ requestBody для определения batch
  if (r.requestBody) {
    const batchData = JSON.parse(r.requestBody);
    if (batchData.geo_array && Array.isArray(batchData.geo_array)) {
      const recordCount = batchData.geo_array.length;
      console.log('📦 BATCH DETECTED:', recordCount, 'records');
    }
  }
  
  // Анализ responseText для определения batch
  if (r.responseText) {
    const responseData = JSON.parse(r.responseText);
    if (responseData.geo_data_saved && responseData.geo_data_saved > 1) {
      console.log('📦 BATCH DETECTED FROM RESPONSE:', responseData.geo_data_saved, 'records');
    }
  }
});
```

#### Через onSync событие (если доступен):
```javascript
if (BGGeo.onSync) {
  BGGeo.onSync((batch) => {
    console.log('📦 BGEO BATCH SYNC EVENT:', batch.length, 'records');
    
    // Отправка в мониторинговый webhook
    postBgEvent('batch_sync', {
      batchSize: batch.length,
      timestamp: new Date().toISOString(),
      firstLocation: batch[0] ? {
        lat: batch[0].coords?.latitude,
        lon: batch[0].coords?.longitude,
        timestamp: batch[0].timestamp
      } : null,
      lastLocation: batch[batch.length - 1] ? {
        lat: batch[batch.length - 1].coords?.latitude,
        lon: batch[batch.length - 1].coords?.longitude,
        timestamp: batch[batch.length - 1].timestamp
      } : null
    });
  });
}
```

### 2. Типы Webhook-событий

#### Основные события:
- `native_uploader` - HTTP-запросы нативного uploader'а
- `batch_sync` - Batch-отправки через onSync
- `queue_status` - Статус очереди записей
- `location` - Отдельные события местоположения
- `heartbeat` - Heartbeat события
- `motionchange` - Изменения движения
- `activitychange` - Изменения активности
- `connectivity` - Изменения сетевого подключения

#### Структура webhook-данных:
```json
{
  "type": "native_uploader",
  "timestamp": "2025-09-30T14:50:00.000Z",
  "data": {
    "url": "https://api.tabelshik.com/api/db_save/",
    "status": 201,
    "recordCount": 10,
    "batchSize": 10,
    "isBatchRequest": true,
    "success": true,
    "responseText": "{\"success\":true,\"message\":\"GeoData saved successfully\",\"geo_data_saved\":10}"
  }
}
```

## Удалённый сбор логов

### 1. Функции для удалённого логирования

#### logToRemote() - Локальное логирование
```javascript
logToRemote('BGGeo configured: autoSync=true, batchSync=true, threshold=10', 'info');
logToRemote('Native uploader error: status 500', 'error');
```

#### sendRemoteLogs() - Отправка логов на сервер
```javascript
await sendRemoteLogs();
```

### 2. Автоматическая отправка логов

Логи автоматически отправляются каждые 5 минут на endpoint:
```
POST https://api.tabelshik.com/webhook/logs
```

#### Структура данных логов:
```json
{
  "type": "remote_logs",
  "timestamp": "2025-09-30T14:50:00.000Z",
  "deviceInfo": {
    "platform": "android",
    "version": "13",
    "bgGeoState": { "autoSync": true, "batchSync": true },
    "bgGeoEnabled": true,
    "bgGeoCount": 5
  },
  "bgLogs": "BGGeo internal logs...",
  "appLogs": [
    {
      "timestamp": "2025-09-30T14:49:00.000Z",
      "level": "info",
      "message": "BGGeo configured: autoSync=true"
    }
  ]
}
```

### 3. Ручная отправка логов

Для ручной отправки логов можно использовать глобальные функции:
```javascript
// Отправить логи сейчас
global.sendRemoteLogs();

// Добавить лог в очередь
global.logToRemote('Custom log message', 'info');
```

## Конфигурация

### 1. Включение/отключение мониторинга

В файле `.env`:
```
WEBHOOK_MONITOR=1  # Включить мониторинг (по умолчанию)
WEBHOOK_MONITOR=0  # Отключить мониторинг
```

### 2. Настройка BGGeo для batch-отправки

```javascript
await BGGeo.ready({
  autoSync: true,
  batchSync: true,
  autoSyncThreshold: 10,  // Отправлять каждые 10 записей
  url: 'https://api.tabelshik.com/api/db_save/',
  httpRootProperty: "geo_array",
  locationTemplate: `{
    "lat": <%= latitude %>,
    "lon": <%= longitude %>,
    "accuracy": <%= accuracy %>
  }`
});
```

## Мониторинг на сервере

### 1. Endpoints для мониторинга

#### Основные события:
```
POST https://api.tabelshik.com/webhook/
```

#### Логи:
```
POST https://api.tabelshik.com/webhook/logs
```

### 2. Анализ batch-событий

#### Критерии определения batch:
1. **requestBody содержит geo_array** - массив записей
2. **responseText содержит geo_data_saved > 1** - сервер сохранил несколько записей
3. **recordCount > 1** - количество записей больше одной

#### Пример анализа на сервере:
```javascript
app.post('/webhook/', (req, res) => {
  const { type, data } = req.body;
  
  if (type === 'native_uploader') {
    if (data.isBatchRequest || data.recordCount > 1) {
      console.log(`📦 BATCH DETECTED: ${data.recordCount} records`);
      // Обработка batch-события
    } else {
      console.log(`📍 SINGLE RECORD: 1 record`);
      // Обработка одиночной записи
    }
  }
  
  res.status(200).json({ success: true });
});
```

## Рекомендации Transistorsoft

### 1. Использование встроенных механизмов
- ✅ Используйте `autoSync` и `batchSync` вместо собственных HTTP-вызовов
- ✅ Мониторьте через `onHttp` и `onSync` события
- ✅ Используйте `getLog()` для получения внутренних логов BGGeo

### 2. Оптимизация производительности
- ✅ Настройте `autoSyncThreshold` в зависимости от требований
- ✅ Используйте `httpRootProperty: "geo_array"` для batch-формата
- ✅ Настройте `locationTemplate` для оптимизации размера запросов

### 3. Мониторинг и отладка
- ✅ Реализуйте удалённый сбор логов для диагностики
- ✅ Мониторьте статус очереди через `getCount()`
- ✅ Отслеживайте изменения состояния через события

## Troubleshooting

### 1. Batch не определяется
- Проверьте конфигурацию `autoSync` и `batchSync`
- Убедитесь, что `autoSyncThreshold` установлен правильно
- Проверьте логи на наличие ошибок HTTP-запросов

### 2. Логи не отправляются
- Проверьте доступность endpoint'а `/webhook/logs`
- Убедитесь, что `WEBHOOK_MONITOR=1` в .env
- Проверьте сетевые ограничения на устройстве

### 3. Производительность
- Настройте интервал отправки логов (по умолчанию 5 минут)
- Ограничьте размер локальных логов (по умолчанию 1000 записей)
- Используйте троттлинг для частых событий
