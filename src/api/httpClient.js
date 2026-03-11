import axios from 'axios';
import { API_CONFIG } from '../config/api';

const httpClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: 10000,
});

httpClient.interceptors.request.use((config) => {
  config.headers['Content-Type'] = 'application/json';
  config.headers['Authorization'] = `Bearer ${API_CONFIG.API_TOKEN}`;
  return config;
});

export default httpClient;
