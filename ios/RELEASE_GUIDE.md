# Руководство по публикации iOS приложения в App Store

## Предварительные требования

### 1. Apple Developer Account
- Активный Apple Developer Program ($99/год)
- Доступ к App Store Connect

### 2. Сертификаты и профили
- **Distribution Certificate** (iOS Distribution)
- **App Store Provisioning Profile**
- **App ID** с Bundle Identifier: `com.workforcetracker.app`

### 3. Иконки приложения
- Все необходимые размеры (см. ICON_REQUIREMENTS.md)
- Формат PNG без прозрачности
- Высокое качество

## Пошаговая инструкция

### Шаг 1: Подготовка проекта
```bash
# Запустите скрипт подготовки
./scripts/prepare_ios_release.sh
```

### Шаг 2: Настройка в Xcode
1. Откройте `WorkforceTracker.xcworkspace` (НЕ .xcodeproj)
2. Выберите проект `WorkforceTracker` в навигаторе
3. Выберите target `WorkforceTracker`
4. Перейдите в раздел **Signing & Capabilities**

#### Настройки подписи:
- ✅ **Automatically manage signing**
- **Team**: Выберите вашу команду разработчиков
- **Bundle Identifier**: `com.workforcetracker.app`
- **Provisioning Profile**: Должен создаться автоматически

### Шаг 3: Добавление иконок
1. Откройте `Images.xcassets` > `AppIcon`
2. Перетащите иконки соответствующих размеров в соответствующие слоты
3. Убедитесь, что все иконки загружены без ошибок

### Шаг 4: Настройка версии
1. В настройках проекта, раздел **General**:
   - **Version**: 1.0 (Marketing Version)
   - **Build**: 1 (Current Project Version)

### Шаг 5: Создание архива
1. Выберите **Any iOS Device (arm64)** в качестве цели
2. **Product** > **Archive**
3. Дождитесь завершения сборки

### Шаг 6: Загрузка в App Store Connect
1. В **Organizer** выберите созданный архив
2. Нажмите **Distribute App**
3. Выберите **App Store Connect**
4. Выберите **Upload**
5. Следуйте инструкциям мастера

### Шаг 7: Настройка в App Store Connect
1. Войдите в [App Store Connect](https://appstoreconnect.apple.com)
2. Создайте новое приложение:
   - **Name**: WorkforceTracker
   - **Bundle ID**: com.workforcetracker.app
   - **SKU**: workforce-tracker-ios
3. Заполните метаданные:
   - Описание приложения
   - Ключевые слова
   - Скриншоты (обязательно)
   - Категория
   - Возрастной рейтинг

### Шаг 8: Отправка на модерацию
1. Заполните все обязательные поля
2. Нажмите **Submit for Review**
3. Дождитесь одобрения Apple (обычно 1-7 дней)

## Возможные проблемы и решения

### Ошибка подписи кода
- Проверьте, что у вас есть Distribution Certificate
- Убедитесь, что Bundle ID совпадает с App ID
- Проверьте Provisioning Profile

### Отсутствуют иконки
- Добавьте все необходимые размеры иконок
- Убедитесь, что формат PNG без прозрачности
- Проверьте имена файлов в Contents.json

### Ошибки сборки
- Очистите проект: **Product** > **Clean Build Folder**
- Удалите Derived Data
- Переустановите pods: `pod install`

### Проблемы с зависимостями
- Обновите CocoaPods: `pod update`
- Проверьте совместимость версий React Native

## Проверочный список перед публикацией

- [ ] Bundle Identifier настроен правильно
- [ ] Все иконки добавлены
- [ ] Версия приложения указана
- [ ] Сертификаты и профили настроены
- [ ] Проект собирается без ошибок
- [ ] Архив создается успешно
- [ ] Метаданные в App Store Connect заполнены
- [ ] Скриншоты добавлены
- [ ] Политика конфиденциальности указана (если требуется)

## Полезные команды

```bash
# Очистка кэша
npx react-native start --reset-cache

# Переустановка pods
cd ios && pod install

# Проверка сертификатов
security find-identity -v -p codesigning

# Список provisioning profiles
ls ~/Library/MobileDevice/Provisioning\ Profiles/
```

## Контакты и поддержка

При возникновении проблем:
1. Проверьте логи сборки в Xcode
2. Обратитесь к документации Apple Developer
3. Проверьте статус в App Store Connect
