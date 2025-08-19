import BackgroundGeolocation from 'react-native-background-geolocation';
import { postLocation } from './api';
import Config from 'react-native-config';
import { Platform } from 'react-native';

let isInit = false;

export async function initLocation() {
  if (isInit) return;
  isInit = true;

  // Читаем платформенный ключ лицензии из .env через react-native-config
  const license = Platform.select({
    android: Config.BG_GEO_LICENSE_ANDROID,
    ios: Config.BG_GEO_LICENSE_IOS,
    default: null,
  });

  if (!license) {
    const platform = Platform.OS;
    const varName = platform === 'ios' ? 'BG_GEO_LICENSE_IOS' : 'BG_GEO_LICENSE_ANDROID';
    console.warn(`BackgroundGeolocation: лицензия для ${platform} не задана (${varName}). Инициализация пропущена.`);
    return;
  }

  BackgroundGeolocation.onLocation(async (location) => {
    const c = location.coords || {};
    const ts = new Date(location.timestamp || Date.now()).toISOString();
    const batt = location.battery?.level ?? null;
    const motion = location.activity?.type ?? null;

    // Только отправляем если API настроен
    if (Config.API_URL && Config.API_URL !== 'https://api.example.com') {
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
        });
      } catch (e) {
        console.error('Ошибка отправки местоположения:', e);
      }
    } else {
      console.log('API не настроен, местоположение не отправляется');
    }
  });

  BackgroundGeolocation.onError((e) => {
    console.log('BGGeo error', e);
  });

  BackgroundGeolocation.ready({
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    distanceFilter: 20,
    stopOnTerminate: false,
    startOnBoot: true,
    pausesLocationUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: true,
    url: Config.API_URL ? `${Config.API_URL}/locations` : undefined,
    method: 'POST',
    autoSync: Config.API_URL ? true : false,
    batchSync: Config.API_URL ? true : false,
    maxBatchSize: 20,
    headers: Config.API_TOKEN ? { Authorization: `Bearer ${Config.API_TOKEN}` } : {},
    logLevel: BackgroundGeolocation.LOG_LEVEL_INFO,
    license,
  }, (state) => {
    if (!state.enabled) BackgroundGeolocation.start();
  });
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
