/* eslint-disable */
import BackgroundGeolocation from 'react-native-background-geolocation';
import { postLocation } from './api';
import Config from 'react-native-config';
import { Platform } from 'react-native';
import { API_CONFIG } from './config/api';

let isInit = false;
let initAttempted = false;
let initSucceeded = false;
let lastInitError = null;
let currentLicense = null;
let currentEnvVarName = null;

export async function initLocation() {
  if (isInit) return;
  isInit = true;
  initAttempted = true;
  lastInitError = null;

  // Читаем платформенный ключ лицензии из .env через react-native-config
  const platform = Platform.OS;
  currentEnvVarName = platform === 'ios' ? 'BG_GEO_LICENSE_IOS' : 'BG_GEO_LICENSE_ANDROID';
  let license = Platform.select({
    android: Config.BG_GEO_LICENSE_ANDROID,
    ios: Config.BG_GEO_LICENSE_IOS,
    default: null,
  });
  // TEMP: Hardcode Android license for testing
  if (Platform.OS === 'android') {
    license = '7d1976aa376fbcf7e40d12892c8dab579985abbcbc09e1da570826649b4295cf';
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

  if (!license) {
    console.warn(`BackgroundGeolocation: лицензия для ${platform} не задана (${currentEnvVarName}). Инициализация пропущена.`);
    initSucceeded = false;
    return;
  }

  BackgroundGeolocation.onLocation(async (location) => {
    const c = location.coords || {};
    const ts = new Date(location.timestamp || Date.now()).toISOString();
    const batt = location.battery?.level ?? null;
    const motion = location.activity?.type ?? null;

    // Отправляем если API настроен и пользователь аутентифицирован
    if (API_CONFIG.BASE_URL && API_CONFIG.BASE_URL === 'https://api.tabelshik.com') {
      try {
        // Проверяем, что пользователь аутентифицирован
        const authService = require('./services/authService').default;
        const currentUser = await authService.getCurrentUser();
        
        if (currentUser && currentUser.user_id) {
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
        } else {
          console.log('Location received but user not authenticated, skipping API call');
        }
      } catch (e) {
        console.error('Ошибка отправки местоположения:', e);
      }
    } else {
      console.log('API не настроен, местоположение не отправляется');
    }
    
    // Также отправляем в BackgroundService для локального кэширования и фоновой отправки
    try {
      const backgroundService = require('./services/backgroundService').default;
      if (backgroundService.isRunning) {
        await backgroundService.handleBackgroundLocation(location);
      }
    } catch (e) {
      console.log('BackgroundService not available for location caching');
    }
  });

  BackgroundGeolocation.onError((e) => {
    console.log('BGGeo error', e);
    // Сохраняем последнюю ошибку для отображения статуса
    try {
      lastInitError = typeof e === 'string' ? e : (e?.message || JSON.stringify(e));
    } catch (_) {}
  });

  try {
    // Включаем логгер максимально подробно в dev, до ready
    if (__DEV__) {
      try {
        await BackgroundGeolocation.logger.setEnabled(true);
        await BackgroundGeolocation.logger.setLevel(BackgroundGeolocation.LOG_LEVEL_VERBOSE);
      } catch (_) {}
    }

    const state = await BackgroundGeolocation.ready({
      reset: true,
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 10,
      stopOnTerminate: false,
      startOnBoot: true,
      pausesLocationUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      // Отключаем автоматическую отправку - будем управлять вручную через BackgroundService
      autoSync: false,
      batchSync: false,
      // Убираем stopTimeout - пусть работает постоянно в фоне
      stopTimeout: 0,
      // Увеличиваем heartbeat для лучшей работы в фоне
      heartbeatInterval: 30,
      maxDaysToPersist: 7,
      debug: __DEV__ ? true : false,
      logLevel: __DEV__ ? BackgroundGeolocation.LOG_LEVEL_VERBOSE : BackgroundGeolocation.LOG_LEVEL_INFO,
      foregroundService: true,
      enableHeadless: true,
      // Настройки для Android
      notification: {
        title: 'WorkforceTracker',
        text: 'Отслеживание местоположения активно',
        channelName: 'Location Tracking',
        priority: BackgroundGeolocation.NOTIFICATION_PRIORITY_HIGH,
      },
      // Настройки для iOS
      showsBackgroundLocationIndicator: true,
      allowsBackgroundLocationUpdates: true,
      // Настройки для экономии батареи
      maxRecordsToPersist: 1000,
      persistMode: BackgroundGeolocation.PERSIST_MODE_LOCATION,
      license,
    });

    if (!state.enabled) {
      try {
        await BackgroundGeolocation.start();
      } catch (e) {
        lastInitError = e?.message || JSON.stringify(e);
        initSucceeded = false;
        return;
      }
    }
    initSucceeded = true;
  } catch (e) {
    initSucceeded = false;
    try {
      lastInitError = e?.message || JSON.stringify(e);
    } catch (_) {
      lastInitError = 'Неизвестная ошибка инициализации BackgroundGeolocation';
    }
    console.warn('BackgroundGeolocation init failed:', lastInitError);
  }
}

export async function startTracking() {
  await BackgroundGeolocation.start();
}

export async function stopTracking() {
  await BackgroundGeolocation.stop();
}

export function removeListeners() {
  BackgroundGeolocation.removeListeners();
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
      configAndroid: typeof Config.BG_GEO_LICENSE_ANDROID,
      configIOS: typeof Config.BG_GEO_LICENSE_IOS,
      hardcodedUsed: Platform.OS === 'android' && currentLicense === '7d1976aa376fbcf7e40d12892c8dab579985abbcbc09e1da570826649b4295cf'
    }
  };
}

export async function getBgGeoState() {
  try {
    const state = await BackgroundGeolocation.getState();
    return state;
  } catch (e) {
    return { error: e?.message || String(e) };
  }
}

export async function getOneShotPosition() {
  try {
    const location = await BackgroundGeolocation.getCurrentPosition({
      timeout: 15,
      samples: 1,
      persist: false,
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    });
    return location;
  } catch (e) {
    return { error: e?.message || String(e) };
  }
}

export async function getBgGeoLog() {
  try {
    const log = await BackgroundGeolocation.logger.getLog();
    return log;
  } catch (e) {
    return `log error: ${e?.message || String(e)}`;
  }
}

export async function searchBgGeoLog(needle) {
  try {
    const log = await BackgroundGeolocation.logger.getLog();
    if (!needle) return log;
    const lines = String(log).split('\n');
    const rx = new RegExp(needle, 'i');
    const hits = lines.filter((l) => rx.test(l));
    return hits.slice(-100).join('\n');
  } catch (e) {
    return `search error: ${e?.message || String(e)}`;
  }
}

export async function requestBgGeoPermission() {
  try {
    const status = await BackgroundGeolocation.requestPermission();
    return status; // { location, motion }
  } catch (e) {
    return { error: e?.message || String(e) };
  }
}
