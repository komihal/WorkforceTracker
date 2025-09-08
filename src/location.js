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
  } catch (error) {
    console.log('Error stopping BGGeo:', error.message);
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
  
  if (isInit && initSucceeded) {
    console.log('initLocation already initialized successfully, skipping');
    return;
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
  
  // Проверяем разрешения (не фейлим инициализацию при отсутствии "Always")
  try {
    const { requestAllPermissions } = require('./services/permissionsService');
    const hasAllPermissions = await requestAllPermissions();
    if (!hasAllPermissions) {
      console.warn('[BG] Limited permissions (no Always). Proceeding with WhenInUse.');
    } else {
      console.log('All permissions granted successfully');
    }
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
  
  // Получаем IMEI для трансформации
  currentPhoneImei = Config.DEVICE_IMEI || 'unknown-device';
  
  console.log('Initializing BackgroundGeolocation with canonical config:', {
      mode: __DEV__ ? 'TEST' : 'PRODUCTION',
      distanceFilter: geoConfig.DISTANCE_FILTER,
      heartbeatInterval: 300, // 5 минут = 300 секунд (жестко задано для избежания проблем с кэшированием)
      stopTimeout: geoConfig.STOP_TIMEOUT,
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
    console.log('[BG] Creating canonical config...');
    const CANONICAL_CONFIG = {
      // База
      reset: true,
      desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
      distanceFilter: 5, // Минимум 5 метров между точками для точного контроля на стройке
      // Во избежание циклов при статусе WhenInUse останавливаем сервис при убийстве UI
      stopOnTerminate: true,
      // Не автозапускаем на boot, пока не будет подтверждено Always
      startOnBoot: false,
      enableHeadless: true,
      foregroundService: true,
      
      // Notification Channel (Android O+) - обязательно для foreground service
      notification: {
        title: "Отслеживание включено",
        text: "Передача геоданных активна",
        channelName: "Tracking",
        smallIcon: "ic_launcher",
        priority: BGGeo.NOTIFICATION_PRIORITY_HIGH,
        sticky: true
      },
      
      // Background Permission Rationale (Android 10+) - для запроса "Allow all the time"
      backgroundPermissionRationale: {
        title: "Нужно 'Всегда' для трекинга",
        message: "Чтобы фиксировать маршруты и акты вне приложения, включите 'Разрешать всегда'.",
        positiveAction: "Перейти в настройки"
      },
      
      // Android тюнинг
      locationUpdateInterval: 1000,
      fastestLocationUpdateInterval: 1000,
      stationaryRadius: 25,
      stopTimeout: 1,
      disableElasticity: true,
      
      // Настройки для отправки каждые 5 минут при отсутствии активности
      stopOnStationary: false,  // Не останавливаем трекинг при остановке
      stopAfterElapsedMinutes: 0,  // Не останавливаем по времени
      // Используем heartbeat для периодической отправки (настройка из geoConfig)
      heartbeatInterval: 300, // 5 минут = 300 секунд (жестко задано для избежания проблем с кэшированием)

      // Отключаем автоматическую отправку, используем только ручную отправку раз в 5 минут
      autoSync: false,
      batchSync: false,
      url: 'https://api.tabelshik.com/api/db_save/',
      syncThreshold: 10, // Отправляем пакетами по 10 точек вместо каждой точки отдельно
      httpTimeout: 60000,
      maxRecordsToPersist: 1000,
      headers: { 
        'Authorization': 'Bearer wqHJerK834', 
        'Content-Type': 'application/json' 
      },
      // Согласно документации Transistorsoft: transform НЕ СУЩЕСТВУЕТ в React Native!
      // Используем locationTemplate + httpRootProperty + extras
      method: 'POST',
      httpRootProperty: ".", // Кладём данные прямо в корень JSON
      
      // Шаблон под ваш backend - используем дефолтные значения для инициализации
      locationTemplate: `{
        "api_token": "wqHJerK834",
        "user_id": 0,
        "place_id": 1,
        "phone_imei": "unknown",
        "geo_array": [{
          "lat": <%= latitude %>,
          "lon": <%= longitude %>,
          "utm": "<%= timestamp %>",
          "alt": <%= altitude %>,
          "altmsl": <%= altitude %>,
          "hasalt": true,
          "hasaltmsl": true,
          "hasaltmslaccuracy": true,
          "mslaccuracyMeters": <%= accuracy %>
        }]
      }`,
      
      // Постоянные поля через extras (согласно документации)
      extras: {
        api_token: 'wqHJerK834',
        user_id: 0, // Дефолтное значение для инициализации
        place_id: 1,
        phone_imei: 'unknown'
      },

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
    
    // 1) Принудительный сброс persisted-состояния и НЕМЕДЛЕННОЕ применение канонического конфига
    if (__DEV__ && Config.BG_FORCE_CANONICAL_RESET === '1') {
      try {
        console.log('[BG][reset] Forcing canonical reset...');
        await BGGeo.reset(CANONICAL_CONFIG); // ← ключевой шаг
        await BGGeo.destroyLocations();       // очистим БД локаций (на всякий случай)
        await BGGeo.destroyLog();             // очистим логи плагина
        BGGeo.removeListeners();              // снимем старые подписки, если были
        console.log('[BG][reset] Hard reset completed successfully');
      } catch (e) {
        console.log('[BG][reset] error', e);
      }
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
    
    const state = await BGGeo.ready(CANONICAL_CONFIG);
    console.log('[BG][ready] enabled:', state.enabled, 'isMoving:', state.isMoving);
    console.log('[BG] BGGeo.ready() completed successfully');

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
    if (listenersRegistered) {
      console.log('[BG] Listeners already registered, skipping re-registration');
    } else {
      listenersRegistered = true;
    BGGeo.onLocation(loc => {
      console.log('[BG][location]', loc.coords.latitude, loc.coords.longitude);
      console.log('[BG][location] timestamp:', loc.timestamp, 'formatted:', new Date(loc.timestamp).toISOString(), 'unix:', Math.floor(loc.timestamp / 1000));
      console.log('🔵  Acquired motionchange position, isMoving:', loc.isMoving);
      
      // Ручная отправка данных ТОЛЬКО при движении (согласно документации)
      console.log('[BG][location] Debug - currentUserId:', currentUserId, 'isMoving:', loc.isMoving);
      if (currentUserId && loc.isMoving) {
        console.log('[BG][location] Device is moving, sending data...');
        const geoData = {
          api_token: 'wqHJerK834',
          user_id: currentUserId,
          place_id: currentPlaceId ?? 1,
          phone_imei: currentPhoneImei ?? 'unknown',
          geo_array: [{
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
            utm: Math.floor((new Date(loc.timestamp).getTime() || Date.now())/1000),
            alt: loc.coords.altitude || 0,
            altmsl: (typeof loc.coords.altitude_msl === 'number' ? loc.coords.altitude_msl : (loc.coords.altitude || 0)),
            hasalt: Boolean(loc.coords.altitude),
            hasaltmsl: Boolean(typeof loc.coords.altitude_msl === 'number' ? loc.coords.altitude_msl : loc.coords.altitude),
            hasaltmslaccuracy: Boolean(loc.coords.accuracy && loc.coords.accuracy < 5),
            mslaccuracyMeters: loc.coords.accuracy || 0,
          }],
        };
        
        console.log('[BG] Sending geo data manually:', geoData);
        console.log('[BG] Debug timestamp:', loc.timestamp, 'Date.now():', Date.now());
        
        // Отправляем данные вручную
        fetch('https://api.tabelshik.com/api/db_save/', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer wqHJerK834',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(geoData)
        })
        .then(async response => {
          console.log('[BG] HTTP Response status:', response.status);
          console.log('[BG] HTTP Response headers:', response.headers.get('content-type'));
          
          if (!response.ok) {
            const text = await response.text();
            console.log('[BG] HTTP Error response:', text);
            throw new Error(`HTTP ${response.status}: ${text}`);
          }
          
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return response.json();
          } else {
            const text = await response.text();
            console.log('[BG] Non-JSON response:', text);
            return { success: false, message: 'Non-JSON response', raw: text };
          }
        })
        .then(data => {
          console.log('[BG] Manual HTTP Success:', data);
        })
        .catch(error => {
          console.log('[BG] Manual HTTP Error:', error.message);
        });
      } else if (currentUserId && !loc.isMoving) {
        console.log('[BG][location] Device is stationary, skipping data send');
      }
    });
    
    BGGeo.onMotionChange(e => {
      console.log('[BG][motionchange]', e.isMoving);
      console.log('🔵  setPace:', e.isMoving);
    });
    
    BGGeo.onHttp(r => {
      console.log('[BG][http] Status:', r.status);
      console.log('[BG][http] Response:', r.responseText);
      console.log('[BG][http] Request URL:', r.url);
      console.log('[BG][http] Request Body:', r.requestBody);
      console.log('[BG][http] Request Headers:', r.requestHeaders);
      console.log('🔵  HTTP POST:', r.status);
      if (r.status !== 200) {
        console.log('❌  HTTP Error:', r.status, r.responseText);
        console.log('❌  Request Body:', r.requestBody);
    } else {
        console.log('✅  HTTP Success:', r.status);
      }
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
    
    BGGeo.onConnectivityChange(ev => {
      console.log('[BG][connectivity]', ev.connected);
      console.log('🔵  Connectivity change:', ev.connected);
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

    // Heartbeat для периодической отправки каждые 5 минут
    BGGeo.onHeartbeat(async () => {
      console.log('[BG][heartbeat] Periodic location check (every 5 minutes)');
      try {
        // Получаем текущую позицию и сохраняем её
        const loc = await BGGeo.getCurrentPosition({
          samples: 1, 
          timeout: 20,
          desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
          persist: true, 
          maximumAge: 0
        });
        console.log('[BG][heartbeat] Location acquired:', loc?.coords?.latitude, loc?.coords?.longitude);
        
        // Принудительно синхронизируем накопленные данные
        const count = await BGGeo.getCount();
        if (count > 0) {
          console.log('[BG][heartbeat] Syncing', count, 'pending records');
          await BGGeo.sync();
        }
      } catch (e) {
        console.log('[BG][heartbeat] Error:', e?.message || e);
      }
    });

    // Дополнительный fallback - JavaScript setInterval каждые 5 минут
    if (Platform.OS === 'android') {
      setInterval(async () => {
        console.log('[BG][js-interval] 5-minute periodic check');
        try {
          const location = await BGGeo.getCurrentPosition({
            samples: 1,
            timeout: 20,
            desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
            persist: true,
            maximumAge: 0
          });
          console.log('[BG][js-interval] Got location:', location?.coords?.latitude, location?.coords?.longitude);
          await BGGeo.sync();
          console.log('[BG][js-interval] Sync completed');
        } catch (error) {
          console.log('[BG][js-interval] Error:', error);
        }
      }, 5 * 60 * 1000); // 5 минут = 300000 мс
    }
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
    
    // На старте синканём то, что лежит в БД
    try {
      const records = await BGGeo.getCount();
      console.log('[BG] pending records:', records);
      if (records > 0) {
        console.log('[BG] Syncing pending records...');
        await BGGeo.sync();
      }
    } catch (e) {
      console.log('[BG] sync error:', e.message);
    }

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
  
  const CANONICAL_CONFIG_WITH_USER = {
    // База
    reset: true,
    desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
      distanceFilter: 5, // Минимум 5 метров между точками для точного контроля на стройке
    stopOnTerminate: false,
    startOnBoot: true,
    enableHeadless: true,
    foregroundService: true,
    
    // Уведомление foreground-сервиса (Android O+)
    notification: {
      title: "Отслеживание включено",
      text: "Передача геоданных активна",
      channelName: "Tracking",
      smallIcon: "ic_launcher",
      priority: BGGeo.NOTIFICATION_PRIORITY_HIGH,
      sticky: true
    },
    
    // Android тюнинг
    locationUpdateInterval: 1000,
    fastestLocationUpdateInterval: 1000,
    stationaryRadius: 25,
    stopTimeout: 1,
    disableElasticity: true,
    heartbeatInterval: geoConfig.HEARTBEAT_INTERVAL,  // 5 минут для периодической отправки
    
    // Настройки для отправки каждые 5 минут при отсутствии активности
    stopOnStationary: false,  // Не останавливаем трекинг при остановке
    stopAfterElapsedMinutes: 0,  // Не останавливаем по времени

    // Отключаем автоматическую отправку, используем только ручную отправку раз в 5 минут
    autoSync: false,
    batchSync: false,
    url: 'https://api.tabelshik.com/api/db_save/',
    syncThreshold: 10, // Отправляем пакетами по 10 точек вместо каждой точки отдельно
    httpTimeout: 60000,
    maxRecordsToPersist: 1000,
    method: 'POST',
    httpRootProperty: ".", // Кладём данные прямо в корень JSON
    
    // Шаблон под ваш backend согласно документации (без выражений в плейсхолдерах)
    locationTemplate: '{"api_token":"wqHJerK834","user_id":' + userId + ',"place_id":' + (currentPlaceId || 1) + ',"phone_imei":"' + (currentPhoneImei || 'unknown') + '","geo_array":[{"lat":<%= latitude %>,"lon":<%= longitude %>,"utm":"<%= timestamp %>","alt":<%= altitude %>,"altmsl":<%= altitude %>,"hasalt":true,"hasaltmsl":true,"hasaltmslaccuracy":true,"mslaccuracyMeters":<%= accuracy %>}]}',
    
    // Постоянные поля через extras (согласно документации)
    extras: {
      api_token: 'wqHJerK834',
      user_id: userId,
      place_id: currentPlaceId,
      phone_imei: currentPhoneImei,
      source: 'bggeo'
    },
    
    headers: { 
      'Authorization': 'Bearer wqHJerK834', 
      'Content-Type': 'application/json' 
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

  // Форсируем вход в движение на Android, чтобы спровоцировать onLocation
  if (Platform.OS === 'android') {
    try {
      await BGGeo.changePace(true);
      logNative('[TRACK] changePace(true) after start');
    } catch (e) {
      logNative('[TRACK] changePace error', { err: String(e) });
    }
    // Дополнительно затребуем текущую позицию и сохраним её
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
        syncUrl: testConfig.syncUrl,
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
      syncUrl: endpointUrl
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

// Тестовые функции для диагностики
async function testFetch() {
  try {
    const r = await fetch("https://httpbin.org/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ping: "js", ts: new Date().toISOString() }),
    });
    console.log("[JS HTTP] ok:", r.status);
  } catch (e) {
    console.log("[JS HTTP] error:", e.message);
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