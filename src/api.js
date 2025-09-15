import axios from 'axios';
import authService from './services/authService';
import Config from 'react-native-config';
// import { refreshShiftStatusNow } from './services/shiftStatusService'; // Убираем автоматический refresh

const api = axios.create({
  baseURL: 'https://api.tabelshik.com',
  timeout: 10000,
});

api.interceptors.request.use(cfg => {
  cfg.headers['Content-Type'] = 'application/json';
  cfg.headers['Api-token'] = 'wqHJerK834';
  return cfg;
});

export async function postLocation({ lat, lon, accuracy, speed, heading, ts, batt, motion, alt, altmsl }) {
  console.log(`[${new Date().toLocaleTimeString()}] postLocation called with:`, { lat, lon, accuracy, ts });
  
  // Получаем текущего пользователя для user_id
  const currentUser = await authService.getCurrentUser();
  if (!currentUser || !currentUser.user_id) {
    console.error('postLocation: User not authenticated or user_id not found');
    throw new Error('Пользователь не аутентифицирован или user_id не найден');
  }

  console.log('postLocation: Current user:', currentUser.user_id);

  // Отправляем в формате, который ожидает DBSaveView согласно требованиям бекенда
  const deviceId = await (async () => {
    try {
      const deviceUtils = require('./utils/deviceUtils').default;
      return await deviceUtils.getDeviceId();
    } catch (e) {
      return Config.DEVICE_IMEI || 'unknown-device';
    }
  })();

  const payload = {
    api_token: 'wqHJerK834',
    user_id: currentUser.user_id,
    place_id: 1, // Исправлено: должно быть 1 согласно требованиям бекенда
    phone_imei: deviceId,
    geo_array: [{
      lat: lat,
      lon: lon,
      utm: Math.floor(new Date(ts).getTime() / 1000).toString(), // Исправлено: должно быть строкой
      alt: alt || 0,
      altmsl: (typeof altmsl === 'number' ? altmsl : (alt || 0)),
      hasalt: Boolean(alt),
      hasaltmsl: Boolean(typeof altmsl === 'number' ? altmsl : alt),
      hasaltmslaccuracy: Boolean(accuracy && accuracy < 5), // Исправлено: убрана опечатка в названии поля
      mslaccuracyMeters: accuracy || 0, // Исправлено: убрана опечатка в названии поля
    }],
  };
  
  console.log('postLocation: Sending payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await api.post('/api/db_save/', payload, { 
      headers: { 
        'Content-Type': 'application/json' 
      } 
    });
    console.log(`[${new Date().toLocaleTimeString()}] postLocation success:`, response.status, response.data);
    try { global.__LAST_DB_SAVE_AT__ = new Date().toISOString(); } catch {}
    // Убираем автоматический refresh - теперь статус обновляется по требованию
    console.log('[API] Location data posted successfully');
    return response;
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] postLocation error:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
}

// Функция для отправки множественных координат
export async function postLocationBatch(locations) {
  // Получаем текущего пользователя для user_id
  const currentUser = await authService.getCurrentUser();
  if (!currentUser || !currentUser.user_id) {
    throw new Error('Пользователь не аутентифицирован или user_id не найден');
  }

  const deviceId = await (async () => {
    try {
      const deviceUtils = require('./utils/deviceUtils').default;
      return await deviceUtils.getDeviceId();
    } catch (e) {
      return Config.DEVICE_IMEI || 'unknown-device';
    }
  })();

  const payload = {
    api_token: 'wqHJerK834',
    user_id: currentUser.user_id,
    place_id: 1, // Исправлено: должно быть 1 согласно требованиям бекенда
    phone_imei: deviceId,
    geo_array: locations.map(loc => ({
      lat: loc.lat,
      lon: loc.lon,
      utm: Math.floor(new Date(loc.ts).getTime() / 1000).toString(), // Исправлено: должно быть строкой
      alt: loc.alt || 0,
      altmsl: (typeof loc.altmsl === 'number' ? loc.altmsl : (loc.alt || 0)),
      hasalt: Boolean(loc.alt),
      hasaltmsl: Boolean(typeof loc.altmsl === 'number' ? loc.altmsl : loc.alt),
      hasaltmslaccuracy: Boolean(loc.accuracy && loc.accuracy < 5), // Исправлено: убрана опечатка в названии поля
      mslaccuracyMeters: loc.accuracy || 0, // Исправлено: убрана опечатка в названии поля
    })),
  };
  
  const response = await api.post('/api/db_save/', payload, { 
    headers: { 
      'Content-Type': 'application/json' 
    } 
  });
  try { global.__LAST_DB_SAVE_AT__ = new Date().toISOString(); } catch {}
  // Убираем автоматический refresh - теперь статус обновляется по требованию
  console.log('[API] Location batch posted successfully');
  return response;
}

// LEGACY — disabled by default
// Используйте встроенный uploader BG вместо ручных вызовов
export async function postLocationLegacy(locationData) {
  const useLegacy = Config.USE_LEGACY_POST_LOCATION === 'true';
  
  if (useLegacy) {
    console.warn('[LEGACY] postLocationLegacy is deprecated. Use BG built-in uploader instead.');
  } else {
    console.warn('[LEGACY] postLocationLegacy is disabled. Use BG built-in uploader instead.');
    return Promise.resolve({ success: false, error: 'Legacy postLocation disabled' });
  }
  
  // Legacy implementation (only if enabled)
  try {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const deviceId = await (async () => {
      try {
        const deviceUtils = require('./utils/deviceUtils').default;
        return await deviceUtils.getDeviceId();
      } catch (e) {
        return Config.DEVICE_IMEI || 'unknown-device';
      }
    })();

    const payload = {
      user_id: currentUser.user_id,
      place_id: 1,
      phone_imei: deviceId,
      geo_array: [{
        lat: locationData.lat,
        lon: locationData.lon,
        utm: Math.floor(Date.now() / 1000).toString(),
        alt: locationData.alt || 0,
        altmsl: (typeof locationData.altmsl === 'number' ? locationData.altmsl : (locationData.alt || 0)),
        hasalt: Boolean(locationData.alt),
        hasaltmsl: Boolean(typeof locationData.altmsl === 'number' ? locationData.altmsl : locationData.alt),
        hasaltmslaccuracy: Boolean(locationData.accuracy && locationData.accuracy < 5),
        mslaccuracyMeters: locationData.accuracy || 0,
      }],
      api_token: Config.API_TOKEN,
    };

    const response = await api.post('/api/db_save/', payload, { 
      headers: { 
        'Content-Type': 'application/json' 
      } 
    });

    try { global.__LAST_DB_SAVE_AT__ = new Date().toISOString(); } catch {}
    // Убираем автоматический refresh - теперь статус обновляется по требованию
    console.log('[API] Location data posted successfully');

    return { success: true, data: response.data };
  } catch (error) {
    console.error('Legacy postLocation error:', error);
    return { success: false, error: error.message };
  }
}
