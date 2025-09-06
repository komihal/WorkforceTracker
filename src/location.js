/* eslint-disable */
// Пробуем разные способы импорта BackgroundGeolocation
let BGGeo;

// Ручные отправки отключены - используется встроенный uploader BackgroundGeolocation
import Config from 'react-native-config';
import { Platform } from 'react-native';
import authService from './services/authService';

// Headless Task будет настроен после инициализации BGGeo

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
import { getGeoConfig } from './config/geoConfig';
import geoEndpointConfig from './config/geoEndpointConfig';

// Функция checkActiveShift удалена - теперь через встроенный uploader BG

let isInit = false;
let initAttempted = false;
let initSucceeded = false;
let lastInitError = null;
let currentLicense = null;
let currentEnvVarName = null;
let lastLocationSent = Date.now(); // Время последней отправки геолокации - инициализируем текущим временем
let trackingEnabled = false; // Включена ли отправка локаций (смена активна)

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
  
  console.log('Location initialization state reset completed');
}

export async function initBgGeo() {
  return await initLocation();
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
  
  // Хардкод лицензии удален - используйте .env файл
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
    console.log('[BG][location]', location.coords.latitude, location.coords.longitude);
    
    // Логируем получение геолокации, встроенный uploader отправит данные автоматически
    console.log('[BG][onLocation] Location received, uploader will handle sending');
  }); 

  // Проверяем, что onError доступен (необязательно)
  console.log('Checking BGGeo.onError availability...');
  try {
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
  } catch (error) {
    console.log('Error setting up onError handler:', error);
  }

  // Диагностические подписки (без тяжёлых операций)
  console.log('Setting up diagnostic subscriptions...');
  BGGeo.onMotionChange(e => console.log('[BG][motionchange]', e.isMoving));
  BGGeo.onActivityChange(e => console.log('[BG][activity]', e.activity, e.confidence));
  BGGeo.onProviderChange(e => console.log('[BG][provider]', e.status, e.gps));
  BGGeo.onEnabledChange(enabled => console.log('[BG][enabled]', enabled));
  console.log('Diagnostic subscriptions set up');
  
  // Добавляем обработчики для встроенной синхронизации BGGeo
  if (BGGeo.onSync) {
    BGGeo.onSync((batch) => {
      console.log('[BGGeo Sync] Native sync completed:', batch);
    });
  } else {
    console.log('BGGeo.onSync not available, skipping sync handler');
  }
  
  // Добавляем обработчик для HTTP запросов
  if (BGGeo.onHttp) {
    BGGeo.onHttp((response) => {
      console.log('[BGGeo HTTP] Native HTTP response:', response);
    });
  } else {
    console.log('BGGeo.onHttp not available, skipping HTTP handler');
  }

  // Обработчик heartbeat - только логирование с троттлингом
  let lastHeartbeatCall = 0;
  const HEARTBEAT_MIN_INTERVAL_MS = 60000; // 60s
  
  BGGeo.onHeartbeat((location) => {
    const t = Date.now();
    if (t - lastHeartbeatCall < HEARTBEAT_MIN_INTERVAL_MS) return;
    lastHeartbeatCall = t;
    
    console.log(`[${new Date().toLocaleTimeString()}] BG Heartbeat received:`, {
      lat: location.location?.coords?.latitude || location.coords?.latitude,
      lon: location.location?.coords?.longitude || location.coords?.longitude,
      timestamp: new Date(location.timestamp).toLocaleTimeString()
    });
  });

  try {
    // Включаем логгер максимально подробно в dev, до ready
    if (__DEV__) {
      try {
        if (BGGeo.logger) {
          await BGGeo.logger.setEnabled(true);
          await BGGeo.logger.setLevel(BGGeo.LOG_LEVEL_VERBOSE);
          console.log('BGGeo logger enabled');
        } else {
          console.log('BGGeo logger not available');
        }
      } catch (error) {
        console.log('BGGeo logger error:', error);
      }
    }

    // Получаем конфигурацию в зависимости от режима
    console.log('Getting geo config...');
    const geoConfig = getGeoConfig();
    console.log('Geo config received:', geoConfig);
    
    // Получаем текущий режим отправки
    const currentEndpointMode = await geoEndpointConfig.getCurrentMode();
    const isWebhookMode = currentEndpointMode === 'webhook';
    
    // Выбираем URL в зависимости от режима
    const endpointUrl = isWebhookMode 
      ? 'https://api.tabelshik.com/webhook/' 
      : 'https://api.tabelshik.com/api/db_save/';
    
    console.log('Initializing BackgroundGeolocation with config:', {
      mode: __DEV__ ? 'TEST' : 'PRODUCTION',
      endpointMode: currentEndpointMode,
      endpointUrl: endpointUrl,
      distanceFilter: geoConfig.DISTANCE_FILTER,
      heartbeatInterval: geoConfig.HEARTBEAT_INTERVAL,
      stopTimeout: geoConfig.STOP_TIMEOUT,
      license: currentLicense ? 'Present' : 'Missing'
    });

    // Конфигурация с встроенным uploader
    const state = await BGGeo.ready({
      reset: true,
      desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
      distanceFilter: geoConfig.DISTANCE_FILTER,
      stopOnTerminate: false,
      startOnBoot: true,
      heartbeatInterval: geoConfig.HEARTBEAT_INTERVAL,
      foregroundService: true,
      enableHeadless: true,
      preventSuspend: true,
      
      // Android-тюнинг, чтобы не «засыпал» и стабильно давал точки
      locationUpdateInterval: 15000,
      fastestLocationUpdateInterval: 10000,
      stationaryRadius: 20,                // меньше → быстрее выйдет из stationary
      stopTimeout: geoConfig.STOP_TIMEOUT, // 1(dev)/5(prod) минут
      disableElasticity: true,             // не растягивать интервалы «по усмотрению» ОС

      // Включаем встроенный uploader с правильной конфигурацией
      autoSync: true,
      batchSync: true,
      url: endpointUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Token': 'wqHJerK834'
      },
      
      // Правильная конфигурация для SDK
      httpRootProperty: 'geo_array',
      locationTemplate:
        '{"lat":<%= latitude %>,' +
        '"lon":<%= longitude %>,' +
        '"utm":"<%= timestamp %>",' +
        '"alt":<%= altitude %>,' +
        '"altmsl":<%= altitude %>,' +
        '"hasalt":true,' +
        '"hasaltmsl":true,' +
        '"hasaltmslaccuracy":true,' +
        '"mslaccuracyMeters":<%= accuracy %>}',
      
      params: {
        api_token: 'wqHJerK834',
        user_id: 57, // будет перезаписан при старте смены
        place_id: 2,
        phone_imei: Config.DEVICE_IMEI || '123456789012345'
      },
      
      logLevel: BGGeo.LOG_LEVEL_INFO,
      debug: false,
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
    
    // Headless task теперь регистрируется в src/services/bgGeo/headless.ts
    // Периодическая отправка удалена - теперь через встроенный uploader BG
  } catch (error) {
    initSucceeded = false;
    lastInitError = error?.message || JSON.stringify(error);
    console.error('BackgroundGeolocation initialization failed:', lastInitError);
    console.error('Full error object:', error);
  }
}

// Функции для управления трекингом
export async function startTracking(userId) {
  if (!BGGeo) {
    console.warn('BGGeo not initialized');
    return;
  }
  
  // Устанавливаем глобальную переменную для transform функции
  global.currentUserId = userId;
  
  // Обновляем конфигурацию с правильным user_id
  await BGGeo.setConfig({
    params: {
      api_token: 'wqHJerK834',
      user_id: userId,
      place_id: 2,
      phone_imei: Config.DEVICE_IMEI || '123456789012345'
    }
  });
  
  await BGGeo.start();
  
  // По флагу — форсируем "движение", чтобы в фоне сразу пошли точки
  if (Platform.OS === 'android' && Config.BG_FORCE_PACE_ON_START === '1') {
    try {
      await BGGeo.changePace(true);
      console.log('[BG] changePace(true) forced on start');
    } catch (e) {
      console.log('[BG] changePace error', e);
    }
  }
  
  const state = await BGGeo.getState();
  console.log('[BG] state after start:', state.enabled, state.isMoving);
}

export async function stopTracking() {
  if (!BGGeo) {
    console.warn('BGGeo not initialized');
    return;
  }
  
  await BGGeo.stop();
  if (Platform.OS === 'android' && Config.BG_FORCE_PACE_ON_START === '1') {
    try { 
      await BGGeo.changePace(false); 
    } catch {}
  }
}

// Функция для обновления URL endpoint при смене режима
export async function updateEndpointUrl() {
  if (!BGGeo) {
    console.warn('BGGeo not initialized');
    return;
  }
  
  try {
    // Получаем текущий режим отправки
    const currentEndpointMode = await geoEndpointConfig.getCurrentMode();
    const isWebhookMode = currentEndpointMode === 'webhook';
    
    // Выбираем URL в зависимости от режима
    const endpointUrl = isWebhookMode 
      ? 'https://api.tabelshik.com/webhook/' 
      : 'https://api.tabelshik.com/api/db_save/';
    
    console.log(`Updating BGGeo endpoint URL to: ${endpointUrl} (mode: ${currentEndpointMode})`);
    
    // Обновляем конфигурацию BGGeo
    await BGGeo.setConfig({
      url: endpointUrl
    });
    
    console.log('BGGeo endpoint URL updated successfully');
  } catch (error) {
    console.error('Error updating BGGeo endpoint URL:', error);
  }
}

// Функция startPeriodicLocationSend удалена - теперь через встроенный uploader BG


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
      hardcodedUsed: false // Хардкод удален
    }
  };
}

// (dev helpers removed)
