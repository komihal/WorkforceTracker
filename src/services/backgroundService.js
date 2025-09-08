import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import geoService from './geoService';
// Background activity webhook disabled
import fileUploadService from './fileUploadService';
// BackgroundGeolocation import removed - now managed via src/location.js

class BackgroundService {
  constructor() {
    this.isRunning = false;
    this.pendingPhotos = [];
    this.pendingGeoData = [];
    this.intervalId = null;
    this.uploadIntervalId = null;
    this.currentUserId = null;
    this.currentPlaceId = null;
    this.currentPhoneImei = null;
    this.isTestMode = false; // Тестовый режим для более частого сбора данных
    this.appState = 'active'; // Текущее состояние приложения
    this.lastGeoCollection = 0; // Время последнего сбора геоданных
    this.geoCollectionTimeout = null; // Таймаут для сбора геоданных
    
    // Обработчик изменения состояния приложения
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  // Инициализация сервиса
  async initialize(userId, placeId, phoneImei, testMode = false) {
    this.currentUserId = userId;
    this.currentPlaceId = placeId;
    this.currentPhoneImei = phoneImei;
    this.isTestMode = testMode;
    
    // Загружаем сохраненные данные из локального хранилища
    await this.loadPendingData();
    
    // Запускаем фоновые задачи
    this.startBackgroundTasks();
    
    // BackgroundGeolocation инициализация удалена - теперь управляется через src/location.js
  }

  // BackgroundGeolocation инициализация удалена - теперь управляется через src/location.js

  // Обработчик геолокации удален - теперь управляется через встроенный uploader BG

  // Остановка сервиса
  stop() {
    this.isRunning = false;
    // Все интервалы удалены - геоданные через встроенный uploader BG
    console.log('Background service stopped (photos only)');
  }

  // Обработчик изменения состояния приложения - упрощен для фото только
  handleAppStateChange(nextAppState) {
    console.log(`App state changed: ${this.appState} -> ${nextAppState}`);
    this.appState = nextAppState;
    
    if (nextAppState === 'active') {
      // Приложение стало активным - обрабатываем только фото
      this.processPendingData();
    }
    // Геоданные теперь через встроенный uploader BG
  }

  // Проверка пропущенного сбора геоданных удалена - теперь через встроенный uploader BG

  // Настройка сбора геоданных удалена - теперь управляется через встроенный uploader BG

  // Запуск фоновых задач - только для фото, геоданные через встроенный uploader BG
  startBackgroundTasks() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    console.log(`Background tasks started - Test mode: ${this.isTestMode}`);
    console.log('Geo data collection disabled - using BG built-in uploader only');
    console.log('Photo upload interval disabled - photos uploaded only on punch in/out');
    
    // Все интервалы удалены - геоданные отправляются через встроенный uploader BG
    console.log('Background tasks started (photos only)');
  }

  // Сбор геоданных удален - теперь через встроенный uploader BG

  // Добавление фотографии в очередь
  async addPhotoToQueue(photoData) {
    const photo = {
      id: Date.now(),
      data: photoData,
      uploaded: false,
      timestamp: new Date().toISOString()
    };
    
    this.pendingPhotos.push(photo);
    await this.savePendingData();
    
    console.log('Photo added to queue:', photo.id);
  }

  // Загрузка сохраненных данных
  async loadPendingData() {
    try {
      const savedPhotos = await AsyncStorage.getItem('pendingPhotos');
      const savedGeoData = await AsyncStorage.getItem('pendingGeoData');
      
      if (savedPhotos) {
        this.pendingPhotos = JSON.parse(savedPhotos);
      }
      
      if (savedGeoData) {
        this.pendingGeoData = JSON.parse(savedGeoData);
      }
      
      console.log(`Loaded pending data: ${this.pendingPhotos.length} photos, ${this.pendingGeoData.length} geo points`);
    } catch (error) {
      console.error('Error loading pending data:', error);
    }
  }

  // Сохранение данных в локальное хранилище
  async savePendingData() {
    try {
      await AsyncStorage.setItem('pendingPhotos', JSON.stringify(this.pendingPhotos));
      await AsyncStorage.setItem('pendingGeoData', JSON.stringify(this.pendingGeoData));
    } catch (error) {
      console.error('Error saving pending data:', error);
    }
  }

  // Обработка накопленных данных - только фото
  async processPendingData() {
    if (this.pendingPhotos.length > 0) {
      console.log(`Processing pending data: ${this.pendingPhotos.length} photos`);
      await this.uploadPendingData();
    }
    // Геоданные теперь через встроенный uploader BG
  }

  // Отправка накопленных данных - только фото
  async uploadPendingData() {
    if (!this.isRunning) {
      console.log('Background service not running, skipping upload');
      return;
    }

    try {
      console.log(`[${new Date().toLocaleTimeString()}] Starting upload cycle (photos only)...`);
      console.log(`Photos to upload: ${this.pendingPhotos.filter(p => !p.uploaded).length}`);

      // Фото больше не загружаются автоматически из фонового сервиса.
      // Требование: загрузка фото ТОЛЬКО по нажатию кнопок начала/окончания смены.
      if (this.pendingPhotos.some(p => !p.uploaded)) {
        console.log('[backgroundService] Skipping photo uploads (allowed only on punch in/out).');
      }

      // Геоданные теперь через встроенный uploader BG
      console.log('Geo data upload disabled - using BG built-in uploader');

      // Удаляем загруженные фотографии
      this.pendingPhotos = this.pendingPhotos.filter(photo => !photo.uploaded);
      await this.savePendingData();
      
      console.log(`[${new Date().toLocaleTimeString()}] Upload cycle completed (photos only)`);
    } catch (error) {
      console.error('Error in upload cycle:', error);
    }
  }

  // Получение статистики - только фото
  getStats() {
    return {
      pendingPhotos: this.pendingPhotos.filter(photo => !photo.uploaded).length,
      pendingGeoData: 0, // Геоданные теперь через встроенный uploader BG
      isRunning: this.isRunning,
      isTestMode: this.isTestMode,
      geoInterval: 'disabled - using BG built-in uploader',
      uploadInterval: 'disabled - photos only on punch in/out',
      mode: 'photos-only'
    };
  }

  // Принудительная отправка всех данных
  async forceUpload() {
    console.log(`[${new Date().toLocaleTimeString()}] Force upload requested`);
    await this.uploadPendingData();
  }

  // Переключение тестового режима - упрощено для фото только
  toggleTestMode() {
    this.isTestMode = !this.isTestMode;
    console.log(`Test mode ${this.isTestMode ? 'enabled' : 'disabled'} (photos only)`);
  }

  // Установка тестового режима - упрощено для фото только
  setTestMode(enabled) {
    this.isTestMode = enabled;
    console.log(`Test mode ${this.isTestMode ? 'enabled' : 'disabled'} (photos only)`);
  }

  // Фоновая отправка данных удалена - теперь через встроенный uploader BG

  // Метод для добавления геопозиции удален - теперь через встроенный uploader BG

  // Методы BGGeo событий удалены - теперь через встроенный uploader BG
  
  // Cleanup метод для очистки подписок
  cleanup() {
    try {
      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }
    } catch (error) {
      console.error('Error cleaning up background service:', error);
    }
  }
}

export default new BackgroundService();
