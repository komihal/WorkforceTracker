# Background Geolocation Refactor Prompt

## Context from repo

На основе анализа проекта WorkforceTracker (React Native приложение для отслеживания рабочих смен), выявлены следующие проблемы в текущей реализации геолокации:

### Критические проблемы:
- **Дублирование инициализации**: BGGeo инициализируется в `src/location.js:174` и `src/services/backgroundService.js:45`
- **Смешанная архитектура**: Используются собственные HTTP-вызовы (`postLocation`) + настроенный, но неиспользуемый встроенный uploader BGGeo
- **Множественные таймеры**: Периодическая отправка в `location.js:770` + интервалы в `backgroundService.js`
- **Частые обновления**: `distanceFilter: 1` метр, `heartbeatInterval: 10` секунд (разряжает батарею)

### Текущие настройки:
- **Лицензия**: Хардкод `7d1976aa376fbcf7e40d12892c8dab579985abbcbc09e1da570826649b4295cf` (Android)
- **API**: `https://api.tabelshik.com/db_save/` с токеном `wqHJerK834`
- **Права**: Все необходимые разрешения есть в AndroidManifest.xml и Info.plist
- **Фон**: `stopOnTerminate: false`, `startOnBoot: true`, `enableHeadless: true`, `foregroundService: true`

### Файлы для изменения:
- `src/location.js` (941 строка) - основная логика
- `src/services/backgroundService.js` (543 строки) - дублирующая логика
- `src/config/geoConfig.js` (61 строка) - конфигурация
- `src/api.js` - функция `postLocation`
- `android/app/src/main/AndroidManifest.xml` - права
- `ios/WorkforceTracker/Info.plist` - права iOS

## Refactor goals

Создать стабильную архитектуру фонового трекинга с единой точкой управления:

1. **Консолидировать логику** в `src/services/bgGeo/location.ts` (единственная инициализация)
2. **Перевести на встроенный uploader** BGGeo (url, headers, params, autoSync, batchSync, maxRecordsToPersist, httpTimeout)
3. **Оптимизировать настройки** для стабильной работы в фоне
4. **Убрать дублирование** и множественные таймеры
5. **Добавить мониторинг** и обработку ошибок
6. **Создать DebugScreen** для тестирования

## File plan

### Создать новые файлы:
- `src/services/bgGeo/location.ts` - единая точка управления BGGeo
- `src/services/bgGeo/types.ts` - типы для геолокации
- `src/services/bgGeo/config.ts` - конфигурация BGGeo
- `src/components/DebugScreen.tsx` - экран для тестирования
- `src/utils/batteryOptimization.ts` - утилиты для Android

### Изменить существующие файлы:
- `src/location.js` → удалить, заменить на новый сервис
- `src/services/backgroundService.js` → убрать дублирующую инициализацию BGGeo
- `src/config/geoConfig.js` → обновить настройки
- `src/api.js` → убрать `postLocation`, оставить только другие API
- `android/app/src/main/AndroidManifest.xml` → добавить недостающие разрешения
- `ios/WorkforceTracker/Info.plist` → добавить `NSMotionUsageDescription`

### Удалить файлы:
- `src/location.js` (заменить на новый сервис)

## Patch set

### 1. Создать `src/services/bgGeo/location.ts`

```typescript
import BackgroundGeolocation, { 
  Location, 
  Config, 
  State,
  HeadlessTaskEvent 
} from 'react-native-background-geolocation';
import { Platform, Alert } from 'react-native';
import { API_CONFIG } from '../../config/api';
import { getGeoConfig } from '../../config/geoConfig';
import { requestIgnoreBatteryOptimizations } from '../../utils/batteryOptimization';

class BgGeoLocationService {
  private static instance: BgGeoLocationService;
  private isInitialized = false;
  private isTracking = false;
  private currentUserId: string | null = null;

  static getInstance(): BgGeoLocationService {
    if (!BgGeoLocationService.instance) {
      BgGeoLocationService.instance = new BgGeoLocationService();
    }
    return BgGeoLocationService.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      console.log('BGGeo already initialized');
      return true;
    }

    try {
      // Запрашиваем разрешения
      await this.requestPermissions();
      
      // Получаем конфигурацию
      const geoConfig = getGeoConfig();
      
      // Получаем лицензию
      const license = await this.getLicense();
      
      if (!license) {
        throw new Error('BGGeo license not found');
      }

      // Конфигурация BGGeo
      const config: Config = {
        reset: true,
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        distanceFilter: geoConfig.DISTANCE_FILTER,
        stopOnTerminate: false,
        startOnBoot: true,
        pausesLocationUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        
        // Настройки для стабильной работы в фоне
        foregroundService: true,
        enableHeadless: true,
        preventSuspend: true,
        heartbeatInterval: geoConfig.HEARTBEAT_INTERVAL,
        
        // Встроенный uploader (основной способ отправки)
        autoSync: true,
        batchSync: true,
        syncUrl: `${API_CONFIG.BASE_URL}/db_save/`,
        syncThreshold: 1,
        httpTimeout: 30000,
        maxRecordsToPersist: 1000,
        
        // Параметры для API
        params: {
          api_token: API_CONFIG.API_TOKEN,
        },
        
        // Заголовки
        headers: {
          'Authorization': `Bearer ${API_CONFIG.API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        
        // Трансформация данных
        transform: (location: Location) => {
          if (!this.currentUserId) {
            console.log('[BGGeo Transform] No user ID, skipping');
            return null;
          }
          
          return {
            api_token: API_CONFIG.API_TOKEN,
            user_id: this.currentUserId,
            place_id: 1,
            phone_imei: "123456789012345", // TODO: получить реальный IMEI
            geo_array: [{
              lat: location.coords.latitude,
              lon: location.coords.longitude,
              utm: Math.floor(location.timestamp / 1000).toString(),
              alt: location.coords.altitude || 0,
              altmsl: (location.coords.altitude || 0) + 5,
              hasalt: Boolean(location.coords.altitude),
              hasaltmsl: Boolean(location.coords.altitude),
              hasaltmslaccuracy: Boolean(location.coords.accuracy && location.coords.accuracy < 5),
              mslaccuracyMeters: location.coords.accuracy || 0,
            }],
          };
        },
        
        // Уведомления
        notification: {
          title: 'WorkforceTracker',
          text: 'Отслеживание местоположения активно',
          channelName: 'Location Tracking',
          priority: BackgroundGeolocation.NOTIFICATION_PRIORITY_HIGH,
          sound: false,
          vibrate: false,
          silent: true,
        },
        
        license,
        debug: __DEV__,
        logLevel: __DEV__ ? BackgroundGeolocation.LOG_LEVEL_VERBOSE : BackgroundGeolocation.LOG_LEVEL_INFO,
      };

      // Инициализация BGGeo
      await BackgroundGeolocation.ready(config);
      
      // Регистрация обработчиков
      this.setupEventHandlers();
      
      // Регистрация headless task
      await this.registerHeadlessTask();
      
      // Запрос отключения оптимизации батареи (Android)
      if (Platform.OS === 'android') {
        await requestIgnoreBatteryOptimizations();
      }
      
      this.isInitialized = true;
      console.log('BGGeo initialized successfully');
      return true;
      
    } catch (error) {
      console.error('BGGeo initialization failed:', error);
      return false;
    }
  }

  private async requestPermissions(): Promise<void> {
    const { requestAllPermissions } = require('../permissionsService');
    const hasAllPermissions = await requestAllPermissions();
    if (!hasAllPermissions) {
      throw new Error('Required permissions denied');
    }
  }

  private async getLicense(): Promise<string | null> {
    try {
      const Config = require('react-native-config').default;
      const license = Config.BG_GEO_LICENSE_ANDROID || Config.BG_GEO_LICENSE_IOS;
      
      if (license) {
        return license.trim().replace(/^["']|["']$/g, '');
      }
      
      // Fallback для Android
      if (Platform.OS === 'android') {
        return '7d1976aa376fbcf7e40d12892c8dab579985abbcbc09e1da570826649b4295cf';
      }
      
      return null;
    } catch (error) {
      console.error('Error reading license:', error);
      return null;
    }
  }

  private setupEventHandlers(): void {
    // Обработчик успешной отправки
    BackgroundGeolocation.onSync((batch) => {
      console.log('[BGGeo Sync] Batch uploaded:', batch.length, 'locations');
    });
    
    // Обработчик ошибок HTTP
    BackgroundGeolocation.onHttp((response) => {
      if (response.status >= 400) {
        console.error('[BGGeo HTTP] Error:', response.status, response.responseText);
      } else {
        console.log('[BGGeo HTTP] Success:', response.status);
      }
    });
    
    // Обработчик изменения провайдера
    BackgroundGeolocation.onProviderChange((provider) => {
      console.log('[BGGeo Provider] Changed:', provider);
    });
    
    // Обработчик ошибок
    BackgroundGeolocation.onError((error) => {
      console.error('[BGGeo Error]', error);
    });
  }

  private async registerHeadlessTask(): Promise<void> {
    await BackgroundGeolocation.registerHeadlessTask(async (event: HeadlessTaskEvent) => {
      console.log('[HEADLESS] Event received:', event.name);
      
      switch (event.name) {
        case 'location':
          console.log('[HEADLESS] Location:', event.location);
          break;
        case 'heartbeat':
          console.log('[HEADLESS] Heartbeat:', event.location);
          break;
        case 'motionchange':
          console.log('[HEADLESS] Motion change:', event.location);
          break;
        case 'providerchange':
          console.log('[HEADLESS] Provider change:', event.status);
          break;
        default:
          console.log('[HEADLESS] Unknown event:', event.name);
      }
    });
  }

  async startTracking(userId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('BGGeo not initialized');
    }
    
    this.currentUserId = userId;
    
    try {
      await BackgroundGeolocation.start();
      this.isTracking = true;
      console.log('BGGeo tracking started for user:', userId);
    } catch (error) {
      console.error('Failed to start BGGeo tracking:', error);
      throw error;
    }
  }

  async stopTracking(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      await BackgroundGeolocation.stop();
      this.isTracking = false;
      this.currentUserId = null;
      console.log('BGGeo tracking stopped');
    } catch (error) {
      console.error('Failed to stop BGGeo tracking:', error);
    }
  }

  async getState(): Promise<State> {
    return await BackgroundGeolocation.getState();
  }

  async getCurrentPosition(): Promise<Location> {
    return await BackgroundGeolocation.getCurrentPosition({
      timeout: 30,
      samples: 3,
      persist: false,
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      maximumAge: 2000,
    });
  }

  // Метод для тестирования (DebugScreen)
  async runSmokeTest(): Promise<{ success: boolean; message: string }> {
    try {
      // Проверяем состояние
      const state = await this.getState();
      if (!state.enabled) {
        return { success: false, message: 'BGGeo not enabled' };
      }
      
      // Получаем текущую позицию
      const location = await this.getCurrentPosition();
      if (!location) {
        return { success: false, message: 'Failed to get location' };
      }
      
      // Проверяем точность
      if (location.coords.accuracy > 100) {
        return { success: false, message: `Poor accuracy: ${location.coords.accuracy}m` };
      }
      
      return { 
        success: true, 
        message: `Location: ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)} (${location.coords.accuracy}m)` 
      };
      
    } catch (error) {
      return { success: false, message: `Error: ${error.message}` };
    }
  }
}

export default BgGeoLocationService.getInstance();
```

### 2. Создать `src/services/bgGeo/types.ts`

```typescript
export interface GeoConfig {
  DISTANCE_FILTER: number;
  HEARTBEAT_INTERVAL: number;
  STOP_TIMEOUT: number;
  MAX_AGE: number;
}

export interface BgGeoState {
  isInitialized: boolean;
  isTracking: boolean;
  currentUserId: string | null;
  lastLocation: any | null;
  error: string | null;
}

export interface SmokeTestResult {
  success: boolean;
  message: string;
  location?: {
    lat: number;
    lon: number;
    accuracy: number;
  };
}
```

### 3. Создать `src/services/bgGeo/config.ts`

```typescript
export const GEO_CONFIG = {
  // Продакшн режим (стабильный)
  PRODUCTION: {
    DISTANCE_FILTER: 10,        // 10 метров (экономия батареи)
    HEARTBEAT_INTERVAL: 30,     // 30 секунд (стабильно)
    STOP_TIMEOUT: 0,            // Не останавливаться
    MAX_AGE: 5000,             // 5 секунд (свежие данные)
  },
  
  // Тестовый режим (частое обновление)
  TEST: {
    DISTANCE_FILTER: 5,         // 5 метров (для тестов)
    HEARTBEAT_INTERVAL: 15,     // 15 секунд (чаще)
    STOP_TIMEOUT: 0,            // Не останавливаться
    MAX_AGE: 2000,             // 2 секунды (очень свежие)
  }
};

export function getGeoConfig() {
  return __DEV__ ? GEO_CONFIG.TEST : GEO_CONFIG.PRODUCTION;
}
```

### 4. Создать `src/utils/batteryOptimization.ts`

```typescript
import { Platform, Alert, Linking } from 'react-native';

export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    // Проверяем, нужно ли запрашивать разрешение
    const { PermissionsAndroid } = require('react-native');
    
    // Для Android 6+ нужно запрашивать разрешение
    if (Platform.Version >= 23) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
        {
          title: 'Оптимизация батареи',
          message: 'Для стабильной работы геолокации в фоне разрешите игнорировать оптимизацию батареи',
          buttonNeutral: 'Спросить позже',
          buttonNegative: 'Отмена',
          buttonPositive: 'Разрешить',
        }
      );
      
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Battery optimization permission granted');
        return true;
      } else {
        console.log('Battery optimization permission denied');
        
        // Показываем инструкцию пользователю
        Alert.alert(
          'Оптимизация батареи',
          'Для стабильной работы геолокации отключите оптимизацию батареи в настройках устройства',
          [
            { text: 'Отмена', style: 'cancel' },
            { 
              text: 'Настройки', 
              onPress: () => {
                Linking.openSettings();
              }
            }
          ]
        );
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting battery optimization permission:', error);
    return false;
  }
}
```

### 5. Создать `src/components/DebugScreen.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import BgGeoLocationService from '../services/bgGeo/location';

export default function DebugScreen() {
  const [state, setState] = useState<any>(null);
  const [smokeTestResult, setSmokeTestResult] = useState<string>('');

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const bgGeoState = await BgGeoLocationService.getState();
      setState(bgGeoState);
    } catch (error) {
      console.error('Error loading BGGeo state:', error);
    }
  };

  const runSmokeTest = async () => {
    setSmokeTestResult('Running test...');
    
    try {
      const result = await BgGeoLocationService.runSmokeTest();
      setSmokeTestResult(result.message);
      
      if (result.success) {
        Alert.alert('✅ Test Passed', result.message);
      } else {
        Alert.alert('❌ Test Failed', result.message);
      }
    } catch (error) {
      setSmokeTestResult(`Error: ${error.message}`);
      Alert.alert('❌ Test Error', error.message);
    }
  };

  const testLocation = async () => {
    try {
      const location = await BgGeoLocationService.getCurrentPosition();
      Alert.alert(
        '📍 Current Location',
        `Lat: ${location.coords.latitude.toFixed(6)}\nLon: ${location.coords.longitude.toFixed(6)}\nAccuracy: ${location.coords.accuracy}m`
      );
    } catch (error) {
      Alert.alert('❌ Location Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔧 BGGeo Debug Screen</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <Text>Enabled: {state?.enabled ? '✅' : '❌'}</Text>
        <Text>Is Moving: {state?.isMoving ? '✅' : '❌'}</Text>
        <Text>Tracking Mode: {state?.trackingMode || 'N/A'}</Text>
        <Text>Last Location: {state?.location ? '✅' : '❌'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        
        <TouchableOpacity style={styles.button} onPress={runSmokeTest}>
          <Text style={styles.buttonText}>🧪 Run Smoke Test</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testLocation}>
          <Text style={styles.buttonText}>📍 Get Current Location</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={loadState}>
          <Text style={styles.buttonText}>🔄 Refresh State</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Smoke Test Result</Text>
        <Text style={styles.resultText}>{smokeTestResult}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultText: {
    fontSize: 14,
    fontFamily: 'monospace',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 4,
  },
});
```

### 6. Обновить `src/config/geoConfig.js`

```javascript
// Конфигурация частоты геолокации для разных режимов
export const GEO_CONFIG = {
  // Продакшн режим (стабильный, экономит батарею)
  PRODUCTION_MODE: {
    DISTANCE_FILTER: 10,           // 10 метров (экономия батареи)
    HEARTBEAT_INTERVAL: 30,         // 30 секунд (стабильно)
    STOP_TIMEOUT: 0,                // Не останавливаться
    MAX_AGE: 5000,                  // 5 секунд (свежие данные)
  },
  
  // Тестовый режим (частое обновление для отладки)
  TEST_MODE: {
    DISTANCE_FILTER: 5,             // 5 метров (для тестов)
    HEARTBEAT_INTERVAL: 15,         // 15 секунд (чаще)
    STOP_TIMEOUT: 0,                // Не останавливаться
    MAX_AGE: 2000,                  // 2 секунды (очень свежие)
  }
};

// Функция для получения текущей конфигурации
export function getGeoConfig() {
  return __DEV__ ? GEO_CONFIG.TEST_MODE : GEO_CONFIG.PRODUCTION_MODE;
}

// Функция для получения конфигурации по режиму
export function getGeoConfigByMode(isTestMode) {
  return isTestMode ? GEO_CONFIG.TEST_MODE : GEO_CONFIG.PRODUCTION_MODE;
}
```

### 7. Обновить `src/services/backgroundService.js`

```javascript
// Убрать дублирующую инициализацию BGGeo
// Удалить метод initializeBackgroundGeolocation()
// Удалить импорт BackgroundGeolocation
// Оставить только логику загрузки файлов и фотографий

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import geoService from './geoService';
import fileUploadService from './fileUploadService';
// Убрать: import BackgroundGeolocation from 'react-native-background-geolocation';

class BackgroundService {
  constructor() {
    this.isRunning = false;
    this.pendingPhotos = [];
    this.pendingGeoData = [];
    this.intervalId = null;
    this.uploadIntervalId = null;
    this.currentUserId = null;
    this.currentPlaceId = null;
    this.currentPhoneImei = null;
    this.isTestMode = false;
    this.appState = 'active';
    this.lastGeoCollection = 0;
    this.geoCollectionTimeout = null;
    
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  // Инициализация сервиса (БЕЗ BGGeo)
  async initialize(userId, placeId, phoneImei, testMode = false) {
    this.currentUserId = userId;
    this.currentPlaceId = placeId;
    this.currentPhoneImei = phoneImei;
    this.isTestMode = testMode;
    
    await this.loadPendingData();
    this.startBackgroundTasks();
    
    // УБРАТЬ: await this.initializeBackgroundGeolocation();
    console.log('BackgroundService initialized (BGGeo managed separately)');
  }

  // УДАЛИТЬ: async initializeBackgroundGeolocation() { ... }
  
  // Остальные методы остаются без изменений
  // ...
}

export default new BackgroundService();
```

### 8. Обновить `src/api.js`

```javascript
// Убрать функцию postLocation - теперь используется встроенный uploader BGGeo
// Оставить только другие API функции

import axios from 'axios';
import authService from './services/authService';

// УДАЛИТЬ: export async function postLocation({ lat, lon, accuracy, speed, heading, ts, batt, motion, alt, altmsl }) { ... }

// Остальные функции остаются без изменений
export async function punchInOut(punchType) { ... }
export async function uploadFile(fileData) { ... }
// и т.д.
```

### 9. Обновить `android/app/src/main/AndroidManifest.xml`

```xml
<!-- Добавить недостающие разрешения -->
<uses-permission android:name="android.permission.ACCESS_MOTION_STATE" />
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />

<!-- Обновить метаданные для лучшей работы в фоне -->
<meta-data android:name="com.transistorsoft.locationmanager.license" android:value="7d1976aa376fbcf7e40d12892c8dab579985abbcbc09e1da570826649b4295cf"/>

<!-- Добавить метаданные для предотвращения заморозки -->
<meta-data android:name="android.app.background_restricted" android:value="false"/>
<meta-data android:name="android.app.allow_backup" android:value="true"/>
<meta-data android:name="android.app.allow_clear_user_data" android:value="false"/>

<!-- Обновить сервисы -->
<service android:name="com.transistorsoft.locationmanager.LocationManagerService"
         android:enabled="true"
         android:exported="false"
         android:foregroundServiceType="location"
         android:stopWithTask="false" />
```

### 10. Обновить `ios/WorkforceTracker/Info.plist`

```xml
<!-- Добавить недостающие разрешения -->
<key>NSMotionUsageDescription</key>
<string>Детекция движения нужна для оптимизации работы геолокации.</string>

<!-- Обновить фоновые режимы -->
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>processing</string>
</array>
```

## Post-checks

### После применения изменений проверить:

1. **Компиляция**: `npm run android` и `npm run ios` должны собираться без ошибок
2. **Инициализация**: BGGeo должен инициализироваться только один раз
3. **Отправка данных**: Данные должны отправляться через встроенный uploader
4. **Фоновая работа**: Приложение должно работать в фоне после блокировки экрана
5. **Разрешения**: Все необходимые разрешения должны запрашиваться
6. **Логи**: Проверить логи BGGeo на отсутствие ошибок

### Команды для проверки:

```bash
# Android логи
adb logcat -d | grep -E "(TSLocationManager|BackgroundGeolocation|ReactNativeJS)"

# iOS логи  
xcrun simctl spawn booted log stream --predicate 'subsystem == "com.workforcetracker"'

# Проверка состояния BGGeo
# Использовать DebugScreen в приложении
```

## Questions

### Вопросы для уточнения перед мержем:

1. **Лицензия**: Нужно ли заменить хардкодированную лицензию на переменную окружения для продакшена?

2. **IMEI**: Как получить реальный IMEI устройства вместо хардкода `"123456789012345"`?

3. **place_id**: Почему `place_id` всегда равен 1? Нужно ли сделать его настраиваемым?

4. **API токен**: Токен `wqHJerK834` хардкодится в нескольких местах. Нужно ли вынести в переменные окружения?

5. **Тестирование**: Нужно ли добавить автоматические тесты для нового сервиса BGGeo?

6. **Миграция**: Как мигрировать существующих пользователей с старой архитектуры на новую?

7. **Мониторинг**: Нужно ли добавить метрики для мониторинга работы BGGeo в продакшене?

8. **Конфигурация**: Нужны ли разные настройки для разных типов устройств (Android/iOS)?

### Рекомендации по внедрению:

1. **Поэтапное внедрение**: Сначала заменить `location.js`, затем убрать дублирование в `backgroundService.js`
2. **Тестирование**: Использовать DebugScreen для проверки работы на разных устройствах
3. **Мониторинг**: Добавить логирование всех операций BGGeo для отладки
4. **Откат**: Сохранить старую версию `location.js` как backup на случай проблем

### Ожидаемые результаты:

- ✅ Единая точка управления BGGeo
- ✅ Стабильная работа в фоне
- ✅ Экономия батареи (увеличенные интервалы)
- ✅ Надежная отправка данных (встроенный uploader)
- ✅ Упрощенная архитектура (убрано дублирование)
- ✅ Лучшая отладка (DebugScreen)
- ✅ Обработка ошибок и retry логика
