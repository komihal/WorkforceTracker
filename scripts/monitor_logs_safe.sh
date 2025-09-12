#!/bin/bash

# Безопасный мониторинг логов с снимками
# Использует снимки вместо живых логов

APP_ID="com.workforcetracker"
LOG_TAGS="ReactNativeJS|TSLocationManager|BackgroundGeolocation"

echo "🔍 Безопасный мониторинг логов для $APP_ID"
echo "📱 Теги: $LOG_TAGS"
echo "⏰ Создание снимка логов"
echo "----------------------------------------"

# Получаем PID приложения
PID=$(adb shell pidof $APP_ID 2>/dev/null)

if [ -z "$PID" ]; then
    echo "⚠️  Приложение не запущено, пытаемся запустить..."
    adb shell am start -n $APP_ID/.MainActivity
    sleep 3
    PID=$(adb shell pidof $APP_ID 2>/dev/null)
    
    if [ -z "$PID" ]; then
        echo "❌ Не удалось запустить приложение или получить PID"
        exit 1
    fi
fi

echo "✅ PID приложения: $PID"

# Очищаем логи и создаем снимок
echo "🧹 Очистка логов..."
adb logcat -c

echo "⏳ Ждем 10 секунд для накопления логов..."
sleep 10

# Создаем снимок логов
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="bggeo_after_poll_fix_${TIMESTAMP}.log"

echo "📸 Создание снимка логов: $LOG_FILE"
adb logcat -d -v time | grep -E "($LOG_TAGS)" > "$LOG_FILE"

echo "📊 Статистика снимка:"
echo "  Всего строк: $(wc -l < "$LOG_FILE")"
echo "  Shift status запросы: $(grep -c "Shift status API response" "$LOG_FILE")"
echo "  Stop heartbeat: $(grep -c "Stop heartbeat" "$LOG_FILE")"
echo "  BG started: $(grep -c "BG.*started" "$LOG_FILE")"
echo "  BG state enabled: $(grep -c "BG.*state enabled" "$LOG_FILE")"

echo "----------------------------------------"
echo "✅ Снимок логов сохранен в: $LOG_FILE"
echo "📋 Последние 20 строк:"
echo "----------------------------------------"
tail -20 "$LOG_FILE"

