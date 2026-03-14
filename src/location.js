// Единый BG-сервис с канонической конфигурацией Transistorsoft
let BGGeo;

import { AppState, Platform } from 'react-native';
import Config from 'react-native-config';
import { API_CONFIG, sendLocationToWebhook as sendLocationToWebhookApi, sendToWebhook as sendToWebhookApi } from './config/api';
import { getGeoConfig } from './config/geoConfig';
import { ensureBatteryOptimizationDisabled } from './utils/batteryOptimization';

const logNative = (msg, obj) => {
  try {
    const s = obj ? `${msg} ${JSON.stringify(obj)}` : msg;
    BGGeo?.log?.(BGGeo.LOG_LEVEL_INFO, s);
  } catch { }
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
    "utm": <%= Math.floor(timestamp / 1000) %>,
    "alt": <%= altitude || 0 %>,
    "altmsl": <%= altitude || 0 %>,
    "hasalt": <%= altitude ? true : false %>,
    "hasaltmsl": <%= altitude ? true : false %>,
    "hasaltmslaccuracy": <%= accuracy < 5 ? true : false %>,
    "mslaccuracyMeters": <%= accuracy || 0 %>,
    "reason": "location_update"
  }`;
};

// Включение мониторинга событий через .env (по умолчанию включено, можно отключить WEBHOOK_MONITOR=0)
const webhookEnabled = () => String(Config?.WEBHOOK_MONITOR || '1') === '1';

// Функция для удалённого сбора логов (рекомендация Transistorsoft)
async function sendRemoteLogs() {
  if (!webhookEnabled()) return;

  try {
    // Получаем логи BGGeo (если доступен метод getLog)
    let bgLogs = '';
    if (BGGeo && typeof BGGeo.getLog === 'function') {
      try {
        bgLogs = await BGGeo.getLog();
      } catch (e) {
        console.log('[REMOTE LOGS] BGGeo.getLog not available:', e.message);
      }
    }

    // Получаем системную информацию
    const deviceInfo = {
      platform: Platform.OS,
      version: Platform.Version,
      timestamp: new Date().toISOString(),
      bgGeoState: await BGGeo.getState().catch(() => null),
      bgGeoEnabled: await BGGeo.getEnabled().catch(() => null),
      bgGeoCount: await BGGeo.getCount().catch(() => null)
    };

    const payload = {
      type: 'remote_logs',
      timestamp: new Date().toISOString(),
      deviceInfo: deviceInfo,
      bgLogs: bgLogs,
      appLogs: global.__APP_LOGS__ || []
    };

    const response = await fetch(`${API_CONFIG.BASE_URL}/webhook/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: 15000
    });

    if (response.ok) {
      console.log('[REMOTE LOGS] Successfully sent logs to server');
      // Очищаем локальные логи после успешной отправки
      global.__APP_LOGS__ = [];
    } else {
      console.log('[REMOTE LOGS] Failed to send logs:', response.status);
    }
  } catch (error) {
    console.log('[REMOTE LOGS] Error sending logs:', error.message);
  }
}

// Функция для логирования в глобальный массив (для удалённого сбора)
function logToRemote(message, level = 'info') {
  if (!global.__APP_LOGS__) {
    global.__APP_LOGS__ = [];
  }

  global.__APP_LOGS__.push({
    timestamp: new Date().toISOString(),
    level: level,
    message: message
  });

  // Ограничиваем размер массива логов
  if (global.__APP_LOGS__.length > 1000) {
    global.__APP_LOGS__ = global.__APP_LOGS__.slice(-500);
  }
}

// Универсальная отправка событий BGGeo в мониторинговый webhook
const postBgEvent = async (event, payload = {}, meta = {}) => {
  if (!webhookEnabled()) return;

  const opts = meta || {};
  const eventType = opts.type || event || 'bg_event';
  const level = opts.level || 'info';

  try {
    await sendToWebhookApi(
      {
        event,
        level,
        payload,
        userId: currentUserId,
        placeId: currentPlaceId,
        phoneImei: currentPhoneImei,
        ts: Math.floor(Date.now() / 1000),
      },
      eventType
    );
  } catch { }
};

export const postSessionEvent = (action, data = {}, level = 'info') => {
  return postBgEvent('session_state', {
    action,
    ...data,
  }, {
    type: 'session',
    level,
  });
};

export const sanitizeLicenseValue = (raw) => {
  if (raw == null) {
    return null;
  }

  let value = String(raw).trim();
  if (!value) {
    return null;
  }

  const hasWrappingQuotes =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));

  if (hasWrappingQuotes && value.length >= 2) {
    value = value.slice(1, -1).trim();
  }

  return value || null;
};

export function resolveLicenseForPlatform({ config, platform } = {}) {
  const targetPlatform = platform || Platform.OS;
  let cfg = config;

  if (!cfg) {
    try {
      const ConfigModule = require('react-native-config');
      cfg = ConfigModule?.default || ConfigModule;
    } catch {
      cfg = null;
    }
  }

  if (!cfg) {
    return null;
  }

  const primary = targetPlatform === 'ios' ? cfg.BG_GEO_LICENSE_IOS : cfg.BG_GEO_LICENSE_ANDROID;
  const fallback = targetPlatform === 'ios' ? cfg.BG_GEO_LICENSE_ANDROID : cfg.BG_GEO_LICENSE_IOS;

  return sanitizeLicenseValue(primary) || sanitizeLicenseValue(fallback) || null;
}

export function getLocalLicenseFallback() {
  return '7d1976aa376fbcf7e40d12892c8dab579985abbcbc09e1da570826649b4295cf';
}

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
let licenseSourceMeta = {
  envVarPrimary: null,
  envVarFallback: null,
  primaryPresent: false,
  fallbackUsed: false,
  defaultFallbackUsed: false,
};
// Guards against permission-handling loops
let isHandlingPermissionRevocation = false;
let lastPermissionPromptAt = 0;
let listenersRegistered = false;
let batteryCheckDone = false;
let remoteLogIntervalId = null;

// Упрощённые переменные (убраны неиспользуемые)
let lastLocationEventHash = '';
let lastLocationEventTime = 0;
const LOCATION_EVENT_DEDUP_MS = 1000; // 1 секунда окно дедупликации

let lastMonitorLocationSentAtSec = 0;
let lastMonitorLocationHash = '';
const MONITOR_THROTTLE_SEC = 30; // Увеличиваем до 30 секунд

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
  postBgEvent('init_reset', {
    ts: new Date().toISOString()
  }, { type: 'init', level: 'info' }).catch(() => { });

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
  postBgEvent('init_start', {
    timestamp: new Date().toISOString()
  }, { type: 'init', level: 'info' }).catch(() => { });

  // Инициализация выполняется идемпотентно — без жёстких reset()

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

  // Не применяем предварительные setConfig до ready()

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
  const primaryEnvVar = platform === 'ios' ? 'BG_GEO_LICENSE_IOS' : 'BG_GEO_LICENSE_ANDROID';
  const fallbackEnvVar = platform === 'ios' ? 'BG_GEO_LICENSE_ANDROID' : 'BG_GEO_LICENSE_IOS';
  let primaryRaw = null;
  let fallbackRaw = null;

  try {
    primaryRaw = Config?.[primaryEnvVar];
    fallbackRaw = Config?.[fallbackEnvVar];
    license = resolveLicenseForPlatform({ config: Config, platform });
  } catch (error) {
    console.log('Failed to read license from .env:', error.message);
  }

  const primarySanitized = sanitizeLicenseValue(primaryRaw);
  const fallbackSanitized = sanitizeLicenseValue(fallbackRaw);

  licenseSourceMeta = {
    envVarPrimary: primaryEnvVar,
    envVarFallback: fallbackEnvVar,
    primaryPresent: !!primarySanitized,
    fallbackUsed: !primarySanitized && !!fallbackSanitized,
    defaultFallbackUsed: false,
  };

  if (!license) {
    license = getLocalLicenseFallback();
    console.log('Using hardcoded license for production');
    licenseSourceMeta.defaultFallbackUsed = true;
  }

  currentLicense = license || null;

  if (!license) {
    initSucceeded = false;
    lastInitError = 'No license';
    console.warn(`BackgroundGeolocation: лицензия для ${platform} не задана. Инициализация пропущена.`);
    return;
  }

  // Получаем конфигурацию для текущего режима
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
    heartbeatInterval: geoConfig.HEARTBEAT_INTERVAL,
    autoSyncThreshold: geoConfig.AUTO_SYNC_THRESHOLD,
    batchSync: geoConfig.BATCH_SYNC,
    autoSync: geoConfig.AUTO_SYNC,
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
      distanceFilter: geoConfig.DISTANCE_FILTER,
      // Оставляем сервис живым и перезапускаем на boot для стабильной фоновой отправки
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      foregroundService: true,

      // Notification Channel (Android O+) - обязательно для foreground service
      notification: {
        title: "📍 Смена активна",
        text: "Отслеживание местоположения",
        channelName: "Location Tracking",
        smallIcon: "ic_stat_notify",
        priority: BGGeo.NOTIFICATION_PRIORITY_LOW,
        sticky: true,
        sound: null,  // Отключаем звук уведомления
        vibrate: false,  // Отключаем вибрацию
        color: "#007AFF"  // Цвет уведомления
      },

      // Background Permission Rationale (Android 10+) - для запроса "Allow all the time"
      backgroundPermissionRationale: {
        title: "Нужно 'Всегда' для трекинга",
        message: "Чтобы фиксировать маршруты и акты вне приложения, включите 'Разрешать всегда'.",
        positiveAction: "Перейти в настройки"
      },

      // Android тюнинг
      stationaryRadius: geoConfig.DISTANCE_FILTER,
      disableElasticity: false,

      // Настройки сбора
      stopOnStationary: false,  // Не останавливаем трекинг при остановке
      stopAfterElapsedMinutes: 0,  // Не останавливаем по времени
      heartbeatInterval: geoConfig.HEARTBEAT_INTERVAL,

      // Нативный uploader ВКЛЮЧЕН - используем встроенный механизм Transistorsoft
      autoSync: true,
      batchSync: true,
      autoSyncThreshold: geoConfig.AUTO_SYNC_THRESHOLD,
      url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DB_SAVE}`,
      httpTimeout: 60000,
      maxRecordsToPersist: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Config?.API_TOKEN || ''}`
      },
      // Формирование тела запроса через locationTemplate + httpRootProperty + params
      method: 'POST',
      httpRootProperty: "geo_array",
      params: {
        api_token: Config?.API_TOKEN || '',
        user_id: currentUserId || 0,
        place_id: currentPlaceId || 0,
        phone_imei: currentPhoneImei || 'unknown'
      },
      locationTemplate: createLocationTemplate(),

      debug: __DEV__, // Включаем debug только в dev режиме
      logLevel: __DEV__ ? BGGeo.LOG_LEVEL_VERBOSE : BGGeo.LOG_LEVEL_ERROR, // Минимальное логирование в релизе
      license,
    };

    console.log('[BG] Canonical config created:', {
      url: CANONICAL_CONFIG.url,
      hasTransform: typeof CANONICAL_CONFIG.transform === 'function',
      autoSync: CANONICAL_CONFIG.autoSync,
      batchSync: CANONICAL_CONFIG.batchSync
    });

    // Нормальная готовность.
    console.log('[BG] Calling BGGeo.ready() with timeout...');
    const readyPromise = BGGeo.ready(CANONICAL_CONFIG);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('BGGeo.ready() timeout after 30 seconds')), 30000)
    );

    const state = await Promise.race([readyPromise, timeoutPromise]);
    console.log('[BG][ready] enabled:', state.enabled, 'isMoving:', state.isMoving);
    console.log('[BG] BGGeo.ready() completed successfully');
    postBgEvent('init_ready', {
      enabled: state.enabled,
      isMoving: state.isMoving
    }, { type: 'init', level: 'info' }).catch(() => { });

    // Проверяем текущую конфигурацию
    const currentConfig = await BGGeo.getState();
    console.log('[BG] Current config URL:', currentConfig.url);
    console.log('[BG] Current config autoSync:', currentConfig.autoSync);
    console.log('[BG] Current config batchSync:', currentConfig.batchSync);
    console.log('[BG] Current config autoSyncThreshold:', currentConfig.autoSyncThreshold);

    // Логируем конфигурацию для удалённого мониторинга
    logToRemote(`BGGeo configured: autoSync=${currentConfig.autoSync}, batchSync=${currentConfig.batchSync}, threshold=${currentConfig.autoSyncThreshold}`, 'info');

    // Настраиваем периодическую отправку логов (каждые 5 минут)
    if (remoteLogIntervalId) clearInterval(remoteLogIntervalId);
    remoteLogIntervalId = setInterval(() => {
      sendRemoteLogs().catch(() => { });
    }, 5 * 60 * 1000);

    // Если не включено — запускаем
    if (!state.enabled) {
      try {
        await BGGeo.start();
      } catch (e) {
        console.log('[BG] start() after ready error:', String(e?.message || e));
      }
    }

    // Применяем URL по текущему режиму (api/webhook)
    try { await updateEndpointUrl(); } catch (e) { console.log('updateEndpointUrl error:', e?.message || e); }

    // УБИРАЕМ ДУБЛИРОВАНИЕ - heartbeat обработчик будет зарегистрирован далее в этом блоке
    console.log('[BG] Registering event listeners...');

    // После ready не накладываем дополнительные setConfig — конфиг единый

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
        // Дедупликация событий onLocation
        const eventHash = `${loc.coords.latitude.toFixed(6)}_${loc.coords.longitude.toFixed(6)}_${loc.timestamp}`;
        const now = Date.now();
        if (eventHash === lastLocationEventHash &&
          now - lastLocationEventTime < LOCATION_EVENT_DEDUP_MS) {
          console.log('[BG][location] Skip duplicate event (dedup):', eventHash.substring(0, 30));
          return;
        }

        lastLocationEventHash = eventHash;
        lastLocationEventTime = now;

        console.log('[BG][location]', loc.coords.latitude, loc.coords.longitude);
        console.log('[BG][location] timestamp:', loc.timestamp, 'formatted:', new Date(loc.timestamp).toISOString(), 'unix:', Math.floor((typeof loc.timestamp === 'number' ? loc.timestamp : new Date(loc.timestamp).getTime()) / 1000));
        console.log('🔵  Acquired motionchange position, isMoving:', loc.isMoving);

        // Мониторинг накопления записей в очереди
        BGGeo.getCount().then(count => {
          console.log(`[BG][queue] Records in queue: ${count}`);

          // Отправляем статус очереди в webhook каждые 5 записей
          if (count % 5 === 0) {
            postBgEvent('queue_status', {
              count: count,
              threshold: geoConfig.AUTO_SYNC_THRESHOLD,
              readyForBatch: count >= geoConfig.AUTO_SYNC_THRESHOLD,
              timestamp: new Date().toISOString()
            }, { type: 'queue_status', level: 'info' }).catch(() => { });
          }
        }).catch(() => { });

        // Отправка в мониторинговый webhook (в дополнение к нативному uploader'у)
        if (webhookEnabled()) {
          const tsSec = Math.floor((typeof loc.timestamp === 'number' ? loc.timestamp : new Date(loc.timestamp).getTime()) / 1000);
          const nowSec = Math.floor(Date.now() / 1000);

          // Не отправляем старые точки (старше 2 минут) в мониторинг
          if (nowSec - tsSec > 120) {
            console.log('[BG][location] Skip monitoring webhook: location too old', nowSec - tsSec, 'seconds');
            return;
          }

          // Throttle: не чаще 1 раза в 30 секунд и по изменению координат
          const key = `${loc.coords.latitude.toFixed(6)},${loc.coords.longitude.toFixed(6)}:${tsSec}`;
          if (nowSec - lastMonitorLocationSentAtSec >= MONITOR_THROTTLE_SEC || key !== lastMonitorLocationHash) {
            lastMonitorLocationSentAtSec = nowSec;
            lastMonitorLocationHash = key;
            sendLocationToWebhookApi({
              lat: loc.coords.latitude,
              lon: loc.coords.longitude,
              accuracy: loc.coords.accuracy,
              speed: loc.coords.speed,
              heading: loc.coords.heading,
              ts: tsSec,              // секунды
              batt: loc.battery?.level,
              motion: loc.activity?.type,
              alt: loc.coords.altitude,
              altmsl: loc.coords.altitude,
              userId: currentUserId,
              placeId: currentPlaceId,
              phoneImei: currentPhoneImei
            }).catch(() => { });
          } else {
            console.log('[WEBHOOK][throttle] skip duplicate/too-soon location');
          }
        }

        // Отправка данных через встроенный autoSync (best practice Transistorsoft)
        console.log('[BG][location] Debug - currentUserId:', currentUserId, 'isMoving:', loc.isMoving);
        console.log('[BG][location] Using native autoSync uploader (Transistorsoft best practice)');
      });

      BGGeo.onMotionChange(e => {
        console.log('[BG][motionchange]', e.isMoving);
        console.log('🔵  setPace:', e.isMoving);
        postBgEvent('motionchange', { isMoving: e.isMoving }, { type: 'motion_change', level: 'info' });
      });

      // Мониторинг batch-отправок через onSync (если доступен)
      if (BGGeo.onSync) {
        BGGeo.onSync((batch) => {
          console.log('='.repeat(80));
          console.log('📦 BGEO BATCH SYNC EVENT');
          console.log('='.repeat(80));
          console.log('📊 Batch size:', batch.length);
          console.log('📋 Batch data:', JSON.stringify(batch, null, 2));

          // Отправляем информацию о batch в мониторинговый webhook
          postBgEvent('batch_sync', {
            batchSize: batch.length,
            timestamp: new Date().toISOString(),
            firstLocation: batch[0] ? {
              lat: batch[0].coords?.latitude,
              lon: batch[0].coords?.longitude,
              timestamp: batch[0].timestamp
            } : null,
            lastLocation: batch[batch.length - 1] ? {
              lat: batch[batch.length - 1].coords?.latitude,
              lon: batch[batch.length - 1].coords?.longitude,
              timestamp: batch[batch.length - 1].timestamp
            } : null
          }, { type: 'sync', level: 'info' }).catch(() => { });
        });
      }

      BGGeo.onHttp(async (r) => {
        // Детальный мониторинг встроенного uploader'а Transistorsoft
        console.log('='.repeat(80));
        console.log('🌐 NATIVE BGEO HTTP EVENT');
        console.log('='.repeat(80));
        console.log('📡 URL:', r.url);
        console.log('📊 Status:', r.status);
        console.log('📋 Headers:', JSON.stringify(r.requestHeaders, null, 2));
        console.log('📋 Request Body Length:', r.requestBody?.length || 0);
        console.log('📋 Full Response Object Keys:', Object.keys(r));
        console.log('📋 Response Text:', r.responseText);
        console.log('📋 Success:', r.success);

        // Анализ batch данных
        let batchData = null;
        let recordCount = 0;
        let isBatchRequest = false;

        try {
          if (r.requestBody) {
            batchData = JSON.parse(r.requestBody);
            if (batchData.geo_array && Array.isArray(batchData.geo_array)) {
              recordCount = batchData.geo_array.length;
              isBatchRequest = true;
              console.log('📦 BATCH DATA DETECTED:');
              console.log('   Records count:', recordCount);
              console.log('   First record:', JSON.stringify(batchData.geo_array[0], null, 2));
              if (recordCount > 1) {
                console.log('   Last record:', JSON.stringify(batchData.geo_array[recordCount - 1], null, 2));
              }
            } else {
              console.log('📦 SINGLE RECORD DATA:');
              console.log('   Data:', JSON.stringify(batchData, null, 2));
            }
          } else {
            console.log('📦 NO REQUEST BODY - checking response for batch info');
            // Анализируем responseText для определения batch
            if (r.responseText) {
              try {
                const responseData = JSON.parse(r.responseText);
                if (responseData.geo_data_saved && responseData.geo_data_saved > 1) {
                  isBatchRequest = true;
                  recordCount = responseData.geo_data_saved;
                  console.log('📦 BATCH DETECTED FROM RESPONSE:');
                  console.log('   Records saved:', recordCount);
                }
              } catch (e) {
                console.log('📦 Response Text (raw):', r.responseText);
              }
            }
          }
        } catch (e) {
          console.log('📦 Request Body (raw):', r.requestBody?.substring(0, 500) + '...');
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
        if (r.status === 200 || r.status === 201) {
          console.log('✅ NATIVE UPLOADER SUCCESS:', r.status, `(${recordCount} records, batch: ${isBatchRequest})`);
          try { global.__LAST_DB_SAVE_AT__ = new Date().toISOString(); } catch { }
          console.log('[BG][onHttp] Native uploader sent successfully');

          // Логируем успешную отправку для удалённого мониторинга
          logToRemote(`Native uploader success: ${recordCount} records, batch: ${isBatchRequest}, status: ${r.status}`, 'info');
        } else {
          console.log('❌ NATIVE UPLOADER ERROR:', r.status, r.responseText);
          logToRemote(`Native uploader error: status ${r.status}, response: ${r.responseText}`, 'error');
        }

        // Отправка детального статуса в мониторинговый webhook
        postBgEvent('native_uploader', {
          url: r.url,
          status: r.status,
          recordCount: recordCount,
          batchSize: recordCount,
          isBatchRequest: isBatchRequest,
          timestamp: new Date().toISOString(),
          success: r.status === 200 || r.status === 201,
          responseText: r.responseText?.substring(0, 200) || ''
        }, {
          type: 'native_uploader',
          level: (r.status === 200 || r.status === 201) ? 'info' : 'error'
        }).catch(() => { });
      });


      // Экспортируем функции для удалённого мониторинга
      global.sendRemoteLogs = sendRemoteLogs;
      global.logToRemote = logToRemote;

      // onError не существует в API Transistorsoft, используем onHttp для обработки ошибок

      BGGeo.onProviderChange(async (p) => {
        console.log('[BG][provider]', p.status, p.gps);
        console.log('🔵  Provider change:', p.status);
        postBgEvent('providerchange', p, { type: 'provider_change', level: 'info' });

        // Обработка отзыва разрешений
        if (p.status === 'DENIED' || p.status === 'RESTRICTED') {
          console.log('[BG] Permissions revoked detected via providerChange');
          await handlePermissionRevocation();
        }
      });

      BGGeo.onActivityChange(e => {
        console.log('[BG][activity]', e.activity, e.confidence);
        console.log('🚘  DetectedActivity [type=' + e.activity + ', confidence=' + e.confidence + ']');
        postBgEvent('activitychange', e, { type: 'activity_change', level: 'info' });
      });

      BGGeo.onEnabledChange(enabled => {
        console.log('[BG][enabledChange]', enabled);
        console.log('✅  Started in foreground');
        postBgEvent('enabledchange', { enabled }, { type: 'enabled_change', level: 'info' });
      });

      BGGeo.onConnectivityChange(async (ev) => {
        console.log('[BG][connectivity]', ev.connected);
        console.log('🔵  Connectivity change:', ev.connected);
        postBgEvent('connectivity', ev, { type: 'connectivity', level: 'info' });
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
        postBgEvent('authorization', auth, { type: 'authorization', level: 'info' });

        // Если авторизация отозвана
        if (auth.status === 'DENIED' || auth.status === 'RESTRICTED') {
          console.log('[BG] Location authorization revoked detected via onAuthorization');
          await handlePermissionRevocation();
        }
      });

      // Heartbeat: только прогреваем координату (no persist) — отправку делает нативный uploader
      BGGeo.onHeartbeat(async () => {
        try {
          const loc = await BGGeo.getCurrentPosition({
            samples: 1,
            timeout: 20,
            desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
            persist: false,
            maximumAge: 0
          });
          console.log('[BG][heartbeat] warm location (no persist):', loc?.coords?.latitude, loc?.coords?.longitude);
          postBgEvent('heartbeat', { lat: loc?.coords?.latitude, lon: loc?.coords?.longitude }, { type: 'heartbeat', level: 'info' });
          // Сразу после persist пытаемся синхронизировать накопленные точки
          try {
            await BGGeo.sync();
            console.log('[BG][heartbeat] sync() triggered');
          } catch (e) {
            console.log('[BG][heartbeat] sync error:', String(e?.message || e));
          }
        } catch (e) {
          console.log('[BG][heartbeat] getCurrentPosition error:', String(e?.message || e));
          postBgEvent('heartbeat_error', { message: String(e?.message || e) }, { type: 'heartbeat_error', level: 'error' });
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
    postBgEvent('init_success', {
      enabled: finalState.enabled,
      isMoving: finalState.isMoving
    }, { type: 'init', level: 'info' }).catch(() => { });

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
    postBgEvent('init_error', {
      message: lastInitError
    }, { type: 'init', level: 'error' }).catch(() => { });
  }
}

// Функции для управления трекингом
export async function startTracking(userId) {
  if (!BGGeo) {
    console.warn('BGGeo not initialized');
    postBgEvent('start_tracking_error', { reason: 'BGGeo_not_initialized' }, { type: 'tracking', level: 'error' }).catch(() => { });
    return;
  }

  // Сохраняем currentUserId для transform
  currentUserId = userId;
  postBgEvent('start_tracking', { userId }, { type: 'tracking', level: 'info' }).catch(() => { });

  // Обновляем только user-зависимые параметры и секьюрные значения из ENV
  const geoConfig = getGeoConfig();
  await BGGeo.setConfig({
    distanceFilter: geoConfig.DISTANCE_FILTER,
    heartbeatInterval: geoConfig.HEARTBEAT_INTERVAL,
    url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DB_SAVE}`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Config?.API_TOKEN || ''}`
    },
    params: {
      api_token: Config?.API_TOKEN || '',
      user_id: userId || 0,
      place_id: currentPlaceId || 1,
      phone_imei: currentPhoneImei || 'unknown'
    }
  });
  console.log('[BG] Updated config with user params');

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
  } catch { }

  isStartingTracking = true;
  logNative('[TRACK] startTracking called', { userId });

  // Heartbeat handler уже зарегистрирован в initLocation(); дублирование не требуется

  // Дополнительные setConfig не требуются — стартуем при необходимости

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
      } catch { }
    } else {
      console.log('[BG] start() error:', msg);
      postBgEvent('start_tracking_error', { message: msg }, { type: 'tracking', level: 'error' }).catch(() => { });
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
        persist: false,
        maximumAge: 0,
      });
      console.log('[BG] getCurrentPosition warmed up (no persist):', loc?.coords?.latitude, loc?.coords?.longitude);
    } catch (e) {
      console.log('[BG] getCurrentPosition error:', String(e?.message || e));
    }
  }

  const state = await BGGeo.getState();
  logNative('[TRACK] state after start', { enabled: state.enabled, isMoving: state.isMoving });
  postBgEvent('start_tracking_state', { enabled: state.enabled, isMoving: state.isMoving }, { type: 'tracking', level: 'info' }).catch(() => { });

  // Сообщаем, что пользователь вошёл и трекинг активирован
  postBgEvent('session_state', {
    action: 'login',
    userId,
    enabled: state.enabled,
    isMoving: state.isMoving
  }, { type: 'session', level: 'info' }).catch(() => { });
}

export async function stopTracking() {
  if (!BGGeo) {
    console.warn('BGGeo not initialized');
    postBgEvent('stop_tracking_error', { reason: 'BGGeo_not_initialized' }, { type: 'tracking', level: 'error' }).catch(() => { });
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
    postBgEvent('stop_tracking_sync_error', { message: String(e?.message || e) }, { type: 'tracking', level: 'error' }).catch(() => { });
  }

  await BGGeo.stop();
  postBgEvent('stop_tracking', {}, { type: 'tracking', level: 'info' }).catch(() => { });

  if (Platform.OS === 'android' && Config.BG_FORCE_PACE_ON_START === '1') {
    try {
      await BGGeo.changePace(false);
    } catch { }
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
      ? `${Config?.API_URL}/webhook/`
      : (Config?.BG_WEBHOOK_URL || `${Config?.API_URL}/api/db_save/`);

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
  } catch { }
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
    license: currentLicense,
    licensePresent: !!currentLicense,
    licenseMasked: mask(currentLicense),
    licenseLength: currentLicense ? currentLicense.length : 0,
    envVarPrimary: licenseSourceMeta.envVarPrimary,
    envVarFallback: licenseSourceMeta.envVarFallback,
    primaryPresent: licenseSourceMeta.primaryPresent,
    fallbackUsed: licenseSourceMeta.fallbackUsed,
    defaultFallbackUsed: licenseSourceMeta.defaultFallbackUsed,
  };
}

export function getBgGeoInitStatus() {
  return {
    initAttempted,
    initSucceeded,
    lastInitError,
    isInit,
    isStartingTracking,
    hasLicense: !!currentLicense,
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
      api_token: Config?.API_TOKEN || '',
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
      'Authorization': 'Bearer wqHJerK834'
    }, null, 2));
    console.log('='.repeat(80));

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DB_SAVE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer wqHJerK834'
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

// Функция для принудительного обновления конфигурации BGGeo
export async function forceReconfigureBgGeo() {
  if (!BGGeo) {
    console.warn('BGGeo not initialized');
    return;
  }

  try {
    console.log('[BG] Force reconfiguring BGGeo with updated locationTemplate...');

    // Обновляем конфигурацию с новым locationTemplate
    await BGGeo.setConfig({
      locationTemplate: createLocationTemplate(),
      url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DB_SAVE}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Config?.API_TOKEN || ''}`
      },
      params: {
        api_token: Config?.API_TOKEN || '',
        user_id: currentUserId || 0,
        place_id: currentPlaceId || 1,
        phone_imei: currentPhoneImei || 'unknown'
      }
    });

    console.log('[BG] BGGeo reconfigured successfully');

    // Принудительно синхронизируем накопленные данные
    const count = await BGGeo.getCount();
    console.log('[BG] Force sync after reconfig:', count, 'records');
    if (count > 0) {
      await BGGeo.sync();
      console.log('[BG] Force sync completed');
    }

  } catch (error) {
    console.error('[BG] Force reconfig error:', error);
  }
}

// Экспорт тестовых функций для отладки
export { testFetch, testRealApi };
