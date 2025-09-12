#!/bin/bash

echo "🧹 Очистка кэша BackgroundGeolocation..."

# Останавливаем приложение
echo "⏹️ Останавливаем приложение..."
adb shell am force-stop com.workforcetracker

# Очищаем данные приложения (включая SharedPreferences)
echo "🗑️ Очищаем данные приложения..."
adb shell pm clear com.workforcetracker

# Очищаем кэш приложения
echo "🧽 Очищаем кэш приложения..."
adb shell pm clear-cache com.workforcetracker

# Перезапускаем приложение
echo "🚀 Перезапускаем приложение..."
adb shell am start -n com.workforcetracker/.MainActivity

echo "✅ Очистка завершена! Приложение перезапущено."
echo "📱 Проверьте логи: adb logcat | grep -E '(BG|locationTemplate)'"
