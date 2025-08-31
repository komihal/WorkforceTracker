# 🧪 Стратегия тестирования WorkforceTracker

## 📊 Текущий статус тестирования

- ✅ **Unit тесты**: 12 тестов, 3 test suites
- ✅ **Jest**: Настроен и работает
- ✅ **React Testing Library**: Установлен и настроен
- ✅ **Покрытие**: Базовое покрытие для helpers и services

## 🎯 Рекомендуемая стратегия тестирования

### 1. **Unit-тесты (Jest) - Базовый уровень** ✅

**Что тестировать:**
- Бизнес-логика (helpers, utils)
- Сервисы (auth, geo, camera)
- Утилиты и хелперы

**Примеры:**
```bash
npm test                    # Запуск всех тестов
npm run test:watch         # Тесты в режиме наблюдения
npm run test:coverage      # Тесты с покрытием
npm run test:ci            # Тесты для CI/CD
```

### 2. **Component-тесты (React Testing Library)** 🔄

**Что тестировать:**
- Рендеринг компонентов
- Пользовательские взаимодействия
- Состояние компонентов
- Навигация

**Примеры тестов:**
- LoginScreen: форма входа, валидация
- MainScreen: отображение данных, кнопки
- CameraTestScreen: работа с камерой
- PhotoGalleryScreen: галерея фотографий

### 3. **Integration-тесты** 🚧

**Что тестировать:**
- Взаимодействие между компонентами
- Работа с API
- Навигация между экранами
- Сохранение/загрузка данных

### 4. **E2E тесты (Detox)** 🚧

**Что тестировать:**
- Полный пользовательский сценарий
- Работа на реальном устройстве
- Критические пути приложения

## 🛠️ Инструменты тестирования

### **Установленные:**
- Jest (тест-раннер)
- React Testing Library (тестирование компонентов)
- AsyncStorage моки

### **Рекомендуемые к установке:**
```bash
# Для E2E тестирования
npm install --save-dev detox

# Для тестирования навигации
npm install --save-dev @react-navigation/testing

# Для тестирования асинхронных операций
npm install --save-dev @testing-library/react-hooks
```

## 📝 Примеры тестов

### **Тест компонента:**
```javascript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../src/components/LoginScreen';

test('renders login form correctly', () => {
  const { getByPlaceholderText, getByText } = render(<LoginScreen />);
  
  expect(getByPlaceholderText('(___) ___-__-__')).toBeTruthy();
  expect(getByPlaceholderText('Пароль')).toBeTruthy();
  expect(getByText('Войти')).toBeTruthy();
});
```

### **Тест сервиса:**
```javascript
import AuthService from '../src/services/authService';

test('isAuthenticated returns false when no user', () => {
  AuthService.currentUser = null;
  expect(AuthService.isAuthenticated()).toBe(false);
});
```

## 🚀 Команды для запуска тестов

```bash
# Базовые тесты
npm test

# Тесты в режиме наблюдения
npm run test:watch

# Тесты с покрытием
npm run test:coverage

# Тесты для CI/CD
npm run test:ci

# Отладка тестов
npm run test:debug
```

## 📈 Метрики качества

**Целевые показатели:**
- Покрытие кода: 80%+
- Время выполнения тестов: <30 секунд
- Количество failing тестов: 0

**Текущие показатели:**
- Покрытие: ~15% (базовое)
- Время выполнения: ~10 секунд
- Failing тесты: 0 ✅

## 🔄 CI/CD интеграция

**Рекомендуемые настройки:**
```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm run test:ci
  
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## 📚 Ресурсы для изучения

1. **Jest документация**: https://jestjs.io/
2. **React Testing Library**: https://testing-library.com/docs/react-native-testing-library/intro/
3. **Detox (E2E)**: https://wix.github.io/Detox/
4. **Testing React Native Apps**: https://reactnative.dev/docs/testing

## 🎯 Следующие шаги

1. **Увеличить покрытие тестами** до 80%+
2. **Добавить тесты для всех компонентов**
3. **Настроить E2E тестирование** с Detox
4. **Интегрировать тесты в CI/CD** pipeline
5. **Добавить тесты производительности**

## 📞 Поддержка

При возникновении проблем с тестами:
1. Проверьте логи Jest
2. Убедитесь в правильности моков
3. Проверьте совместимость версий
4. Используйте `npm run test:debug` для отладки
