# Руководство по кнопкам React Native Paper

## Установленные библиотеки
- `react-native-paper` - основные компоненты Material Design
- `react-native-vector-icons` - иконки

## Основные типы кнопок

### 1. Button (обычные кнопки)
```jsx
import { Button } from 'react-native-paper';

// Contained (заполненная)
<Button 
  mode="contained" 
  onPress={() => console.log('Pressed')}
>
  Contained Button
</Button>

// Outlined (с рамкой)
<Button 
  mode="outlined" 
  onPress={() => console.log('Pressed')}
>
  Outlined Button
</Button>

// Text (текстовая)
<Button 
  mode="text" 
  onPress={() => console.log('Pressed')}
>
  Text Button
</Button>
```

### 2. FAB (Floating Action Button)
```jsx
import { FAB } from 'react-native-paper';

<FAB
  icon="plus"
  label="Добавить"
  onPress={() => console.log('FAB pressed')}
  style={{ backgroundColor: '#4CAF50' }}
/>
```

### 3. IconButton (иконки-кнопки)
```jsx
import { IconButton } from 'react-native-paper';

<IconButton
  icon="home"
  size={24}
  onPress={() => console.log('Home pressed')}
/>
```

### 4. Chip (чипы)
```jsx
import { Chip } from 'react-native-paper';

<Chip 
  icon="check" 
  onPress={() => console.log('Chip pressed')}
>
  Активен
</Chip>
```

## Популярные иконки для вашего приложения

### Основные действия
- `play` - начать/открыть
- `stop` - остановить/закрыть
- `pause` - приостановить
- `camera` - камера/фото
- `account` - профиль/пользователь
- `settings` - настройки
- `logout` - выход
- `login` - вход

### Статусы и индикаторы
- `check` - готово/активно
- `clock` - время/ожидание
- `map-marker` - местоположение
- `bell` - уведомления
- `wifi` - сеть
- `battery` - батарея
- `chart-line` - статистика/графики

### Навигация
- `home` - главная
- `arrow-left` - назад
- `arrow-right` - вперед
- `menu` - меню
- `close` - закрыть

## Цвета для кнопок

### Стандартные цвета Material Design
- `#4CAF50` - зеленый (успех, начать)
- `#F44336` - красный (ошибка, остановить)
- `#2196F3` - синий (информация)
- `#FF9800` - оранжевый (предупреждение)
- `#9C27B0` - фиолетовый (акцент)

### Использование в стилях
```jsx
<Button 
  mode="contained"
  style={{ backgroundColor: '#4CAF50' }}
>
  Открыть смену
</Button>
```

## Примеры для Workforce Tracker

### Кнопки смены
```jsx
// Открыть смену
<FAB
  icon="play"
  label="Открыть смену"
  onPress={handlePunchIn}
  style={{ backgroundColor: '#4CAF50' }}
/>

// Закрыть смену
<FAB
  icon="stop"
  label="Закрыть смену"
  onPress={handlePunchOut}
  style={{ backgroundColor: '#F44336' }}
/>
```

### Кнопки действий
```jsx
// Сделать фото
<Button 
  mode="outlined"
  icon="camera"
  onPress={handleTakePhoto}
>
  Сделать фото
</Button>

// Показать статистику
<Button 
  mode="outlined"
  icon="chart-line"
  onPress={handleShowStats}
>
  Статистика
</Button>
```

### Иконки в шапке
```jsx
// Профиль
<IconButton
  icon="account"
  onPress={() => setMenuVisible(true)}
/>

// Настройки
<IconButton
  icon="settings"
  onPress={() => navigateToSettings()}
/>
```

## Важные замечания

1. **PaperProvider** - обязательно оберните приложение в `<PaperProvider>`
2. **Иконки** - используйте названия из Material Design Icons
3. **Цвета** - следуйте Material Design цветовой палитре
4. **Доступность** - всегда добавляйте `accessibilityLabel`
5. **Состояния** - используйте `disabled` и `loading` для интерактивности

## Дополнительные библиотеки

Если нужны еще более продвинутые компоненты:
- **NativeBase** - полный UI фреймворк
- **React Native Elements** - популярная библиотека компонентов
- **UI Kitten** - Eva Design System
