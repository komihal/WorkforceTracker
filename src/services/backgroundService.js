import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import geoService from './geoService';
// Background activity webhook disabled
import fileUploadService from './fileUploadService';
import BackgroundGeolocation from 'react-native-background-geolocation';

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
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
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
    
    // Инициализируем BackgroundGeolocation для фонового сбора
    await this.initializeBackgroundGeolocation();
  }

  // Инициализация BackgroundGeolocation для фонового сбора
  async initializeBackgroundGeolocation() {
    try {
      console.log('Initializing BackgroundGeolocation for background service...');
      
      // Проверяем, запущен ли уже BackgroundGeolocation
      const state = await BackgroundGeolocation.getState();
      
      if (!state.enabled) {
        console.log('Starting BackgroundGeolocation...');
        await BackgroundGeolocation.start();
      }
      
      // Настраиваем обработчик для автоматического сбора геоданных
      BackgroundGeolocation.onLocation(async (location) => {
        await this.handleBackgroundLocation(location);
      });
      
      console.log('BackgroundGeolocation initialized successfully');
    } catch (error) {
      console.error('Error initializing BackgroundGeolocation:', error);
    }
  }

  // Обработчик геолокации из BackgroundGeolocation
  async handleBackgroundLocation(location) {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] Background location received:`, {
        lat: location.coords?.latitude,
        lon: location.coords?.longitude,
        accuracy: location.coords?.accuracy,
        timestamp: new Date(location.timestamp).toLocaleTimeString()
      });
      
      // Добавляем геопозицию
      const geoPoint = geoService.addGeoPoint(
        location.coords.latitude,
        location.coords.longitude,
        location.coords.altitude,
        location.coords.altitude + 5,
        true,
        true,
        false,
        1.5
      );
      
      // Сохраняем в локальное хранилище
      this.pendingGeoData.push(geoPoint);
      await this.savePendingData();
      
      console.log(`[${new Date().toLocaleTimeString()}] Background geo data cached:`, geoPoint);
      console.log(`Total pending geo points: ${this.pendingGeoData.length}`);
      
      // Обновляем время последнего сбора
      this.lastGeoCollection = Date.now();
    } catch (error) {
      console.error('Error handling background location:', error);
    }
  }

  // Остановка сервиса
  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.uploadIntervalId) {
      clearInterval(this.uploadIntervalId);
      this.uploadIntervalId = null;
    }
    if (this.geoCollectionTimeout) {
      clearTimeout(this.geoCollectionTimeout);
      this.geoCollectionTimeout = null;
    }
  }

  // Обработчик изменения состояния приложения
  handleAppStateChange(nextAppState) {
    console.log(`App state changed: ${this.appState} -> ${nextAppState}`);
    this.appState = nextAppState;
    
    if (nextAppState === 'active') {
      // Приложение стало активным - запускаем отправку накопленных данных
      this.processPendingData();
      
      // Проверяем, не пропустили ли мы сбор геоданных
      this.checkMissedGeoCollection();
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // Приложение ушло в фон - увеличиваем частоту сбора геоданных
      this.adjustGeoCollectionForBackground();
    }
  }

  // Проверка пропущенного сбора геоданных
  checkMissedGeoCollection() {
    const now = Date.now();
    const timeSinceLastCollection = now - this.lastGeoCollection;
    const expectedInterval = this.isTestMode ? 30 * 1000 : 2 * 60 * 1000;
    
    if (timeSinceLastCollection > expectedInterval * 1.5) {
      console.log(`Missed geo collection detected. Time since last: ${Math.round(timeSinceLastCollection / 1000)}s`);
      
      // Собираем геоданные немедленно
      this.collectGeoData();
    }
  }

  // Настройка сбора геоданных для фонового режима
  adjustGeoCollectionForBackground() {
    if (this.geoCollectionTimeout) {
      clearTimeout(this.geoCollectionTimeout);
      this.geoCollectionTimeout = null;
    }
    
    // В фоновом режиме используем BackgroundGeolocation события вместо setInterval
    // setInterval не работает надежно в фоне на Android
    if (this.appState !== 'active') {
      console.log('App is in background - setting up BackgroundGeolocation-based upload strategy');
      
      try {
        const BackgroundGeolocation = require('react-native-background-geolocation').default;
        
        // Устанавливаем более агрессивные настройки для фона
        BackgroundGeolocation.ready({
          distanceFilter: 5, // Уменьшаем дистанцию для более частых обновлений
          heartbeatInterval: 10, // Увеличиваем heartbeat
          stopTimeout: 0, // Не останавливаемся
          enableHeadless: true,
          foregroundService: true,
        }).then(() => {
          console.log('BackgroundGeolocation reconfigured for background mode');
          
          // Запускаем стратегию на основе событий BackgroundGeolocation
          this.scheduleBackgroundLocationUpdates();
        });
        
      } catch (error) {
        console.log('BackgroundGeolocation not available for background strategy');
      }
    } else {
      console.log('App is active - using standard interval strategy');
      
      // В активном режиме используем обычный интервал
      const activeInterval = this.isTestMode ? 30 * 1000 : 60 * 1000;
      
      this.intervalId = setInterval(async () => {
        const now = new Date().toLocaleTimeString();
        console.log(`[${now}] Active mode interval triggered`);
        
        if (this.pendingGeoData.length > 0) {
          console.log(`[${now}] Executing active mode upload...`);
          await this.backgroundUpload();
        }
      }, activeInterval);
      
      console.log(`Active mode upload interval set to ${activeInterval / 1000} seconds`);
    }
  }

  // Запуск фоновых задач
  startBackgroundTasks() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Определяем интервалы в зависимости от режима
    const geoInterval = this.isTestMode ? 15 * 1000 : 2 * 60 * 1000; // 15 сек в тесте, 2 мин в продакшене
    const uploadInterval = this.isTestMode ? 2 * 60 * 1000 : 10 * 60 * 1000; // 2 мин в тесте, 10 мин в продакшене
    
    console.log(`Background tasks started - Test mode: ${this.isTestMode}`);
    console.log(`Geo collection interval: ${geoInterval / 1000} seconds`);
    console.log(`Upload interval: ${uploadInterval / 1000} seconds`);
    
    // Сбор геоданных (только когда приложение активно)
    this.intervalId = setInterval(async () => {
      if (this.appState === 'active') {
        await this.collectGeoData();
      }
    }, geoInterval);
    
    // Отправка данных на сервер (работает всегда)
    this.uploadIntervalId = setInterval(async () => {
      await this.uploadPendingData();
    }, uploadInterval);
    
    console.log('Background tasks started');
  }

  // Сбор геоданных
  async collectGeoData() {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] Collecting geo data...`);
      
      const location = await geoService.getCurrentLocation();
      
      // Добавляем геопозицию
      const geoPoint = geoService.addGeoPoint(
        location.latitude,
        location.longitude,
        location.altitude,
        location.altitude + 5,
        true,
        true,
        false,
        1.5
      );
      
      // Сохраняем в локальное хранилище
      this.pendingGeoData.push(geoPoint);
      await this.savePendingData();
      
      console.log(`[${new Date().toLocaleTimeString()}] Geo data collected and cached:`, geoPoint);
      console.log(`Total pending geo points: ${this.pendingGeoData.length}`);
      
      // Обновляем время последнего сбора
      this.lastGeoCollection = Date.now();
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Error collecting geo data:`, error);
    }
  }

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

  // Обработка накопленных данных
  async processPendingData() {
    if (this.pendingPhotos.length > 0 || this.pendingGeoData.length > 0) {
      console.log(`Processing pending data: ${this.pendingPhotos.length} photos, ${this.pendingGeoData.length} geo points`);
      await this.uploadPendingData();
    }
  }

  // Отправка накопленных данных
  async uploadPendingData() {
    if (!this.isRunning) {
      console.log('Background service not running, skipping upload');
      return;
    }

    try {
      console.log(`[${new Date().toLocaleTimeString()}] Starting upload cycle...`);
      console.log(`Photos to upload: ${this.pendingPhotos.filter(p => !p.uploaded).length}`);
      console.log(`Geo points to upload: ${this.pendingGeoData.length}`);

      // Фото больше не загружаются автоматически из фонового сервиса.
      // Требование: загрузка фото ТОЛЬКО по нажатию кнопок начала/окончания смены.
      if (this.pendingPhotos.some(p => !p.uploaded)) {
        console.log('[backgroundService] Skipping photo uploads (allowed only on punch in/out).');
      }

      // Отправляем геоданные
      if (this.pendingGeoData.length > 0) {
        try {
          console.log(`[${new Date().toLocaleTimeString()}] Uploading ${this.pendingGeoData.length} geo points...`);
          
          const result = await geoService.saveGeoData(
            this.currentUserId,
            this.currentPlaceId,
            this.currentPhoneImei
          );
          
          if (result.success) {
            console.log(`[${new Date().toLocaleTimeString()}] Geo data uploaded successfully!`);
            this.pendingGeoData = [];
          } else {
            console.error('Geo data upload failed:', result.error);
          }
        } catch (error) {
          console.error('Error uploading geo data:', error);
        }
      }

      // Удаляем загруженные фотографии
      this.pendingPhotos = this.pendingPhotos.filter(photo => !photo.uploaded);
      await this.savePendingData();
      
      console.log(`[${new Date().toLocaleTimeString()}] Upload cycle completed`);
    } catch (error) {
      console.error('Error in upload cycle:', error);
    }
  }

  // Получение статистики
  getStats() {
    return {
      pendingPhotos: this.pendingPhotos.filter(photo => !photo.uploaded).length,
      pendingGeoData: this.pendingGeoData.length,
      isRunning: this.isRunning,
      isTestMode: this.isTestMode,
      geoInterval: this.isTestMode ? 30 : 120, // в секундах
      uploadInterval: this.isTestMode ? 120 : 600 // в секундах
    };
  }

  // Принудительная отправка всех данных
  async forceUpload() {
    console.log(`[${new Date().toLocaleTimeString()}] Force upload requested`);
    await this.uploadPendingData();
  }

  // Переключение тестового режима
  toggleTestMode() {
    this.isTestMode = !this.isTestMode;
    if (this.isRunning) {
      this.stop();
      this.startBackgroundTasks();
    }
    console.log(`Test mode ${this.isTestMode ? 'enabled' : 'disabled'}`);
  }

  // Установка тестового режима
  setTestMode(enabled) {
    this.isTestMode = enabled;
    if (this.isRunning) {
      this.stop();
      this.startBackgroundTasks();
    }
    console.log(`Test mode ${this.isTestMode ? 'enabled' : 'disabled'}`);
  }

  // Фоновая отправка данных (вызывается автоматически в фоне)
  async backgroundUpload() {
    if (this.appState !== 'active' && this.pendingGeoData.length > 0) {
      console.log(`[${new Date().toLocaleTimeString()}] Background upload triggered - ${this.pendingGeoData.length} geo points`);
      
      // Отправляем информацию о фоновой активности на webhook
      // background activity webhook suppressed
      
      try {
        const result = await geoService.saveGeoData(
          this.currentUserId,
          this.currentPlaceId,
          this.currentPhoneImei
        );
        
        if (result.success) {
          console.log(`[${new Date().toLocaleTimeString()}] Background geo data upload successful!`);
          
          // success webhook suppressed
          
          this.pendingGeoData = [];
          await this.savePendingData();
        } else {
          console.log(`[${new Date().toLocaleTimeString()}] Background geo data upload failed:`, result.error);
          
          // failure webhook suppressed
        }
      } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] Background upload error:`, error);
        
        // error webhook suppressed
      }
    }
  }

  scheduleBackgroundLocationUpdates() {
    console.log('Scheduling background location updates...');
    
    try {
      const BackgroundGeolocation = require('react-native-background-geolocation').default;
      
      // Вместо setTimeout используем BackgroundGeolocation события
      // Подписываемся на HEARTBEAT события для принудительного получения позиции (without extra webhooks)
      BackgroundGeolocation.onHeartbeat(async (event) => {
        if (this.appState !== 'active' && this.pendingGeoData.length > 0) {
          const now = new Date().toLocaleTimeString();
          console.log(`[${now}] HEARTBEAT triggered - forcing location update for background upload...`);
          
          // planning webhook suppressed
          
          // Принудительно получаем позицию через BackgroundGeolocation
          try {
            const location = await BackgroundGeolocation.getCurrentPosition({
              samples: 1,
              persist: false,
              timeout: 15,
              maximumAge: 5000,
              desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH
            });
            
            console.log(`[${new Date().toLocaleTimeString()}] BackgroundGeolocation position received via HEARTBEAT, triggering upload...`);
            
            // location-received webhook suppressed
            
            // Запускаем загрузку
            await this.backgroundUpload();
            
          } catch (error) {
            console.log(`[${new Date().toLocaleTimeString()}] BackgroundGeolocation error via HEARTBEAT:`, error.message);
            
            // Даже при ошибке пытаемся загрузить накопленные данные
            if (this.pendingGeoData.length > 0) {
              console.log(`[${new Date().toLocaleTimeString()}] Attempting upload despite location error...`);
              
              await this.backgroundUpload();
            }
          }
        }
      });
      
      // Также подписываемся на motion change для дополнительных триггеров
      BackgroundGeolocation.onMotionChange(async (event) => {
        if (this.appState !== 'active' && this.pendingGeoData.length > 0) {
          const now = new Date().toLocaleTimeString();
          console.log(`[${now}] Motion change detected in background - checking if upload needed...`);
          
          // Если есть накопленные данные, пытаемся загрузить
          if (this.pendingGeoData.length > 0) {
            console.log(`[${now}] Motion change triggered background upload...`);
            await this.backgroundUpload();
          }
        }
      });
      
      console.log('Background location updates configured via BackgroundGeolocation events (HEARTBEAT + MotionChange)');
      
    } catch (error) {
      console.log('Failed to configure BackgroundGeolocation events for background strategy:', error.message);
    }
  }
}

export default new BackgroundService();
