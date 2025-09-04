/* eslint-disable */
// Пробуем разные способы импорта BackgroundGeolocation
let BGGeo;

try {
  // Правильный способ импорта react-native-background-geolocation v4.x
  const BackgroundGeolocation = require('react-native-background-geolocation');
  
  console.log('BackgroundGeolocation import check (require):', {
    type: typeof BackgroundGeolocation,
    isDefault: BackgroundGeolocation?.default ? 'yes' : 'no',
    hasOnLocation: typeof BackgroundGeolocation?.onLocation,
    hasOnError: typeof BackgroundGeolocation?.onError,
    hasReady: typeof BackgroundGeolocation?.ready,
    keys: Object.keys(BackgroundGeolocation || {})
  });
  
  // В версии 4.x BackgroundGeolocation является объектом с методами
  BGGeo = BackgroundGeolocation;
  
  // Проверяем, что методы доступны
  console.log('BGGeo methods check:', {
    type: typeof BGGeo,
    hasOnLocation: typeof BGGeo?.onLocation,
    hasOnError: typeof BGGeo?.onError,
    hasReady: typeof BGGeo?.ready,
    hasStart: typeof BGGeo?.start,
    hasStop: typeof BGGeo?.stop,
    hasGetState: typeof BGGeo?.getState,
    keys: Object.keys(BGGeo || {})
  });
  
  // Если методы недоступны, попробуем использовать .default
  if (BGGeo && typeof BGGeo.onLocation !== 'function' && BackgroundGeolocation.default) {
    console.log('Methods not available on main object, trying .default...');
    BGGeo = BackgroundGeolocation.default;
    console.log('BGGeo.default methods check:', {
      type: typeof BGGeo,
      hasOnLocation: typeof BGGeo?.onLocation,
      hasOnError: typeof BGGeo?.onError,
      hasReady: typeof BGGeo?.ready,
      hasStart: typeof BGGeo?.start,
      hasStop: typeof BGGeo?.stop,
      hasGetState: typeof BGGeo?.getState,
      keys: Object.keys(BGGeo || {})
    });
  }
  
} catch (error) {
  console.error('Failed to import BackgroundGeolocation:', error);
  BGGeo = null;
}
import { postLocation } from './api';
import { Platform } from 'react-native';
import { API_CONFIG } from './config/api';
import { getGeoConfig } from './config/geoConfig';
import geoEndpointConfig from './config/geoEndpointConfig';

let isInit = false;
let initAttempted = false;
let initSucceeded = false;
let lastInitError = null;
let currentLicense = null;
let currentEnvVarName = null;
let lastLocationSent = Date.now(); // Время последней отправки геолокации - инициализируем текущим временем
const LOCATION_SEND_THROTTLE = __DEV__ ? 10000 : 30000; // 10 секунд в тесте, 30 в продакшене
let periodicSendInterval = null; // Интервал для периодической отправки
let trackingEnabled = false; // Включена ли отправка локаций (смена активна)
const SEND_GUARD_WINDOW_MS = 4000; // анти-двойник в рамках 4с
let sendGuardUntilTs = 0;
const canSendNow = () => Date.now() >= sendGuardUntilTs;
const armSendGuard = () => { sendGuardUntilTs = Date.now() + SEND_GUARD_WINDOW_MS; };

// Функция для сброса состояния инициализации
export async function resetLocationInit() {
  console.log('Resetting location initialization state...');
  
  // Останавливаем BGGeo если он запущен
  try {
    const state = await BGGeo.getState();
    if (state.enabled) {
      console.log('Stopping BGGeo before reset...');
      await BGGeo.stop();
    }
  } catch (error) {
    console.log('Error stopping BGGeo:', error.message);
  }
  
  // Сбрасываем состояние
  isInit = false;
  initAttempted = false;
  initSucceeded = false;
  lastInitError = null;
  lastLocationSent = Date.now(); // Инициализируем текущим временем
  console.log('Location state reset - isInit:', isInit);
  
  // Останавливаем периодическую отправку
  if (periodicSendInterval) {
    clearInterval(periodicSendInterval);
    periodicSendInterval = null;
    console.log('Periodic location send interval cleared');
  }
  
  console.log('Location initialization state reset completed');
}

export async function initLocation() {
  console.log(`[${new Date().toLocaleTimeString()}] ===== INIT LOCATION START =====`);
  console.log('Current init state:', { isInit, initAttempted, initSucceeded, lastInitError });
  
  if (isInit) {
    console.log('initLocation already initialized, skipping');
    return;
  }
  isInit = true;
  initAttempted = true;
  lastInitError = null;
  console.log('Starting BackgroundGeolocation initialization...');
  
  // Проверяем, что BGGeo доступен и имеет нужные методы
  if (!BGGeo) {
    console.error('BGGeo is not available');
    lastInitError = 'BGGeo is not available';
    initSucceeded = false;
    return;
  }
  
  // Проверяем, что это объект с методами, а не функция
  if (typeof BGGeo === 'function') {
    console.log('BGGeo is a function, this is expected - using it directly');
    // BGGeo уже является правильным объектом, не нужно его вызывать
  }
  
  console.log('BGGeo available:', {
    type: typeof BGGeo,
    methods: Object.keys(BGGeo || {}),
    onLocation: typeof BGGeo.onLocation,
    onError: typeof BGGeo.onError,
    ready: typeof BGGeo.ready,
    isNull: BGGeo === null,
    isUndefined: BGGeo === undefined,
    constructor: BGGeo?.constructor?.name
  });
  
  // Проверяем разрешения геолокации и активности
  try {
    const { requestAllPermissions } = require('./services/permissionsService');
    const hasAllPermissions = await requestAllPermissions();
    if (!hasAllPermissions) {
      console.error('Required permissions denied');
      lastInitError = 'Required permissions denied';
      initSucceeded = false;
      return;
    }
    console.log('All permissions granted successfully');
  } catch (permissionError) {
    console.error('Error requesting permissions:', permissionError);
    lastInitError = permissionError.message;
    initSucceeded = false;
    return;
  }

  // Читаем платформенный ключ лицензии из .env через react-native-config
  const platform = Platform.OS;
  currentEnvVarName = platform === 'ios' ? 'BG_GEO_LICENSE_IOS' : 'BG_GEO_LICENSE_ANDROID';
  
  // Пытаемся прочитать лицензию из .env файла
  let license = null;
  try {
    const Config = require('react-native-config').default;
    license = Config.BG_GEO_LICENSE_ANDROID || Config.BG_GEO_LICENSE_IOS;
    console.log('License from .env:', license ? 'Present' : 'Missing');
  } catch (error) {
    console.log('Failed to read license from .env:', error.message);
  }
  
  // Если лицензия не найдена в .env, используем хардкодированную для тестирования
  if (!license && Platform.OS === 'android') {
    license = '7d1976aa376fbcf7e40d12892c8dab579985abbcbc09e1da570826649b4295cf';
    console.log('Using hardcoded license for testing');
  }
  // Санитизация ключа (часто лишние пробелы/кавычки из .env)
  if (typeof license === 'string') {
    license = license.trim();
    if ((license.startsWith('"') && license.endsWith('"')) || (license.startsWith("'") && license.endsWith("'"))) {
      license = license.slice(1, -1);
    }
  }
  if (license === '') license = null;
  currentLicense = license || null;

  console.log('Final license configuration:', {
    platform,
    envVar: currentEnvVarName,
    license: license ? `${license.substring(0, 8)}...${license.substring(license.length - 8)}` : 'null',
    licenseLength: license ? license.length : 0
  });

  if (!license) {
    console.warn(`BackgroundGeolocation: лицензия для ${platform} не задана (${currentEnvVarName}). Инициализация пропущена.`);
    initSucceeded = false;
    return;
  }

  // Проверяем, что onLocation доступен
  if (!BGGeo || typeof BGGeo.onLocation !== 'function') {
    console.error('BGGeo.onLocation is not available:', {
      BGGeo: typeof BGGeo,
      onLocation: BGGeo?.onLocation,
      availableMethods: Object.keys(BGGeo || {})
    });
    lastInitError = 'BGGeo.onLocation is not available';
    initSucceeded = false;
    return;
  }
  
  console.log('BGGeo.onLocation is available, proceeding with initialization...');

  BGGeo.onLocation(async (location) => {
    if (!trackingEnabled) {
      console.log('onLocation suppressed: tracking disabled');
      return;
    }
    // В режиме heartbeat-only не отправляем из onLocation
    console.log('onLocation event received (heartbeat-only mode)');
    // Если хотите иногда отправлять из onLocation, раскомментируйте ниже и добавьте guard.
    return;
    console.log(`[${new Date().toLocaleTimeString()}] BackgroundGeolocation.onLocation triggered (type: ${location.activity?.type || 'unknown'})`);
    const c = location.coords || {};
    const ts = new Date(location.timestamp || Date.now()).toISOString();
    const batt = location.battery?.level ?? null;
    const motion = location.activity?.type ?? null;
    const now = Date.now();

    // Throttling: проверяем, прошло ли достаточно времени с последней отправки
    const timeSinceLastSend = now - lastLocationSent;
    console.log(`[${new Date().toLocaleTimeString()}] Location received - time since last send: ${Math.round(timeSinceLastSend / 1000)}s (throttle: ${LOCATION_SEND_THROTTLE / 1000}s)`);
    
    if (timeSinceLastSend < LOCATION_SEND_THROTTLE) {
      console.log(`[${new Date().toLocaleTimeString()}] Location throttled - too soon since last send (${Math.round(timeSinceLastSend / 1000)}s ago, need ${LOCATION_SEND_THROTTLE / 1000}s)`);
      return;
    }

    console.log(`[${new Date().toLocaleTimeString()}] Location received in location.js:`, {
      lat: c.latitude,
      lon: c.longitude,
      accuracy: c.accuracy,
      timestamp: ts
    });

    // Отправляем в зависимости от выбранного режима (webhook или API)
    if (API_CONFIG.BASE_URL && API_CONFIG.BASE_URL === 'https://api.tabelshik.com') {
      try {
        // Проверяем, что пользователь аутентифицирован
        const authService = require('./services/authService').default;
        const currentUser = await authService.getCurrentUser();
        
        if (currentUser && currentUser.user_id) {
          const endpointMode = await geoEndpointConfig.getCurrentMode();
          
          if (endpointMode === 'webhook') {
            // Отправляем на webhook
            console.log(`[${new Date().toLocaleTimeString()}] Sending location via webhook...`);
            const { sendLocationToWebhook } = require('./config/api');
            await sendLocationToWebhook({
              lat: c.latitude,
              lon: c.longitude,
              accuracy: c.accuracy,
              speed: c.speed,
              heading: c.heading,
              ts,
              batt,
              motion,
              alt: c.altitude,
              altmsl: c.altitude,
              userId: currentUser.user_id,
              placeId: 1, // По умолчанию
              phoneImei: '123456789012345' // По умолчанию
            });
            console.log(`[${new Date().toLocaleTimeString()}] Location sent successfully via webhook`);
            lastLocationSent = now; // Обновляем время последней отправки
          } else {
            // Отправляем на API Django (по умолчанию)
            console.log(`[${new Date().toLocaleTimeString()}] Sending location via postLocation API...`);
            try {
              await postLocation({
                lat: c.latitude,
                lon: c.longitude,
                accuracy: c.accuracy,
                speed: c.speed,
                heading: c.heading,
                ts,
                batt,
                motion,
                alt: c.altitude,
                altmsl: c.altitude,
              });
              console.log(`[${new Date().toLocaleTimeString()}] Location sent successfully via postLocation API`);
              lastLocationSent = now; // Обновляем время последней отправки
            } catch (error) {
              console.error(`[${new Date().toLocaleTimeString()}] Error sending location via postLocation API:`, error.message);
            }
          }
        } else {
          console.log(`[${new Date().toLocaleTimeString()}] Location received but user not authenticated, skipping API call`);
        }
      } catch (e) {
        console.error(`[${new Date().toLocaleTimeString()}] Ошибка отправки местоположения:`, e);
      }
    } else {
      console.log(`[${new Date().toLocaleTimeString()}] API не настроен, местоположение не отправляется`);
    }
    
    // BackgroundService отключен для избежания дублирования отправок
    // Отправляем только напрямую через postLocation API
    console.log(`[${new Date().toLocaleTimeString()}] Location sent directly via postLocation API only`);
  }); 

  // Проверяем, что onError доступен (необязательно)
  if (BGGeo && typeof BGGeo.onError === 'function') {
    console.log('BGGeo.onError is available, setting up error handler...');
    BGGeo.onError((e) => {
      console.log('BGGeo error', e);
      // Сохраняем последнюю ошибку для отображения статуса
      try {
        lastInitError = typeof e === 'string' ? e : (e?.message || JSON.stringify(e));
      } catch (_) {}
    });
  } else {
    console.log('BGGeo.onError is not available, skipping error handler setup');
  }

  // Добавляем обработчик heartbeat для периодической отправки
  BGGeo.onHeartbeat(async (location) => {
    if (!trackingEnabled) {
      console.log('onHeartbeat suppressed: tracking disabled');
      return;
    }
    console.log(`[${new Date().toLocaleTimeString()}] BackgroundGeolocation.onHeartbeat triggered`);
    // В heartbeat координаты находятся в location.location.coords
    const actualLocation = location.location || location;
    const c = actualLocation.coords || {};
    console.log(`[${new Date().toLocaleTimeString()}] Heartbeat coords:`, c);
    const ts = new Date(actualLocation.timestamp || Date.now()).toISOString();
    const now = Date.now();

    // Для heartbeat отправляем с защитой от дублей и троттлингом
    if (!canSendNow()) {
      console.log('Heartbeat send suppressed by guard window');
      return;
    }
    const timeSinceLastSend = now - lastLocationSent;
    if (timeSinceLastSend < LOCATION_SEND_THROTTLE) {
      console.log(`Heartbeat throttled (${Math.round(timeSinceLastSend/1000)}s < ${LOCATION_SEND_THROTTLE/1000}s)`);
      return;
    }
    armSendGuard();

    try {
      // Проверяем, что пользователь аутентифицирован
      const authService = require('./services/authService').default;
      const currentUser = await authService.getCurrentUser();
      
      if (currentUser && currentUser.user_id) {
        const endpointMode = await geoEndpointConfig.getCurrentMode();
        
        if (endpointMode === 'webhook') {
          console.log(`[${new Date().toLocaleTimeString()}] Sending heartbeat via webhook...`);
          const { sendLocationToWebhook } = require('./config/api');
          await sendLocationToWebhook({
            lat: c.latitude,
            lon: c.longitude,
            accuracy: c.accuracy,
            speed: c.speed,
            heading: c.heading,
            ts,
            batt: actualLocation.battery?.level ?? null,
            motion: actualLocation.activity?.type ?? null,
            alt: c.altitude,
            altmsl: c.altitude,
            userId: currentUser.user_id,
            placeId: 1,
            phoneImei: '123456789012345',
            isHeartbeat: true
          });
          lastLocationSent = now;
          console.log(`[${new Date().toLocaleTimeString()}] Heartbeat sent successfully via webhook`);
        } else {
          console.log(`[${new Date().toLocaleTimeString()}] Sending heartbeat via postLocation API...`);
          await postLocation({
            lat: c.latitude,
            lon: c.longitude,
            accuracy: c.accuracy,
            speed: c.speed,
            heading: c.heading,
            ts,
            batt: actualLocation.battery?.level ?? null,
            motion: actualLocation.activity?.type ?? null,
            alt: c.altitude,
            altmsl: c.altitude,
            isHeartbeat: true
          });
          lastLocationSent = now;
          console.log(`[${new Date().toLocaleTimeString()}] Heartbeat sent successfully via postLocation API`);
        }
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] Heartbeat received but user not authenticated, skipping`);
      }
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Error sending heartbeat:`, error.message);
    }
  });

  try {
    // Включаем логгер максимально подробно в dev, до ready
    if (__DEV__) {
      try {
        await BGGeo.logger.setEnabled(true);
        await BGGeo.logger.setLevel(BGGeo.LOG_LEVEL_VERBOSE);
      } catch (_) {}
    }

    // Получаем конфигурацию в зависимости от режима
    const geoConfig = getGeoConfig();
    
    console.log('Initializing BackgroundGeolocation with config:', {
      mode: __DEV__ ? 'TEST' : 'PRODUCTION',
      distanceFilter: geoConfig.DISTANCE_FILTER,
      heartbeatInterval: geoConfig.HEARTBEAT_INTERVAL,
      stopTimeout: geoConfig.STOP_TIMEOUT,
      license: currentLicense ? 'Present' : 'Missing'
    });

    const state = await BGGeo.ready({
      reset: true,
      desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
      distanceFilter: geoConfig.DISTANCE_FILTER,
      stopOnTerminate: false,
      startOnBoot: true,
      pausesLocationUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      // Отключаем автоматическую отправку - используем только ручную через onLocation
      autoSync: false,
      batchSync: false,
      // Настраиваем heartbeat в зависимости от режима
      heartbeatInterval: geoConfig.HEARTBEAT_INTERVAL,
      maxDaysToPersist: 7,
      debug: false, // Отключаем debug для устранения звуков
      logLevel: BGGeo.LOG_LEVEL_INFO, // Уменьшаем уровень логирования
      foregroundService: true,
      enableHeadless: true,
      // Настройки для Android
      notification: {
        title: 'WorkforceTracker',
        text: __DEV__ ? 'Тестовый режим - частое отслеживание' : 'Отслеживание местоположения активно',
        channelName: 'Location Tracking',
        priority: BGGeo.NOTIFICATION_PRIORITY_LOW,
        // Отключаем звуки и вибрацию
        sound: false,
        vibrate: false,
        silent: true,
        // Дополнительные настройки для отключения звуков
        smallIcon: 'ic_launcher',
        largeIcon: 'ic_launcher',
        color: '#000000',
        // Отключаем звуки в notification channel
        channelDescription: 'Silent location tracking',
        channelShowBadge: false,
        channelEnableLights: false,
        channelEnableVibration: false,
        channelSound: null,
      },
      // Настройки для iOS
      showsBackgroundLocationIndicator: true,
      allowsBackgroundLocationUpdates: true,
      // Настройки для экономии батареи
      maxRecordsToPersist: 1000,
      persistMode: BGGeo.PERSIST_MODE_LOCATION,
      license,
    });

    // Не запускаем BGGeo автоматически: старт/стоп управляются сменой (punch in/out)
    if (state.enabled) {
      try {
        console.log('BGGeo is enabled after ready; stopping to await shift start...');
        await BGGeo.stop();
        console.log('BGGeo stopped; waiting for punch in to start tracking');
      } catch (e) {
        console.warn('Failed to ensure BGGeo stopped after ready:', e?.message || e);
      }
    } else {
      console.log('BGGeo remains disabled until punch in');
    }
    
    // Проверяем финальное состояние
    const finalState = await BGGeo.getState();
    console.log('Final BackgroundGeolocation state:', {
      enabled: finalState.enabled,
      isMoving: finalState.isMoving,
      location: finalState.location,
      odometer: finalState.odometer
    });
    
    initSucceeded = true;
    console.log('BackgroundGeolocation initialization completed successfully');
    console.log('Periodic location send disabled - using only BackgroundGeolocation heartbeat');
    
    // Периодическая отправка отключена - используем только heartbeat от BackgroundGeolocation
    // startPeriodicLocationSend(); // Отключено для избежания дублирования
    
  } catch (e) {
    initSucceeded = false;
    try {
      lastInitError = e?.message || JSON.stringify(e);
    } catch (_) {
      lastInitError = 'Неизвестная ошибка инициализации BackgroundGeolocation';
    }
    console.error('BackgroundGeolocation init failed:', lastInitError);
    console.error('Full error object:', e);
  }
}

// Функция для запуска периодической отправки геолокации
export function startPeriodicLocationSend() {
  console.log(`[${new Date().toLocaleTimeString()}] ===== startPeriodicLocationSend called =====`);
  
  if (periodicSendInterval) {
    clearInterval(periodicSendInterval);
    console.log('Cleared existing periodic interval');
  }
  
  const interval = __DEV__ ? 10000 : 30000; // 10 секунд в тесте, 30 в продакшене
  console.log(`[${new Date().toLocaleTimeString()}] Starting periodic location send every ${interval / 1000} seconds`);
  console.log(`[${new Date().toLocaleTimeString()}] BGGeo available:`, !!BGGeo);
  
  periodicSendInterval = setInterval(async () => {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] === PERIODIC INTERVAL TRIGGERED ===`);
      
      // Получаем текущую позицию
      const location = await BGGeo.getCurrentPosition({
        timeout: 15,
        samples: 1,
        persist: false,
        desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
      });
      
      console.log(`[${new Date().toLocaleTimeString()}] Periodic location received:`, {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        accuracy: location.coords.accuracy
      });
      
      // Проверяем, что пользователь аутентифицирован
      const authService = require('./services/authService').default;
      const currentUser = await authService.getCurrentUser();
      
      if (!currentUser || !currentUser.user_id) {
        console.log(`[${new Date().toLocaleTimeString()}] Periodic send - user not authenticated, skipping`);
        return;
      }
      
      const c = location.coords || {};
      const ts = new Date(location.timestamp || Date.now()).toISOString();
      
      // Отправляем в зависимости от выбранного режима
      const endpointMode = await geoEndpointConfig.getCurrentMode();
      
      if (endpointMode === 'webhook') {
        console.log(`[${new Date().toLocaleTimeString()}] Periodic sending via webhook...`);
        const { sendLocationToWebhook } = require('./config/api');
        await sendLocationToWebhook({
          lat: c.latitude,
          lon: c.longitude,
          accuracy: c.accuracy,
          speed: c.speed,
          heading: c.heading,
          ts,
          batt: location.battery?.level ?? null,
          motion: location.activity?.type ?? null,
          alt: c.altitude,
          altmsl: c.altitude,
          userId: currentUser.user_id,
          placeId: 1,
          phoneImei: '123456789012345',
          isPeriodic: true
        });
        console.log(`[${new Date().toLocaleTimeString()}] Periodic location sent successfully via webhook`);
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] Periodic sending via postLocation API...`);
        const { postLocation } = require('./api');
        await postLocation({
          lat: c.latitude,
          lon: c.longitude,
          accuracy: c.accuracy,
          speed: c.speed,
          heading: c.heading,
          ts,
          batt: location.battery?.level ?? null,
          motion: location.activity?.type ?? null,
          alt: c.altitude,
          altmsl: c.altitude,
          isPeriodic: true
        });
        console.log(`[${new Date().toLocaleTimeString()}] Periodic location sent successfully via postLocation API`);
      }
      
      // Обновляем время последней отправки
      lastLocationSent = Date.now();
      
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Error in periodic location send:`, error.message);
    }
  }, interval);
}

export async function startTracking() {
  trackingEnabled = true;
  try {
    await BGGeo.start();
    console.log('BGGeo started; trackingEnabled=true');
  } catch (e) {
    console.error('Failed to start BGGeo:', e?.message || e);
  }
}

export async function stopTracking() {
  trackingEnabled = false;
  try {
    await BGGeo.stop();
    console.log('BGGeo stopped; trackingEnabled=false');
  } catch (e) {
    console.error('Failed to stop BGGeo:', e?.message || e);
  }
  
  // Останавливаем периодическую отправку
  if (periodicSendInterval) {
    clearInterval(periodicSendInterval);
    periodicSendInterval = null;
    console.log('Periodic location send stopped');
  }
}

export function removeListeners() {
  BGGeo.removeListeners();
}

export function getLicenseInfo() {
  const mask = (value) => {
    if (!value || typeof value !== 'string') return null;
    if (value.length <= 10) return '••••••••';
    const head = value.slice(0, 6);
    const tail = value.slice(-4);
    return `${head}••••••••${tail}`;
  };
  return {
    platform: Platform.OS,
    envVar: currentEnvVarName,
    licensePresent: !!currentLicense,
    licenseMasked: mask(currentLicense),
    licenseLength: currentLicense ? currentLicense.length : 0,
    initAttempted,
    initSucceeded,
    lastInitError,
    isInit,
    packageName: Platform.OS === 'android' ? 'com.workforcetracker' : 'com.workforcetracker',
    configDetails: {
      configAndroid: 'string',
      configIOS: 'undefined',
      hardcodedUsed: Platform.OS === 'android' && currentLicense === '7d1976aa376fbcf7e40d12892c8dab579985abbcbc09e1da570826649b4295cf'
    }
  };
}

// (dev helpers removed)
