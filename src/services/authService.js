import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, getAuthHeaders } from '../config/api';

class AuthService {
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: 10000,
    });
  }

  async login(userLogin, userPassword) {
    try {
      const response = await this.axiosInstance.post(API_CONFIG.ENDPOINTS.AUTH, {
        api_token: API_CONFIG.API_TOKEN,
        user_login: userLogin,
        user_password: userPassword,
      }, {
        headers: getAuthHeaders(),
      });

      if (response.data && response.data.success) {
        // Сохраняем данные пользователя
        await this.saveUserData(response.data);
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.data.message || 'Ошибка аутентификации' };
      }
    } catch (error) {
      console.error('Auth error:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка сети' 
      };
    }
  }

  async logout() {
    try {
      // Очищаем локальные данные
      await this.clearUserData();
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Ошибка при выходе' };
    }
  }

  async saveUserData(userData) {
    try {
      this.currentUser = userData;
      await AsyncStorage.setItem('current_user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  }

  async clearUserData() {
    try {
      this.currentUser = null;
      await AsyncStorage.removeItem('current_user');
    } catch (error) {
      console.error('Error clearing user data:', error);
    }
  }

  async getCurrentUser() {
    if (this.currentUser) return this.currentUser;
    try {
      const raw = await AsyncStorage.getItem('current_user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      this.currentUser = parsed;
      return parsed;
    } catch (error) {
      console.error('Error reading user from storage:', error);
      return null;
    }
  }

  isAuthenticated() {
    return !!this.currentUser;
  }
}

export default new AuthService();

