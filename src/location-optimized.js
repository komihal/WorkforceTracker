// Оптимизированный BG-сервис с минимальной конфигурацией
let BGGeo;

import Config from 'react-native-config';
import { ensureBatteryOptimizationDisabled } from './utils/batteryOptimization';
import { Platform, AppState } from 'react-native';
import authService from './services/authService';
import { getGeoConfig } from './config/geoConfig';
import { sendLocationToWebhook as sendLocationToWebhookApi, sendToWebhook as sendToWebhookApi } from './config/api';

// Глобальные переменные
let currentUserId = null;
let currentPlaceId = 1;
let currentPhoneImei = null;
let isInit = false;
let initAttempted = false;
let initSucceeded = false;
let listenersRegistered = false;

// Включение мониторинга событий
const webhookEnabled = () => String(Config?.WEBHOOK_MONITOR || '1') === '1';

// Универсальная отправка событий BGGeo в мониторинговый webhook
const postBgEvent = async (event, payload = {}) => {
  if (!webhookEnabled()) return;
  try {
    await sendToWebhookApi({
      type: 'bg_event',
      event,
      payload,
      userId: currentUserId,
      placeId: currentPlaceId,
      phoneImei: currentPhoneImei,
      ts: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    console.log('[WEBHOOK] Error sending bg event:', error.message);
  }
};

// Функция для создания locationTemplate
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

// Получение лицензии
const getLicenseInfo = () => {
  const license = Config?.BG_LICENSE_KEY || Config?.LICENSE_KEY;
  return {
    key: license ? license.substring(0, 8) + '...' : 'none',
    source: license ? 'env' : 'fallback'
  };
};

// Основная инициализация BGGeo
export async function initLocation() {
  console.log(`[${new Date().toLocaleTimeString()}] ===== INIT LOCATION START =====`);
  
  if (isInit) {
    console.log('[BG] Already initialized, skipping');
    return;
  }
  
  isInit = true;
  initAttempted = true;
  
  if (!BGGeo) {
    try {
      BGGeo = require('react-native-background-geolocation').default;
    } catch (error) {
      console.error('Failed to import BackgroundGeolocation:', error);
      return;
    }
  }
  
  const geoConfig = getGeoConfig();
  const licenseInfo = getLicenseInfo();
  
  console.log('[BG] Initializing with config:', {
    distanceFilter: geoConfig.DISTANCE_FILTER,
    heartbeatInterval: geoConfig.HEARTBEAT_INTERVAL,
    autoSync: true,
    batchSync: true,
    license: licenseInfo.source
  });
  
  try {
    // Основная конфигурация BGGeo
    await BGGeo.ready({
      // Основные настройки
      reset: false,
      debug: __DEV__,
      logLevel: __DEV__ ? BGGeo.LOG_LEVEL_VERBOSE : BGGeo.LOG_LEVEL_ERROR,
      
      // Лицензия
      license: Config?.BG_LICENSE_KEY || Config?.LICENSE_KEY || '7d1976aa376fbcf7e40d12892c8dab579985abbcbc09e1da570826649b4295cf',
      
      // Настройки точности
      desiredAccuracy: BGGeo.DESIRED_ACCURACY_HIGH,
      distanceFilter: geoConfig.DISTANCE_FILTER,
      stationaryRadius: 25,
      
      // Интервалы
      heartbeatInterval: geoConfig.HEARTBEAT_INTERVAL,
      locationUpdateInterval: 1000,
      
      // Фоновый режим
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      foregroundService: true,
      
      // Android уведомления
      notification: {
        title: 'Location Service',
        text: 'Tracking your location',
        color: '#000000',
        channelName: 'Location',
        priority: BGGeo.NOTIFICATION_PRIORITY_LOW
      },
      
      // Автоматическая отправка (встроенный uploader)
      autoSync: true,
      batchSync: true,
      autoSyncThreshold: geoConfig.AUTO_SYNC_THRESHOLD,
      url: Config?.BG_WEBHOOK_URL || `${Config?.API_URL}/api/db_save/`,
      httpTimeout: 60000,
      maxRecordsToPersist: 10000,
      
      // Параметры запроса
      params: {
        api_token: Config?.API_TOKEN || '',
        user_id: currentUserId,
        place_id: currentPlaceId || 1,
        phone_imei: currentPhoneImei || 'unknown'
      },
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Config?.API_TOKEN || ''}`
      },
      
      // Формирование тела запроса
      method: 'POST',
      httpRootProperty: "geo_array",
      locationTemplate: createLocationTemplate(),
    });
    
    console.log('[BG] BackgroundGeolocation ready completed');
    
    // Регистрация обработчиков событий
    if (!listenersRegistered) {
      listenersRegistered = true;
      
      // Основной обработчик локации
      BGGeo.onLocation(loc => {
        console.log('[BG][location]', loc.coords.latitude, loc.coords.longitude);
        
        // Мониторинговый webhook (с троттлингом)
        if (webhookEnabled()) {
          const tsSec = Math.floor((typeof loc.timestamp === 'number' ? loc.timestamp : new Date(loc.timestamp).getTime()) / 1000);
          const nowSec = Math.floor(Date.now() / 1000);
          
          // Не отправляем старые точки (старше 2 минут)
          if (nowSec - tsSec > 120) {
            console.log('[BG][location] Skip monitoring webhook: location too old');
            return;
          }
          
          // Простой троттлинг: не чаще раза в 30 секунд
          const key = `${loc.coords.latitude.toFixed(6)},${loc.coords.longitude.toFixed(6)}`;
          const lastKey = global.__LAST_MONITOR_KEY || '';
          const lastTime = global.__LAST_MONITOR_TIME || 0;
          
          if (key !== lastKey || nowSec - lastTime >= 30) {
            global.__LAST_MONITOR_KEY = key;
            global.__LAST_MONITOR_TIME = nowSec;
            
            sendLocationToWebhookApi({
              lat: loc.coords.latitude,
              lon: loc.coords.longitude,
              accuracy: loc.coords.accuracy,
              speed: loc.coords.speed,
              heading: loc.coords.heading,
              ts: tsSec,
              batt: loc.battery?.level || -1,
              motion: loc.isMoving ? 'moving' : 'still',
              alt: loc.coords.altitude || 0,
              altmsl: loc.coords.altitude || 0,
              userId: currentUserId,
              placeId: currentPlaceId,
              phoneImei: currentPhoneImei
            }).catch(() => {});
          }
        }
        
        console.log('[BG][location] Using native autoSync uploader (Transistorsoft best practice)');
      });
      
      // Обработчик движения
      BGGeo.onMotionChange(e => {
        console.log('[BG][motionchange]', e.isMoving);
        postBgEvent('motionchange', { isMoving: e.isMoving });
      });
      
      // Мониторинг HTTP-запросов
      BGGeo.onHttp(async (r) => {
        console.log('🌐 NATIVE UPLOADER HTTP REQUEST');
        console.log('📡 URL:', r.url);
        console.log('📊 Status:', r.status);
        
        if (r.status === 200) {
          console.log('✅ NATIVE UPLOADER SUCCESS:', r.status);
          try { global.__LAST_DB_SAVE_AT__ = new Date().toISOString(); } catch {}
        } else {
          console.log('❌ NATIVE UPLOADER ERROR:', r.status, r.responseText);
        }
        
        // Отправка статуса в мониторинговый webhook
        postBgEvent('http', { url: r.url, status: r.status, type: 'native_uploader' }).catch(() => {});
      });
    }
    
    initSucceeded = true;
    console.log('[BG] BackgroundGeolocation initialization completed successfully');
    
  } catch (error) {
    console.error('[BG] BackgroundGeolocation initialization failed:', error);
    initSucceeded = false;
  }
}

// Управление трекингом
export async function startTracking(userId) {
  if (!BGGeo) {
    console.warn('BGGeo not initialized');
    return;
  }
  
  currentUserId = userId;
  
  try {
    const state = await BGGeo.getState();
    if (state?.enabled) {
      console.log('[BG] Already enabled, skipping start');
      return;
    }
    
    await BGGeo.start();
    console.log('[BG] Tracking started for user:', userId);
    
  } catch (error) {
    console.error('[BG] Failed to start tracking:', error);
  }
}

export async function stopTracking() {
  if (!BGGeo) {
    console.warn('BGGeo not initialized');
    return;
  }
  
  try {
    // Синхронизируем накопленные точки перед остановкой
    const count = await BGGeo.getCount();
    if (count > 0) {
      console.log('[BG] Syncing', count, 'points before stopping');
      await BGGeo.sync();
    }
    
    await BGGeo.stop();
    console.log('[BG] Tracking stopped');
    
  } catch (error) {
    console.error('[BG] Failed to stop tracking:', error);
  }
}

// Сброс состояния
export async function resetLocationInit() {
  console.log('Resetting location initialization state...');
  
  try {
    if (BGGeo) {
      const state = await BGGeo.getState();
      if (state.enabled) {
        await BGGeo.stop();
      }
      await BGGeo.destroyLocations();
      await BGGeo.destroyLog();
      BGGeo.removeListeners();
    }
  } catch (error) {
    console.log('Error resetting BGGeo:', error.message);
  }
  
  isInit = false;
  initAttempted = false;
  initSucceeded = false;
  listenersRegistered = false;
  currentUserId = null;
  console.log('Location state reset completed');
}

// Экспорт для совместимости
export async function initBgGeo() {
  return await initLocation();
}

export function removeListeners() {
  BGGeo?.removeListeners();
}

export function getBgGeoInitStatus() {
  return {
    initAttempted,
    initSucceeded,
    isInit,
    listenersRegistered
  };
}

export function getLicenseInfo() {
  const license = Config?.BG_LICENSE_KEY || Config?.LICENSE_KEY;
  return {
    key: license ? license.substring(0, 8) + '...' : 'none',
    source: license ? 'env' : 'fallback'
  };
}

// Совместимость с UI
export async function getBatteryWhitelistStatus() {
  try {
    if (!BGGeo) return { available: false, ignored: false };
    return await ensureBatteryOptimizationDisabled();
  } catch (error) {
    return { available: false, ignored: false, error: error.message };
  }
}

export async function ensureBatteryWhitelistUI() {
  try {
    return await ensureBatteryOptimizationDisabled();
  } catch (error) {
    console.error('Battery whitelist error:', error);
    return { success: false, error: error.message };
  }
}
