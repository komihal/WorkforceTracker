// Конфигурация для переключения между webhook и API
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'geo_endpoint_mode';

export const ENDPOINT_MODES = {
  API: 'api',        // Отправка на API Django
  WEBHOOK: 'webhook' // Отправка на webhook
};

class GeoEndpointConfig {
  constructor() {
    this.currentMode = ENDPOINT_MODES.API; // По умолчанию API
  }

  // Получение текущего режима
  async getCurrentMode() {
    try {
      const savedMode = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedMode && Object.values(ENDPOINT_MODES).includes(savedMode)) {
        this.currentMode = savedMode;
      }
      return this.currentMode;
    } catch (error) {
      console.error('Error getting geo endpoint mode:', error);
      return this.currentMode;
    }
  }

  // Установка режима
  async setMode(mode) {
    try {
      if (!Object.values(ENDPOINT_MODES).includes(mode)) {
        throw new Error(`Invalid endpoint mode: ${mode}`);
      }
      
      this.currentMode = mode;
      await AsyncStorage.setItem(STORAGE_KEY, mode);
      console.log(`Geo endpoint mode changed to: ${mode}`);
      return true;
    } catch (error) {
      console.error('Error setting geo endpoint mode:', error);
      return false;
    }
  }

  // Проверка, используется ли webhook
  async isWebhookMode() {
    const mode = await this.getCurrentMode();
    return mode === ENDPOINT_MODES.WEBHOOK;
  }

  // Проверка, используется ли API
  async isApiMode() {
    const mode = await this.getCurrentMode();
    return mode === ENDPOINT_MODES.API;
  }

  // Получение описания текущего режима
  async getModeDescription() {
    const mode = await this.getCurrentMode();
    return mode === ENDPOINT_MODES.WEBHOOK 
      ? 'Webhook (для мониторинга)' 
      : 'API Django (для сохранения)';
  }

  // Получение иконки для текущего режима
  async getModeIcon() {
    const mode = await this.getCurrentMode();
    return mode === ENDPOINT_MODES.WEBHOOK ? '🔗' : '💾';
  }
}

export default new GeoEndpointConfig();
