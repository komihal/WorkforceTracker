# BG Geolocation Refactor - Final Implementation

## Обзор изменений

Этот документ описывает финальную реализацию рефакторинга BG Geolocation согласно уточненному Cursor-промпту. Все изменения направлены на создание единой точки инициализации, использование встроенного uploader'а BG и устранение дублей/таймеров.

## Что было сделано

### 1. Единый сервис BG Geo
- **Создан**: `src/services/bgGeo/location.ts`
  - Экспортирует: `initBgGeo()`, `startTracking()`, `stopTracking()`, `getState()`, `getCurrentPosition()`, `runSmokeTest()`
  - Использует конфигурацию из `.env` (без хардкодов)
  - TEST/PROD значения: `distanceFilter=5/10`, `heartbeatInterval=30/60`, `stopTimeout=1/5`
  - Включает `preventSuspend: true` (iOS), `foregroundService: true` (Android)
  - Transform добавляет `user_id` к каждой точке, возвращает `null` если нет userId

- **Создан**: `src/services/bgGeo/headless.ts`
  - Единая регистрация `BackgroundGeolocation.registerHeadlessTask()`
  - Только логирование, без сетевых вызовов

### 2. Утилита батареи
- **Создан**: `src/utils/batteryOptimization.ts`
  - `requestIgnoreBatteryOptimizations()` для Android
  - При отказе открывает системные настройки

### 3. Удаление хардкодов
- Убраны все хардкоды лицензий из `src/location.js`
- Убраны хардкоды IMEI из всех файлов
- Все значения теперь читаются из `.env` через `react-native-config`

### 4. Обновление манифестов
- **Android**: добавлен `ACTIVITY_RECOGNITION` permission
- **iOS**: уже содержал `NSMotionUsageDescription` и `UIBackgroundModes: processing`

### 5. Legacy совместимость
- `postLocation()` помечен как LEGACY и отключен по умолчанию
- Можно включить через `USE_LEGACY_POST_LOCATION=true` в `.env`
- При использовании выводит предупреждения в лог

### 6. Конфигурация
- **Создан**: `env.template` с шаблоном переменных окружения
- Все настройки вынесены в `.env` файл

## Файлы изменений

### Созданные файлы
- `src/services/bgGeo/location.ts` - единый сервис BG Geo
- `src/services/bgGeo/headless.ts` - headless task
- `src/utils/batteryOptimization.ts` - утилита батареи
- `env.template` - шаблон переменных окружения
- `docs/bg-geo-refactor-apply.md` - эта документация

### Измененные файлы
- `src/location.js` - убраны хардкоды лицензий
- `src/api.js` - добавлен legacy postLocation с флагом
- `src/utils/deviceUtils.js` - IMEI из .env
- `src/components/MainScreen.js` - реальный IMEI
- `src/examples/apiExamples.js` - IMEI из .env
- `android/app/src/main/AndroidManifest.xml` - добавлен ACTIVITY_RECOGNITION
- `index.js` - импорт headless task
- `App.js` - использование нового сервиса

### Удаленные участки
- Все `postLocation()` вызовы из `onLocation/onHeartbeat` listener'ов
- Все `setInterval` и периодические таймеры
- Дублирующие BGGeo инициализации из `backgroundService.js`
- Хардкоды лицензий и IMEI

## Как проверить

### Автотесты (выполнить руками)
1. **Единая инициализация**: BG инициализируется ровно один раз
2. **Headless работа**: После убийства приложения и перезагрузки устройства — при движении точки отправляются
3. **Оффлайн→онлайн**: Копятся и досылаются пачкой (onHttp OK)
4. **Фоновая работа**: Экран погашен 30+ минут — при движении точки идут без таймеров
5. **Нет ручных вызовов**: В логах нет ручных fetch/axios из onLocation/onHeartbeat
6. **TEST/PROD различие**: Конфигурации различаются по частоте

### Логи для проверки
```bash
# Android
adb logcat -c && adb logcat -v time -s TSLocationManager ReactNativeJS | head -100

# Отключить doze на время тестов
adb shell dumpsys deviceidle disable

# Проверить appops на фоновые локации
adb shell cmd appops get com.workforcetracker ACCESS_BACKGROUND_LOCATION
adb shell cmd appops set com.workforcetracker ACCESS_BACKGROUND_LOCATION allow
```

## Настройка .env

Скопируйте `env.template` в `.env` и заполните:

```bash
# BG Geolocation Licenses
BG_GEO_LICENSE_ANDROID=your_android_license_here
BG_GEO_LICENSE_IOS=your_ios_license_here

# API Configuration
API_URL=https://api.tabelshik.com
API_TOKEN=your_api_token_here
BG_WEBHOOK_URL=https://api.tabelshik.com/db_save/

# Device Configuration
DEVICE_IMEI=your_device_imei_here

# Legacy Configuration (optional)
USE_LEGACY_POST_LOCATION=false
```

## Флаги конфигурации

- `USE_LEGACY_POST_LOCATION=true` - включить legacy postLocation (не рекомендуется)
- `__DEV__` - автоматически определяет TEST/PROD режим

## Места удаления ручных вызовов

- `src/location.js`: убраны все `postLocation()` из `onLocation/onHeartbeat`
- `src/services/backgroundService.js`: убраны все интервалы и BGGeo инициализация
- `src/api.js`: `postLocation()` помечен как LEGACY и отключен по умолчанию

## Подтверждение отсутствия повторной инициализации

Поиск по репозиторию показывает, что `BackgroundGeolocation.ready()` и `BackgroundGeolocation.start()` вызываются только в:
- `src/services/bgGeo/location.ts` (основной сервис)
- `src/tests/bggeoSmokeTest.ts` (тесты)

Никаких дублей в других файлах не найдено.

## TODO (если что-то не получилось автоматически)

Если при автоматическом рефакторинге что-то не получилось, ищите комментарии `// TODO(Cursor):` в коде и добавьте пункты в PR-описание.

## Результат

Теперь BG Geolocation работает через единую точку инициализации с встроенным uploader'ом, без дублей и лишних интервалов. Конфигурации разделены на TEST/PROD с разумными значениями для экономии батареи. Все хардкоды удалены, добавлена legacy совместимость.
