# WorkforceTracker

React Native приложение для отслеживания местоположения сотрудников.

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Для iOS установите pods:
```bash
cd ios && pod install && cd ..
```

## Настройка API

1. Создайте файл `.env` в корне проекта:
```bash
# API Configuration
API_URL=https://your-api-domain.com
API_TOKEN=your_api_token_here

# App Configuration
APP_NAME=WorkforceTracker
APP_ENV=production
```

2. Пересоберите приложение после изменения конфигурации.

## Запуск

### Metro Bundler
```bash
npm start
```

### iOS
```bash
npx react-native run-ios
```

### Android
```bash
npx react-native run-android
```

## Возможные проблемы

### "No script URL provided"
- Убедитесь, что Metro bundler запущен (`npm start`)
- Проверьте, что приложение запущено на том же устройстве/симуляторе
- Попробуйте пересобрать приложение

### Проблемы с API
- Проверьте настройки в файле `.env`
- Убедитесь, что API сервер доступен
- Проверьте токен авторизации

## Функции

- Отслеживание местоположения в фоне
- Автоматическая синхронизация с сервером
- Настройка точности и частоты обновлений
- Индикатор работы в фоне
