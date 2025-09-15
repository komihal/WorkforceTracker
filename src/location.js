// Единый BG-сервис с канонической конфигурацией Transistorsoft
let BGGeo;

import Config from 'react-native-config';
import { ensureBatteryOptimizationDisabled } from './utils/batteryOptimization';
import { Platform, AppState } from 'react-native';
import authService from './services/authService';
import { getGeoConfig } from './config/geoConfig';

// Native logger helper
const logNative = (msg, obj) => {
  try {
    const s = obj ? `${msg} ${JSON.stringify(obj)}` : msg;
    BGGeo?.log?.(BGGeo.LOG_LEVEL_INFO, s);
  } catch {}
};

// Глобальные переменные для трансформации
let currentUserId = null;
let currentPlaceId = 1;
let currentPhoneImei = null;

// Функция для создания locationTemplate элемента (используется с httpRootProperty:"geo_array")
const createLocationTemplate = () => {
  return `{
    "lat": <%= latitude %>,
    "lon": <%= longitude %>,
    "timestamp": "<%= timestamp %>",
    "alt": <%= altitude %>,
    "altmsl": <%= altitude %>,
    "accuracy": <%= accuracy %>
  }`;
};

try {
  const BackgroundGeolocation = require('react-native-background-geolocation');
  BGGeo = BackgroundGeolocation.default || BackgroundGeolocation;
  console.log('BackgroundGeolocation imported successfully');
  console.log('BGGeo methods:', Object.keys(BGGeo));
  console.log('BGGeo.ready exists:', typeof BGGeo.ready);
} catch (error) {
  console.error('Failed to import BackgroundGeolocation:', error);
  BGGeo = null;
}

let isInit = false;
let initAttempted = false;
let initSucceeded = false;
let isStartingTracking = false; // guard от двойного запуска BGGeo.start()
let lastInitError = null;
let currentLicense = null;
// Guards against permission-handling loops
let isHandlingPermissionRevocation = false;
let lastPermissionPromptAt = 0;
let listenersRegistered = false;
let batteryCheckDone = false;

// Rate-limit для отправки батчей раз в 2 минуты
let lastSyncAt = 0;
let syncInProgress = false;
const MIN_SYNC_INTERVAL_MS = 120000;

async function handlePermissionRevocation() {
  try {
    const now = Date.now();
    // Debounce prompts within 60s window
    if (isHandlingPermissionRevocation) {
      console.log('[BG] Permission revocation handling already in progress, skipping');
      return;
    }
    if (now - lastPermissionPromptAt < 60000) {
      console.log('[BG] Permission prompt debounced (<60s), skipping');
      return;
    }
    isHandlingPermissionRevocation = true;
    lastPermissionPromptAt = now;

    const { ensureAndroidAlways } = require('./services/permissionsService');
    const granted = await ensureAndroidAlways();
    if (granted) {
      console.log('[BG] Permissions re-granted. Will restart tracking when app is foreground.');
    } else {
      console.log('[BG] Permissions still denied, not restarting');
    }
  } catch (error) {
    console.log('[BG] Error handling permission revocation:', error);
  } finally {
    isHandlingPermissionRevocation = false;
  }
}

// Функция для сброса состояния инициализации
export async function resetLocationInit() {
  console.log('Resetting location initialization state...');
  
  try {
    const state = await BGGeo.getState();
    if (state.enabled) {
      console.log('Stopping BGGeo before reset...');
      await BGGeo.stop();
    }
    
    // Принудительно сбрасываем конфигурацию BGGeo
    console.log('Force resetting BGGeo configuration...');
    await BGGeo.reset();
    await BGGeo.destroyLocations();
    await BGGeo.destroyLog();
    BGGeo.removeListeners();
    console.log('BGGeo configuration reset completed');
  } catch (error) {
    console.log('Error resetting BGGeo:', error.message);
  }
  
  isInit = false;
  initAttempted = false;
  initSucceeded = false;
  lastInitError = null;
  currentUserId = null;
  listenersRegistered = false;
  console.log('Location state reset completed');
}

export async function initBgGeo() {
  return await initLocation();
}

export async function initLocation() {
  console.log(`[${new Date().toLocaleTimeString()}] ===== INIT LOCATION START =====`);
  
  // Принудительно сбрасываем конфигурацию для исправления locationTemplate
  try {
    console.log('[BG] Force resetting configuration to fix locationTemplate...');
    if (BGGeo) {
      await BGGeo.stop();
      await BGGeo.reset();
      await BGGeo.destroyLocations();
      await BGGeo.destroyLog();
      BGGeo.removeListeners();
      console.log('[BG] Force reset completed');
    }
  } catch (e) {
    console.log('[BG] Reset error:', e);
  }
  
  if (isInit && initSucceeded) {
    console.log('initLocation already initialized successfully, but forcing reset for locationTemplate fix');
    // Принудительно сбрасываем конфигурацию даже если уже инициализирован
    try {
      if (BGGeo) {
        await BGGeo.stop();
        await BGGeo.reset();
        await BGGeo.destroyLocations();
        await BGGeo.destroyLog();
        BGGeo.removeListeners();
        console.log('[BG] Force reset completed for locationTemplate fix');
      }
    } catch (e) {
      console.log('[BG] Force reset error:', e);
    }
  }
  
  // Сбрасываем флаг для повторной инициализации
  isInit = true;
  initAttempted = true;
  lastInitError = null;
  
  if (!BGGeo) {
    console.error('BGGeo is not available');
    lastInitError = 'BGGeo is not available';
    initSucceeded = false;
    return;
  }
  
  // Принудительно задаём базовые интервалы до полной конфигурации
  console.log('[BG] Applying base heartbeat config at init start');
  if (BGGeo) {
    try {
      await BGGeo.setConfig({
        heartbeatInterval: 120,
        distanceFilter: 10,
      });
      console.log('[BG] Base heartbeat config applied at init start');
    } catch (e) {
      console.log('[BG] Error in early config setup:', e);
    }
  }

  // Проверяем разрешения (не фейлим инициализацию при отсутствии "Always")
  try {
    console.log('[BG] Starting permissions check...');
    console.log('[BG] Skipping permissions check temporarily...');
    // const { requestAllPermissions } = require('./services/permissionsService');
    // console.log('[BG] Requesting all permissions...');
    // const hasAllPermissions = await requestAllPermissions();
    // console.log('[BG] Permissions check completed:', hasAllPermissions);
    // if (!hasAllPermissions) {
    //   console.warn('[BG] Limited permissions (no Always). Proceeding with WhenInUse.');
    // } else {
    //   console.log('All permissions granted successfully');
    // }
  } catch (permissionError) {
    console.error('Error requesting permissions:', permissionError);
    lastInitError = permissionError.message;
    initSucceeded = false;
    return;
  }

  // Получаем лицензию
  const platform = Platform.OS;
  let license = null;
  
  try {
    const Config = require('react-native-config').default;
    license = Config.BG_GEO_LICENSE_ANDROID || Config.BG_GEO_LICENSE_IOS;
  } catch (error) {
    console.log('Failed to read license from .env:', error.message);
  }
  
  if (!license) {
    license = '7d1976aa376fbcf7e40d12892c8dab579985abbcbc09e1da570826649b4295cf';
    console.log('Using hardcoded license for production');
  }
  
  if (typeof license === 'string') {
    license = license.trim();
    if ((license.startsWith('"') && license.endsWith('"')) || (license.startsWith("'") && license.endsWith("'"))) {
      license = license.slice(1, -1);
    }
  }
  
  currentLicense = license || null;

  if (!license) {
    initSucceeded = false;
    lastInitError = 'No license';
    console.warn(`BackgroundGeolocation: лицензия для ${platform} не задана. Инициализация пропущена.`);
    return;
  }
  
  // Получаем конфигурацию
  const geoConfig = getGeoConfig();
  
  // Получаем стабильный идентификатор устройства (ANDROID_ID/UniqueId)
  try {
    const deviceUtils = require('./utils/deviceUtils').default;
    currentPhoneImei = await deviceUtils.getDeviceId();
  } catch (e) {
    currentPhoneImei = Config.DEVICE_IMEI || 'unknown-device';
  }
  
  console.log('Initializing BackgroundGeolocation with canonical config:', {
      mode: __DEV__ ? 'TEST' : 'PRODUCTION',
      distanceFilter: geoConfig.DISTANCE_FILTER,
      heartbeatInterval: 120, // 2 минуты = 120 секунд для регулярной отправки геолокации
      stopTimeout: 'default (5s)', // Используется значение по умолчанию
      license: currentLicense ? 'Present' : 'Missing'
    });
  console.log('[BG] HEARTBEAT_INTERVAL from geoConfig:', geoConfig.HEARTBEAT_INTERVAL);
  console.log('[BG] About to call BGGeo.ready()...');

  try {
    // Проверяем что BGGeo импортирован
    if (!BGGeo) {
      throw new Error('BackgroundGeolocation not imported - BGGeo is null');
    }
    
    // КАНОНИЧЕСКАЯ КОНФИГУРАЦИЯ TRANSISTORSOFT (точная копия из документации)
    console.log('[BG] Initializing BackgroundGeolocation with canonical config');
    console.log('[BG] Using Transistorsoft canonical configuration');
    
    // Определяем каноническую конфигурацию согласно документации Transistorsoft
    // stopTimeout убран - используется значение по умолчанию (5 секунд)
    console.log('[BG] Creating canonical config...');
    console.log('[BG] Starting CANONICAL_CONFIG creation...');
    
    const CANONICAL_CONFIG = {
      // База
      reset: true,
      desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
      distanceFilter: 10, // 10 метров по требованию
      // Оставляем сервис живым и перезапускаем на boot для стабильной фоновой отправки
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      foregroundService: true,
      
      // Notification Channel (Android O+) - обязательно для foreground service
      notification: {
        title: "Отслеживание включено",
        text: "Передача геоданных активна",
        channelName: "Tracking",
        smallIcon: "ic_stat_notify",
        priority: BGGeo.NOTIFICATION_PRIORITY_LOW,
        sticky: true
      },
      
      // Background Permission Rationale (Android 10+) - для запроса "Allow all the time"
      backgroundPermissionRationale: {
        title: "Нужно 'Всегда' для трекинга",
        message: "Чтобы фиксировать маршруты и акты вне приложения, включите 'Разрешать всегда'.",
        positiveAction: "Перейти в настройки"
      },
      
      // Android тюнинг
      stationaryRadius: 10, // Уменьшаем радиус для более частых обновлений
      disableElasticity: false,
      
      // Настройки сбора
      stopOnStationary: false,  // Не останавливаем трекинг при остановке
      stopAfterElapsedMinutes: 0,  // Не останавливаем по времени
      heartbeatInterval: 120, // 2 минуты = 120 секунд

      // Нативный uploader с батчингом
      autoSync: true,
      batchSync: true,
      autoSyncThreshold: 25,
      url: 'https://api.tabelshik.com/api/db_save/',
      httpTimeout: 60000,
      maxRecordsToPersist: 10000,
      headers: { 
        'Content-Type': 'application/json',
        'Api-token': 'wqHJerK834'
      },
      // Формирование тела запроса через locationTemplate + httpRootProperty + params
      method: 'POST',
      httpRootProperty: "geo_array",
      params: {
        api_token: 'wqHJerK834',
        user_id: currentUserId || 0,
        place_id: currentPlaceId || 1,
        phone_imei: currentPhoneImei || 'unknown'
      },
      locationTemplate: createLocationTemplate(),

      debug: true,
      logLevel: BGGeo.LOG_LEVEL_VERBOSE,
      license,
    };
    
    console.log('[BG] Canonical config created:', {
      url: CANONICAL_CONFIG.url,
      hasTransform: typeof CANONICAL_CONFIG.transform === 'function',
      autoSync: CANONICAL_CONFIG.autoSync,
      batchSync: CANONICAL_CONFIG.batchSync
    });
    
    // 1) ПРИНУДИТЕЛЬНЫЙ сброс persisted-состояния для исправления locationTemplate
    try {
      console.log('[BG][reset] Forcing canonical reset to fix locationTemplate...');
      
      // Сначала останавливаем BGGeo
      await BGGeo.stop();
      console.log('[BG][reset] BGGeo stopped');
      
      // Устанавливаем пустую строку для locationTemplate согласно документации
      const CONFIG_WITH_EMPTY_TEMPLATE = { ...CANONICAL_CONFIG };
      CONFIG_WITH_EMPTY_TEMPLATE.locationTemplate = "";
      console.log('[BG][reset] Config with empty locationTemplate:', Object.keys(CONFIG_WITH_EMPTY_TEMPLATE));
      
      await BGGeo.reset(CONFIG_WITH_EMPTY_TEMPLATE); // ← ключевой шаг
      await BGGeo.destroyLocations();       // очистим БД локаций (на всякий случай)
      await BGGeo.destroyLog();             // очистим логи плагина
      BGGeo.removeListeners();              // снимем старые подписки, если были
      
      // Согласно документации Transistorsoft: используем только официальные методы
      console.log('[BG][reset] Using only official Transistorsoft methods');
      
      console.log('[BG][reset] Hard reset completed successfully');
    } catch (e) {
      console.log('[BG][reset] error', e);
    }
    
    // 2) Нормальная готовность (оставляем reset:true — по умолчанию оно true в SDK).
    console.log('[BG][ready] Final CANONICAL_CONFIG heartbeatInterval:', CANONICAL_CONFIG.heartbeatInterval);
    
    // Принудительно очищаем накопленные данные для избежания массовой отправки
    try {
      await BGGeo.destroyLocations();
      console.log('[BG][ready] Cleared accumulated location data');
    } catch (e) {
      console.log('[BG][ready] Error clearing locations:', e);
    }
    
    console.log('[BG] Calling BGGeo.ready() with timeout...');
    const readyPromise = BGGeo.ready(CANONICAL_CONFIG);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('BGGeo.ready() timeout after 30 seconds')), 30000)
    );
    
    const state = await Promise.race([readyPromise, timeoutPromise]);
    console.log('[BG][ready] enabled:', state.enabled, 'isMoving:', state.isMoving);
    console.log('[BG] BGGeo.ready() completed successfully');

    // УБИРАЕМ ДУБЛИРОВАНИЕ - heartbeat обработчик будет зарегистрирован далее в этом блоке
    console.log('[BG] Registering event listeners...');

    // Дополнительно актуализируем интервалы после ready (HTTP-настройки уже применены)
    console.log('[BG] Applying post-ready timing config');
    await BGGeo.setConfig({
      heartbeatInterval: 120,
      distanceFilter: 10,
      maxRecordsToPersist: 10000
    });
    console.log('[BG] Post-ready timing config applied');

    // Проверка оптимизации батареи (интерактивный запрос при необходимости)
    // Используем setTimeout для избежания блокировки инициализации
    console.log('[BG] Scheduling battery optimization check in 2 seconds (foreground-only)...');
    setTimeout(async () => {
      try {
        if (batteryCheckDone) {
          console.log('[BG] Battery check already done this session, skipping');
          return;
        }
        if (AppState.currentState !== 'active') {
          console.log('[BG] AppState not active, skipping battery dialog');
          return;
        }
        console.log('[BG] Starting battery optimization check (foreground)...');
        await ensureBatteryOptimizationDisabled({ silent: false });
        batteryCheckDone = true;
        console.log('[BG] Battery optimization check completed');
      } catch (e) {
        console.log('[BG] Battery optimization check error:', e.message);
      }
    }, 2000); // Задержка 2 секунды после инициализации

    // Канонические event listeners (как в документации Transistorsoft)
    if (!listenersRegistered) {
      listenersRegistered = true;
    BGGeo.onLocation(loc => {
      console.log('[BG][location]', loc.coords.latitude, loc.coords.longitude);
      console.log('[BG][location] timestamp:', loc.timestamp, 'formatted:', new Date(loc.timestamp).toISOString(), 'unix:', Math.floor((typeof loc.timestamp === 'number' ? loc.timestamp : new Date(loc.timestamp).getTime()) / 1000));
      console.log('🔵  Acquired motionchange position, isMoving:', loc.isMoving);
      
      // Отправка данных при каждом обновлении локации (не только при движении)
      console.log('[BG][location] Debug - currentUserId:', currentUserId, 'isMoving:', loc.isMoving);
      if (currentUserId) {
        console.log('[BG][location] Using native autoSync uploader; no manual fetch');
      }
    });
    
    BGGeo.onMotionChange(e => {
      console.log('[BG][motionchange]', e.isMoving);
      console.log('🔵  setPace:', e.isMoving);
    });
    
    BGGeo.onHttp(async (r) => {
      // Детальное логирование для Cursor output
      console.log('='.repeat(80));
      console.log('🌐 HTTP REQUEST TO SERVER');
      console.log('='.repeat(80));
      console.log('📡 URL:', r.url);
      console.log('📊 Status:', r.status);
      console.log('📋 Headers:', JSON.stringify(r.requestHeaders, null, 2));
      console.log('📦 Request Body:');
      try {
        const requestData = JSON.parse(r.requestBody);
        console.log(JSON.stringify(requestData, null, 2));
      } catch (e) {
        console.log(r.requestBody);
      }
      console.log('📥 Response:');
      try {
        const responseData = JSON.parse(r.responseText);
        console.log(JSON.stringify(responseData, null, 2));
      } catch (e) {
        console.log(r.responseText);
      }
      console.log('='.repeat(80));
      
      // Краткий статус
      if (r.status === 200) {
        console.log('✅ HTTP SUCCESS:', r.status);
        try { global.__LAST_DB_SAVE_AT__ = new Date().toISOString(); } catch {}
        // Убираем автоматический refresh - теперь статус обновляется по требованию
        console.log('[BG][onHttp] Geo data uploaded successfully');
      } else {
        console.log('❌ HTTP ERROR:', r.status, r.responseText);
      }
      console.log('='.repeat(80));
    });
    
    // onSync не существует в API Transistorsoft, удаляем
    
    // onError не существует в API Transistorsoft, используем onHttp для обработки ошибок
    
    BGGeo.onProviderChange(async (p) => {
      console.log('[BG][provider]', p.status, p.gps);
      console.log('🔵  Provider change:', p.status);
      
      // Обработка отзыва разрешений
      if (p.status === 'DENIED' || p.status === 'RESTRICTED') {
        console.log('[BG] Permissions revoked detected via providerChange');
        await handlePermissionRevocation();
      }
    });
    
    BGGeo.onActivityChange(e => {
      console.log('[BG][activity]', e.activity, e.confidence);
      console.log('🚘  DetectedActivity [type=' + e.activity + ', confidence=' + e.confidence + ']');
    });
    
    BGGeo.onEnabledChange(enabled => {
      console.log('[BG][enabledChange]', enabled);
      console.log('✅  Started in foreground');
    });
    
    BGGeo.onConnectivityChange(async (ev) => {
      console.log('[BG][connectivity]', ev.connected);
      console.log('🔵  Connectivity change:', ev.connected);
      // При восстановлении сети инициируем немедленный sync накопленных точек
      if (ev.connected) {
        try {
          await BGGeo.sync();
          console.log('[BG][connectivity] sync() triggered');
        } catch (e) {
          console.log('[BG][connectivity] sync error:', String(e?.message || e));
        }
      }
    });
    
    // Обработка изменений авторизации (более специфично для Transistorsoft)
    BGGeo.onAuthorization(async (auth) => {
      console.log('[BG][authorization]', auth.status);
      console.log('🔐  Authorization change:', auth.status);
      
      // Если авторизация отозвана
      if (auth.status === 'DENIED' || auth.status === 'RESTRICTED') {
        console.log('[BG] Location authorization revoked detected via onAuthorization');
        await handlePermissionRevocation();
      }
    });

    // Heartbeat: только сохраняем свежую точку (persist) — отправку делает нативный uploader
    BGGeo.onHeartbeat(async () => {
      try {
        const loc = await BGGeo.getCurrentPosition({
          samples: 1,
          timeout: 20,
          desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
          persist: true,
          maximumAge: 0
        });
        console.log('[BG][heartbeat] persisted location:', loc?.coords?.latitude, loc?.coords?.longitude);
        // Сразу после persist пытаемся синхронизировать накопленные точки
        try {
          await BGGeo.sync();
          console.log('[BG][heartbeat] sync() triggered');
        } catch (e) {
          console.log('[BG][heartbeat] sync error:', String(e?.message || e));
        }
      } catch (e) {
        console.log('[BG][heartbeat] getCurrentPosition error:', String(e?.message || e));
      }
    });

    // УБИРАЕМ ДОПОЛНИТЕЛЬНЫЙ setInterval - используем только встроенный heartbeat
    console.log('[BG] Skipping additional JavaScript setInterval - using native heartbeat only');
    // Конец регистрации слушателей
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
    
    // Проверяем оптимизацию батареи согласно документации Transistorsoft
    try {
      const isIgnoringBatteryOptimizations = await BGGeo.deviceSettings.isIgnoringBatteryOptimizations();
      console.log('[BG] Battery optimizations ignored:', isIgnoringBatteryOptimizations);
      
      if (!isIgnoringBatteryOptimizations) {
        console.log('[BG] Battery optimizations are enabled - this may affect background tracking');
        // Можно показать пользователю настройки, но не будем делать это автоматически
        // чтобы не раздражать пользователя
      }
    } catch (e) {
      console.log('[BG] Battery optimization check error:', e.message);
    }
    
    // На старте не форсируем ручной sync — автоотправка выполнит доставку самостоятельно

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

  // Сохраняем currentUserId для transform
  currentUserId = userId;

  // ПРИНУДИТЕЛЬНО применяем каноническую конфигурацию согласно документации
  console.log('[BG] Force applying canonical config via setConfig()...');
  
  // Принудительно сбрасываем конфигурацию для исправления locationTemplate
  try {
    console.log('[BG] Force reset before startTracking to fix locationTemplate...');
    await BGGeo.stop();
    await BGGeo.reset();
    await BGGeo.destroyLocations();
    await BGGeo.destroyLog();
    BGGeo.removeListeners();
    
    // Согласно документации Transistorsoft: используем только официальные методы
    console.log('[BG] Using only official Transistorsoft methods in startTracking');
    
    console.log('[BG] Reset completed before startTracking');
  } catch (e) {
    console.log('[BG] Reset error before startTracking:', e);
  }
  
  // Конфигурация с привязкой к пользователю
  // stopTimeout убран - используется значение по умолчанию (5 секунд)
  const CANONICAL_CONFIG_WITH_USER = {
    // База
    reset: true,
    desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
    distanceFilter: 10, // 10 метров по требованию
    stopOnTerminate: false,  // ← Сервис не останавливается при закрытии приложения
    startOnBoot: true,       // ← Автоматически запускается при загрузке устройства
    enableHeadless: true,    // ← Работает в headless режиме
    foregroundService: true, // ← Показывает уведомление о работе в фоне
  
    
    // Уведомление foreground-сервиса (Android O+)
    notification: {
      title: "Отслеживание включено",
      text: "Передача геоданных активна",
      channelName: "Tracking",
      smallIcon: "ic_stat_notify",
      priority: BGGeo.NOTIFICATION_PRIORITY_LOW,
      sticky: true
    },
    
    // Android тюнинг
    stationaryRadius: 10, // Уменьшаем радиус для более частых обновлений
    disableElasticity: false,
    heartbeatInterval: 120, // 2 минуты для периодической отправки
    
    // Настройки для отправки каждые 2 минуты при отсутствии активности
    stopOnStationary: false,  // Не останавливаем трекинг при остановке
    stopAfterElapsedMinutes: 0,  // Не останавливаем по времени

    // Нативный uploader
    autoSync: true,
    batchSync: true,
    autoSyncThreshold: 25,
    url: 'https://api.tabelshik.com/api/db_save/',
    httpTimeout: 60000,
    maxRecordsToPersist: 10000,
    method: 'POST',
    httpRootProperty: "geo_array",
    
    // Шаблон одной точки + корневые поля в params
    locationTemplate: createLocationTemplate(),
    params: {
      api_token: 'wqHJerK834',
      user_id: userId || 0,
      place_id: currentPlaceId || 1,
      phone_imei: currentPhoneImei || 'unknown'
    },
    
    headers: { 
      'Content-Type': 'application/json',
      'Api-token': 'wqHJerK834'
    },
    
    debug: true,
    logLevel: BGGeo.LOG_LEVEL_VERBOSE,
    license: getLicenseInfo().license,
  };
  
  await BGGeo.setConfig(CANONICAL_CONFIG_WITH_USER);
  console.log('[BG] Canonical config applied successfully via setConfig()');

  // Guard: избегаем параллельных start()
  if (isStartingTracking) {
    console.log('[BG] startTracking skipped: already starting');
    return;
  }

  // Если уже включен — повторно не запускаем
  try {
    const existing = await BGGeo.getState();
    if (existing?.enabled) {
      logNative('[TRACK] already enabled, skipping start');
      return;
    }
  } catch {}

  isStartingTracking = true;
  logNative('[TRACK] startTracking called', { userId });
  
  // Heartbeat handler уже зарегистрирован в initLocation(); дублирование не требуется

  // Принудительно применяем конфигурацию с heartbeatInterval: 120
  console.log('[BG] Force applying 2-minute heartbeat config in startTracking()');
  await BGGeo.setConfig({
    heartbeatInterval: 120,
    distanceFilter: 10
  });
  console.log('[BG] 2-minute heartbeat config applied in startTracking()');
  
  try {
    await BGGeo.start();
  } catch (e) {
    const msg = String(e?.message || e);
    if (/Waiting for previous start action to complete/i.test(msg)) {
      console.log('[BG] start() is busy, waiting and re-checking state...');
      // Подождём завершения предыдущего старта и проверим состояние
      await new Promise(r => setTimeout(r, 1500));
      try {
        const s = await BGGeo.getState();
        if (s?.enabled) {
          console.log('[BG] start() completed in background; tracking already enabled');
        } else {
          console.log('[BG] start() still not enabled after wait; skipping rethrow');
        }
      } catch {}
    } else {
      console.log('[BG] start() error:', msg);
      throw e;
    }
  } finally {
    isStartingTracking = false;
  }

  // Не форсируем движение вручную: позволяем SDK самому определить motionchange
  if (Platform.OS === 'android') {
    try {
      const loc = await BGGeo.getCurrentPosition({
        samples: 1,
        timeout: 20,
        desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
        persist: true,
        maximumAge: 0,
      });
      console.log('[BG] getCurrentPosition persisted:', loc?.coords?.latitude, loc?.coords?.longitude);
    } catch (e) {
      console.log('[BG] getCurrentPosition error:', String(e?.message || e));
    }
  }
  
  const state = await BGGeo.getState();
  logNative('[TRACK] state after start', { enabled: state.enabled, isMoving: state.isMoving });
}

export async function stopTracking() {
  if (!BGGeo) {
    console.warn('BGGeo not initialized');
    return;
  }
  
  // Принудительно синхронизируем накопленные точки перед остановкой
  try {
    const count = await BGGeo.getCount();
    console.log('[BG] stopTracking: syncing', count, 'accumulated points before stopping');
    if (count > 0) {
      await BGGeo.sync();
      console.log('[BG] stopTracking: sync completed');
    }
  } catch (e) {
    console.log('[BG] stopTracking: sync error:', e?.message || e);
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
    // Проверяем Transistorsoft test mode
    const transistorsoftTestConfig = require('./config/transistorsoftTestConfig').default;
    const isTransistorsoftTestEnabled = await transistorsoftTestConfig.isEnabled();
    
    if (isTransistorsoftTestEnabled) {
      // Используем Transistorsoft tracker
      const testConfig = await transistorsoftTestConfig.getTestConfig();
      console.log('Using Transistorsoft test configuration:', testConfig);
      
      await BGGeo.setConfig({
        url: testConfig.syncUrl,
        params: testConfig.params,
        headers: testConfig.headers
      });
      
      console.log('BGGeo updated for Transistorsoft test mode');
      return;
    }
    
    // Получаем текущий режим отправки
    const geoEndpointConfig = require('./config/geoEndpointConfig').default;
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

export function removeListeners() {
  BGGeo.removeListeners();
}

export async function ensureTracking(userId) {
  try {
    const lic = getLicenseInfo();
    if (!lic.initSucceeded) {
      logNative('[ENSURE] init not succeeded, calling initBgGeo()');
      await initBgGeo();
    }
  } catch {}
  await startTracking(userId);
}

// Совместимость с UI: экспорт вспомогательных функций для battery whitelist
export async function getBatteryWhitelistStatus() {
  try {
    if (!BGGeo) return { available: false, ignored: false };
    const ignored = await BGGeo.deviceSettings.isIgnoringBatteryOptimizations();
    return { available: true, ignored };
  } catch (e) {
    return { available: false, ignored: false, error: String(e?.message || e) };
  }
}

export async function ensureBatteryWhitelistUI() {
  // Проксируем на ensureBatteryOptimizationDisabled() с интерактивным UI
  try {
    await ensureBatteryOptimizationDisabled({ silent: false });
  } catch (e) {
    console.log('[Battery] ensureBatteryWhitelistUI error:', String(e?.message || e));
    throw e;
  }
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
    licensePresent: !!currentLicense,
    licenseMasked: mask(currentLicense),
    licenseLength: currentLicense ? currentLicense.length : 0,
    initAttempted,
    initSucceeded,
    lastInitError,
    isInit,
    packageName: Platform.OS === 'android' ? 'com.workforcetracker' : 'com.workforcetracker',
  };
}

// Тестовые функции для диагностики с детальным логированием
async function testFetch() {
  try {
    const testData = { ping: "js", ts: new Date().toISOString() };
    
    console.log('='.repeat(80));
    console.log('🧪 TEST FETCH REQUEST');
    console.log('='.repeat(80));
    console.log('📡 URL: https://httpbin.org/post');
    console.log('📦 Request Body:');
    console.log(JSON.stringify(testData, null, 2));
    console.log('📋 Headers:');
    console.log(JSON.stringify({ "Content-Type": "application/json" }, null, 2));
    console.log('='.repeat(80));
    
    const r = await fetch("https://httpbin.org/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testData),
    });
    
    console.log('📊 Test Response Status:', r.status);
    const data = await r.json();
    
    console.log('✅ TEST FETCH SUCCESS');
    console.log('📥 Server Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(80));
    
    return data;
  } catch (e) {
    console.log('❌ TEST FETCH ERROR');
    console.log('🚨 Error Details:', e.message);
    console.log('='.repeat(80));
    throw e;
  }
}

// Функция для тестирования реального API
async function testRealApi() {
  try {
    const testGeoData = {
      api_token: 'wqHJerK834',
      user_id: currentUserId || 999,
      place_id: currentPlaceId || 1,
      phone_imei: currentPhoneImei || 'test_imei',
      geo_array: [{
        lat: 55.7558,
        lon: 37.6176,
        utm: Math.floor(Date.now() / 1000),
        alt: 100,
        altmsl: 100,
        hasalt: true,
        hasaltmsl: true,
        hasaltmslaccuracy: true,
        mslaccuracyMeters: 5,
      }],
    };
    
    console.log('='.repeat(80));
    console.log('🧪 TEST REAL API REQUEST');
    console.log('='.repeat(80));
    console.log('📡 URL: https://api.tabelshik.com/api/db_save/');
    console.log('📦 Request Body:');
    console.log(JSON.stringify(testGeoData, null, 2));
    console.log('📋 Headers:');
    console.log(JSON.stringify({
      'Content-Type': 'application/json',
      'Api-token': 'wqHJerK834'
    }, null, 2));
    console.log('='.repeat(80));
    
    const response = await fetch('https://api.tabelshik.com/api/db_save/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-token': 'wqHJerK834'
      },
      body: JSON.stringify(testGeoData)
    });
    
    console.log('📊 Real API Response Status:', response.status);
    const data = await response.json();
    
    console.log('✅ TEST REAL API SUCCESS');
    console.log('📥 Server Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(80));
    
    return data;
  } catch (e) {
    console.log('❌ TEST REAL API ERROR');
    console.log('🚨 Error Details:', e.message);
    console.log('='.repeat(80));
    throw e;
  }
}

// Принудительная синхронизация BGGeo
async function forceSync() {
  try {
    const cnt = await BGGeo.getCount();
    console.log("[BG] forceSync, count=", cnt);
    const res = await BGGeo.sync();
    console.log("[BG] sync result:", res?.length);
  } catch (e) {
    console.log("[BG] forceSync error:", e.message);
  }
}

// Экспорт тестовых функций для отладки
export { testFetch, testRealApi };