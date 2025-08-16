import axios from 'axios';
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
        this.saveUserData(response.data);
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
      // Данные сохраняются только в памяти (временное решение)
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  }

  async clearUserData() {
    try {
      this.currentUser = null;
      // Данные очищаются только из памяти
    } catch (error) {
      console.error('Error clearing user data:', error);
    }
  }

  async getCurrentUser() {
    // Возвращаем пользователя только из памяти
    return this.currentUser || null;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }
}

export default new AuthService();

