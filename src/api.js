import authService from './services/authService';
import Config from 'react-native-config';
import { setLastGeoSaveAt } from './store/shiftStore';
import httpClient from './api/httpClient';

async function getDeviceId() {
  try {
    const deviceUtils = require('./utils/deviceUtils').default;
    return await deviceUtils.getDeviceId();
  } catch (e) {
    return Config.DEVICE_IMEI || 'unknown-device';
  }
}

export async function postLocation({ lat, lon, accuracy, ts, alt, altmsl }) {
  const currentUser = await authService.getCurrentUser();
  if (!currentUser || !currentUser.user_id) {
    throw new Error('Пользователь не аутентифицирован или user_id не найден');
  }

  const deviceId = await getDeviceId();

  const payload = {
    api_token: Config.API_TOKEN || '',
    user_id: currentUser.user_id,
    place_id: 1,
    phone_imei: deviceId,
    geo_array: [{
      lat,
      lon,
      utm: Math.floor(new Date(ts).getTime() / 1000).toString(),
      alt: alt || 0,
      altmsl: (typeof altmsl === 'number' ? altmsl : (alt || 0)),
      hasalt: Boolean(alt),
      hasaltmsl: Boolean(typeof altmsl === 'number' ? altmsl : alt),
      hasaltmslaccuracy: Boolean(accuracy && accuracy < 5),
      mslaccuracyMeters: accuracy || 0,
    }],
  };

  const response = await httpClient.post('/api/db_save/', payload);
  setLastGeoSaveAt(new Date().toISOString());
  return response;
}

export async function postLocationBatch(locations) {
  const currentUser = await authService.getCurrentUser();
  if (!currentUser || !currentUser.user_id) {
    throw new Error('Пользователь не аутентифицирован или user_id не найден');
  }

  const deviceId = await getDeviceId();

  const payload = {
    api_token: Config.API_TOKEN || '',
    user_id: currentUser.user_id,
    place_id: 1,
    phone_imei: deviceId,
    geo_array: locations.map(loc => ({
      lat: loc.lat,
      lon: loc.lon,
      utm: Math.floor(new Date(loc.ts).getTime() / 1000).toString(),
      alt: loc.alt || 0,
      altmsl: (typeof loc.altmsl === 'number' ? loc.altmsl : (loc.alt || 0)),
      hasalt: Boolean(loc.alt),
      hasaltmsl: Boolean(typeof loc.altmsl === 'number' ? loc.altmsl : loc.alt),
      hasaltmslaccuracy: Boolean(loc.accuracy && loc.accuracy < 5),
      mslaccuracyMeters: loc.accuracy || 0,
    })),
  };

  const response = await httpClient.post('/api/db_save/', payload);
  setLastGeoSaveAt(new Date().toISOString());
  return response;
}

// LEGACY — disabled by default
export async function postLocationLegacy(locationData) {
  const useLegacy = Config.USE_LEGACY_POST_LOCATION === 'true';
  if (!useLegacy) {
    return Promise.resolve({ success: false, error: 'Legacy postLocation disabled' });
  }

  try {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const deviceId = await getDeviceId();

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
      api_token: Config.API_TOKEN || '',
    };

    const response = await httpClient.post('/api/db_save/', payload);
    setLastGeoSaveAt(new Date().toISOString());
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
