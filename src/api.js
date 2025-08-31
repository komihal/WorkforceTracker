import axios from 'axios';
import Config from 'react-native-config';
import authService from './services/authService';

const api = axios.create({
  baseURL: Config.API_URL || 'https://api.example.com',
  timeout: 10000,
});

api.interceptors.request.use(cfg => {
  if (Config.API_TOKEN) cfg.headers.Authorization = `Bearer ${Config.API_TOKEN}`;
  cfg.headers['Content-Type'] = 'application/json';
  return cfg;
});

export async function postLocation({ lat, lon, accuracy, speed, heading, ts, batt, motion, alt, altmsl }) {
  // Получаем текущего пользователя для user_id
  const currentUser = await authService.getCurrentUser();
  if (!currentUser || !currentUser.user_id) {
    throw new Error('Пользователь не аутентифицирован или user_id не найден');
  }

  // Отправляем в формате, который ожидает DBSaveView
  const payload = {
    api_token: Config.API_TOKEN,
    user_id: currentUser.user_id,
    place_id: 2, // TODO: передавать реальный place_id
    phone_imei: "123456789012345", // TODO: передавать реальный IMEI устройства
    geo_array: [{
      lat: lat,
      lon: lon,
      utm: Math.floor(new Date(ts).getTime() / 1000),
      alt: alt || 0,
      altmsl: altmsl || 0,
      hasalt: Boolean(alt),
      hasaltmsl: Boolean(altmsl),
      hasaltmslaccucacy: Boolean(accuracy && accuracy < 5), // true если точность лучше 5 метров
      mslaccucacyMeters: accuracy || 0,
    }],
  };
  
  return api.post('/db_save/', payload, { 
    headers: { 
      'Content-Type': 'application/json' 
    } 
  });
}

// Функция для отправки множественных координат
export async function postLocationBatch(locations) {
  // Получаем текущего пользователя для user_id
  const currentUser = await authService.getCurrentUser();
  if (!currentUser || !currentUser.user_id) {
    throw new Error('Пользователь не аутентифицирован или user_id не найден');
  }

  const payload = {
    api_token: Config.API_TOKEN,
    user_id: currentUser.user_id,
    place_id: 2, // TODO: передавать реальный place_id
    phone_imei: "123456789012345", // TODO: передавать реальный IMEI устройства
    geo_array: locations.map(loc => ({
      lat: loc.lat,
      lon: loc.lon,
      utm: Math.floor(new Date(loc.ts).getTime() / 1000),
      alt: loc.alt || 0,
      altmsl: loc.altmsl || 0,
      hasalt: Boolean(loc.alt),
      hasaltmsl: Boolean(loc.altmsl),
      hasaltmslaccucacy: Boolean(loc.accuracy && loc.accuracy < 5),
      mslaccucacyMeters: loc.accuracy || 0,
    })),
  };
  
  return api.post('/db_save/', payload, { 
    headers: { 
      'Content-Type': 'application/json' 
    } 
  });
}
