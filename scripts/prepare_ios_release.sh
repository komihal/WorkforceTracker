#!/bin/bash

# Скрипт для подготовки iOS приложения к публикации в App Store

set -e

echo "🚀 Подготовка iOS приложения к публикации..."

# Переходим в корневую директорию проекта
cd "$(dirname "$0")/.."

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: package.json не найден. Убедитесь, что вы находитесь в корневой директории проекта."
    exit 1
fi

echo "📦 Установка зависимостей..."
npm install

echo "🧹 Очистка кэша Metro..."
npx react-native start --reset-cache &
METRO_PID=$!
sleep 5
kill $METRO_PID 2>/dev/null || true

echo "📱 Переход в iOS директорию..."
cd ios

echo "🍎 Установка CocoaPods зависимостей..."
pod install

echo "🔧 Настройка проекта для release сборки..."

# Создаем схему для release если её нет
if [ ! -f "WorkforceTracker.xcodeproj/xcshareddata/xcschemes/WorkforceTracker.xcscheme" ]; then
    echo "📋 Создание схемы для release..."
    # Схема будет создана автоматически при первом открытии в Xcode
fi

echo "✅ Подготовка завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Откройте WorkforceTracker.xcworkspace в Xcode"
echo "2. Выберите схему 'WorkforceTracker' и устройство 'Any iOS Device (arm64)'"
echo "3. В настройках проекта (WorkforceTracker target):"
echo "   - Установите Development Team в разделе Signing & Capabilities"
echo "   - Убедитесь, что Bundle Identifier: com.workforcetracker.app"
echo "   - Проверьте версию приложения (Marketing Version)"
echo "4. Добавьте иконки приложения в Images.xcassets/AppIcon.appiconset/"
echo "5. Выберите Product > Archive для создания архива"
echo "6. Загрузите архив в App Store Connect через Xcode Organizer"
echo ""
echo "⚠️  Важно: Убедитесь, что у вас есть:"
echo "   - Apple Developer Account"
echo "   - Сертификаты для распространения"
echo "   - Provisioning Profile для App Store"
echo "   - Иконки приложения всех необходимых размеров"
