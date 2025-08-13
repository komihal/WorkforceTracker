import axios from 'axios';
import Config from 'react-native-config';

const api = axios.create({
  baseURL: Config.API_URL || 'https://api.example.com',
  timeout: 10000,
});

api.interceptors.request.use(cfg => {
  if (Config.API_TOKEN) cfg.headers.Authorization = `Bearer ${Config.API_TOKEN}`;
  cfg.headers['Content-Type'] = 'application/json';
  return cfg;
});

export async function postLocation({ lat, lon, accuracy, speed, heading, ts, batt, motion }) {
  return api.post('/locations', { lat, lon, accuracy, speed, heading, ts, batt, motion });
}
