# Устранение спама запросов геолокации

## Проблема
Приложение спамит запросами геолокации - в логах видно множественные отправки webhook в течение одной секунды:

```
[WEBHOOK] Successfully sent location
[17:45:04] Location sent successfully via webhook
[17:45:04] Batch upload disabled - location sent only via direct API
[WEBHOOK] Successfully sent location
[17:45:04] Location sent successfully via webhook
[17:45:04] Batch upload disabled - location sent only via direct API
```

## Причина
BackgroundGeolocation генерирует события `onLocation` слишком часто, и каждый раз срабатывает обработчик, который отправляет геолокацию на webhook/API без проверки времени последней отправки.

## Решение

### 1. Добавлен Throttling в `src/location.js`

```javascript
let lastLocationSent = 0; // Время последней отправки геолокации
const LOCATION_SEND_THROTTLE = 10000; // Минимум 10 секунд между отправками

// В обработчике onLocation:
if (now - lastLocationSent < LOCATION_SEND_THROTTLE) {
  console.log(`Location throttled - too soon since last send`);
  return;
}
```

### 2. Увеличены настройки BackgroundGeolocation

#### `src/config/geoConfig.js`:
```javascript
TEST_MODE: {
  DISTANCE_FILTER: 50,        // Увеличено с 20 до 50 метров
  HEARTBEAT_INTERVAL: 30,     // Увеличено с 10 до 30 секунд
  MAX_AGE: 10000,            // 10 секунд
}
```

## Как работает Throttling

1. **Проверка времени**: При получении события геолокации проверяется, прошло ли 10 секунд с последней отправки
2. **Блокировка**: Если прошло меньше 10 секунд, событие игнорируется
3. **Отправка**: Если прошло 10+ секунд, геолокация отправляется
4. **Обновление времени**: После успешной отправки обновляется время последней отправки

## Логи после исправления

Теперь в консоли должны быть видны:

```
[17:45:04] Location received in location.js: {lat: 55.7558, lon: 37.6176, ...}
[17:45:04] Sending location via webhook...
[17:45:04] Location sent successfully via webhook
[17:45:04] Batch upload disabled - location sent only via direct API

[17:45:05] Location throttled - too soon since last send (1s ago)
[17:45:06] Location throttled - too soon since last send (2s ago)
[17:45:07] Location throttled - too soon since last send (3s ago)
...
[17:45:14] Location received in location.js: {lat: 55.7558, lon: 37.6176, ...}
[17:45:14] Sending location via webhook...
[17:45:14] Location sent successfully via webhook
```

## Ожидаемая частота

- **Минимальная**: 10 секунд (throttling)
- **Фактическая**: 30 секунд (heartbeatInterval)
- **При движении**: При перемещении на 50+ метров
- **В покое**: Каждые 30 секунд

## Дополнительные настройки

Если спам все еще происходит, можно:

1. **Увеличить throttling**:
   ```javascript
   const LOCATION_SEND_THROTTLE = 30000; // 30 секунд
   ```

2. **Увеличить heartbeatInterval**:
   ```javascript
   HEARTBEAT_INTERVAL: 60, // 60 секунд
   ```

3. **Увеличить distanceFilter**:
   ```javascript
   DISTANCE_FILTER: 100, // 100 метров
   ```

## Проверка работы

1. **Запустите приложение** в режиме разработки
2. **Проверьте логи** в консоли Metro/React Native
3. **Должны быть видны** сообщения "Location throttled" для частых событий
4. **Геолокация должна отправляться** не чаще чем каждые 10 секунд
5. **В webhook** должны приходить запросы с интервалом 10+ секунд

## Отключение throttling

Если нужно отключить throttling (не рекомендуется):

```javascript
// В src/location.js закомментировать проверку:
// if (now - lastLocationSent < LOCATION_SEND_THROTTLE) {
//   console.log(`Location throttled - too soon since last send`);
//   return;
// }
```
