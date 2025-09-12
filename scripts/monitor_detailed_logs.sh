#!/bin/bash

# Детальный мониторинг логов приложения
# Показывает все логи с фильтрацией по отправке данных

APP_ID="com.workforcetracker"

echo "🔍 Детальный мониторинг логов для $APP_ID"
echo "⏰ Таймаут: 15 секунд"
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
    adb logcat --pid $PID | grep -E "(Sending|Uploading|uploaded|Failed|Error|success|POST|upload|save|geo|location|heartbeat|webhook|API|HTTP)" &
    LOG_PID=$!
    
    # Ждем 15 секунд
    sleep 15
    kill $LOG_PID 2>/dev/null
} | head -100

echo "----------------------------------------"
echo "✅ Мониторинг завершен"
