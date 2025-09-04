import axios from 'axios';
import authService from './services/authService';

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

  // Отправляем в формате, который ожидает DBSaveView
  const payload = {
    api_token: 'wqHJerK834',
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
  
  console.log('postLocation: Sending payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await api.post('/db_save/', payload, { 
      headers: { 
        'Content-Type': 'application/json' 
      } 
    });
    console.log(`[${new Date().toLocaleTimeString()}] postLocation success:`, response.status, response.data);
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

  const payload = {
    api_token: 'wqHJerK834',
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
