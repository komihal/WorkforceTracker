# Обновление конфигурации согласно документации Transistorsoft

## Внесенные изменения

### 1. Добавлена конфигурация Notification Channel (Android O+)
**Файл:** `src/location.js`
```javascript
notification: {
  title: "Отслеживание включено",
  text: "Передача геоданных активна",
  channelName: "Tracking",
  smallIcon: "ic_launcher",
  priority: BGGeo.NOTIFICATION_PRIORITY_HIGH
},
```

### 2. Добавлен Background Permission Rationale (Android 10+)
**Файл:** `src/location.js`
```javascript
backgroundPermissionRationale: {
  title: "Нужно 'Всегда' для трекинга",
  message: "Чтобы фиксировать маршруты и акты вне приложения, включите 'Разрешать всегда'.",
  positiveAction: "Перейти в настройки"
},
```

### 3. Добавлена проверка Battery Optimization через Transistorsoft
**Файл:** `src/location.js`
```javascript
// Дополнительная проверка через встроенные методы Transistorsoft
setTimeout(async () => {
  try {
    console.log('[BG] Checking battery optimization via Transistorsoft methods...');
    const ignoring = await BGGeo.deviceSettings.isIgnoringBatteryOptimizations();
    if (!ignoring) {
      console.log('[BG] Battery optimization is enabled - showing Transistorsoft dialog...');
      await BGGeo.deviceSettings.showIgnoreBatteryOptimizations();
    } else {
      console.log('[BG] Battery optimization already disabled via Transistorsoft ✓');
    }
  } catch (error) {
    console.log('[BG] Transistorsoft battery optimization check failed:', error);
  }
}, 4000);
```

### 4. Добавлено разрешение FOREGROUND_SERVICE_LOCATION
**Файл:** `android/app/src/main/AndroidManifest.xml`
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

## Соответствие документации Transistorsoft

### ✅ Реализовано согласно документации:

1. **Foreground Service + Notification Channel** - Android O+ создаст канал автоматически
2. **Background Permission Rationale** - покажет системный диалог для "Allow all the time"
3. **HTTP-отправка без JS-таймеров** - используется `url` + `autoSync` + `batchSync`
4. **Headless-режим** - включен `enableHeadless: true`
5. **Battery Optimization Check** - проверка через `deviceSettings.isIgnoringBatteryOptimizations()`

### 📋 Чек-лист для Android:

- ✅ `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
- ✅ `ACCESS_BACKGROUND_LOCATION` (Android 10+)
- ✅ `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`
- ✅ `POST_NOTIFICATIONS` (Android 13+)
- ✅ Foreground service с notification channel
- ✅ Background permission rationale
- ✅ Battery optimization check
- ✅ Встроенный HTTP uploader
- ✅ Headless режим

## Результат

После этих изменений приложение полностью соответствует рекомендациям Transistorsoft для предотвращения убийства фонового процесса Android. Система будет:

1. Показывать постоянное уведомление с каналом "Tracking"
2. Запрашивать разрешение "Allow all the time" через системный диалог
3. Проверять и предлагать отключить оптимизацию батареи
4. Использовать встроенный механизм отправки данных
5. Продолжать работу в headless режиме при убийстве UI

## Тестирование

Для тестирования рекомендуется:
1. Пересобрать приложение
2. Проверить появление уведомления при запуске трекинга
3. Убедиться в появлении диалога "Allow all the time"
4. Проверить работу в фоне после закрытия приложения
