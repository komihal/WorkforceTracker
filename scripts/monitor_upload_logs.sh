#!/bin/bash

# Скрипт для мониторинга логов отправки данных
# Использует asleep для предотвращения зависания

APP_ID="com.workforcetracker"
LOG_TAGS="ReactNativeJS|TSLocationManager|BackgroundGeolocation"
UPLOAD_PATTERNS="Sending|Uploading|uploaded|Failed|Error|success|POST|upload|save"

echo "🔍 Мониторинг логов отправки для $APP_ID"
echo "📱 Теги: $LOG_TAGS"
echo "📤 Паттерны: $UPLOAD_PATTERNS"
echo "⏰ Таймаут: 20 секунд"
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

# Мониторим логи с таймаутом
{
    adb logcat --pid $PID | grep -E "($LOG_TAGS)" | grep -E "($UPLOAD_PATTERNS)" &
    LOG_PID=$!
    
    # Ждем 20 секунд или пока не получим 50 строк
    sleep 20
    kill $LOG_PID 2>/dev/null
} | head -50

echo "----------------------------------------"
echo "✅ Мониторинг завершен"
