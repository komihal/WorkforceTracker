import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import geoService from './geoService';
import fileUploadService from './fileUploadService';

class BackgroundService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.uploadIntervalId = null;
    this.pendingPhotos = [];
    this.pendingGeoData = [];
    this.currentUserId = null;
    this.currentPlaceId = null;
    this.currentPhoneImei = null;
    
    // Обработчик изменения состояния приложения
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  // Инициализация сервиса
  async initialize(userId, placeId, phoneImei) {
    this.currentUserId = userId;
    this.currentPlaceId = placeId;
    this.currentPhoneImei = phoneImei;
    
    // Загружаем сохраненные данные из локального хранилища
    await this.loadPendingData();
    
    // Запускаем фоновые задачи
    this.startBackgroundTasks();
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
  }

  // Обработчик изменения состояния приложения
  handleAppStateChange(nextAppState) {
    if (nextAppState === 'active') {
      // Приложение стало активным - запускаем отправку накопленных данных
      this.processPendingData();
    }
  }

  // Запуск фоновых задач
  startBackgroundTasks() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Сбор геоданных каждые 2 минуты
    this.intervalId = setInterval(async () => {
      await this.collectGeoData();
    }, 2 * 60 * 1000); // 2 минуты
    
    // Отправка данных на сервер каждые 10 минут
    this.uploadIntervalId = setInterval(async () => {
      await this.uploadPendingData();
    }, 10 * 60 * 1000); // 5 минут
    
    console.log('Background tasks started');
  }

  // Сбор геоданных
  async collectGeoData() {
    try {
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
      
      console.log('Geo data collected and cached:', geoPoint);
    } catch (error) {
      console.error('Error collecting geo data:', error);
    }
  }

  // Добавление фотографии в очередь
  async addPhotoToQueue(photoUri, fileTag = 'user-photo') {
    try {
      const photoData = {
        uri: photoUri,
        fileTag,
        timestamp: Date.now(),
        uploaded: false
      };
      
      this.pendingPhotos.push(photoData);
      await this.savePendingData();
      
      console.log('Photo added to queue:', photoData);
    } catch (error) {
      console.error('Error adding photo to queue:', error);
    }
  }

  // Сохранение данных в локальное хранилище
  async savePendingData() {
    try {
      const dataToSave = {
        photos: this.pendingPhotos,
        geoData: this.pendingGeoData,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(
        `background_data_${this.currentUserId}`,
        JSON.stringify(dataToSave)
      );
    } catch (error) {
      console.error('Error saving pending data:', error);
    }
  }

  // Загрузка данных из локального хранилища
  async loadPendingData() {
    try {
      const savedData = await AsyncStorage.getItem(
        `background_data_${this.currentUserId}`
      );
      
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        this.pendingPhotos = parsedData.photos || [];
        this.pendingGeoData = parsedData.geoData || [];
        
        console.log('Loaded pending data:', {
          photos: this.pendingPhotos.length,
          geoData: this.pendingGeoData.length
        });
      }
    } catch (error) {
      console.error('Error loading pending data:', error);
    }
  }

  // Обработка накопленных данных при активации приложения
  async processPendingData() {
    if (this.pendingPhotos.length > 0 || this.pendingGeoData.length > 0) {
      console.log('Processing pending data on app activation');
      await this.uploadPendingData();
    }
  }

  // Отправка накопленных данных на сервер
  async uploadPendingData() {
    if (!this.currentUserId || !this.currentPlaceId || !this.currentPhoneImei) {
      console.log('Cannot upload data - missing user info');
      return;
    }

    try {
      // Отправляем фотографии
      for (let i = 0; i < this.pendingPhotos.length; i++) {
        const photo = this.pendingPhotos[i];
        if (!photo.uploaded) {
          try {
            const result = await fileUploadService.uploadPhoto(
              photo.uri,
              this.currentUserId,
              this.currentPlaceId,
              this.currentPhoneImei,
              photo.fileTag
            );
            
            if (result.success) {
              photo.uploaded = true;
              console.log('Photo uploaded successfully:', photo.fileTag);
              // Удаляем локальный файл из очереди сразу после отметки uploaded
              await this.savePendingData();
            }
          } catch (error) {
            console.error('Error uploading photo:', error);
          }
          
          // Небольшая задержка между загрузками
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Отправляем геоданные
      if (this.pendingGeoData.length > 0) {
        try {
          const result = await geoService.saveGeoData(
            this.currentUserId,
            this.currentPlaceId,
            this.currentPhoneImei
          );
          
          if (result.success) {
            this.pendingGeoData = [];
            console.log('Geo data uploaded successfully');
          }
        } catch (error) {
          console.error('Error uploading geo data:', error);
        }
      }

      // Очищаем успешно загруженные данные
      const before = this.pendingPhotos.length;
      this.pendingPhotos = this.pendingPhotos.filter(photo => !photo.uploaded);
      const after = this.pendingPhotos.length;
      if (before !== after) {
        console.log(`Pending photos reduced: ${before} -> ${after}`);
      }
      await this.savePendingData();
      
      console.log('Upload cycle completed');
    } catch (error) {
      console.error('Error in upload cycle:', error);
    }
  }

  // Получение статистики
  getStats() {
    return {
      pendingPhotos: this.pendingPhotos.filter(photo => !photo.uploaded).length,
      pendingGeoData: this.pendingGeoData.length,
      isRunning: this.isRunning
    };
  }

  // Принудительная отправка всех данных
  async forceUpload() {
    console.log('Force upload requested');
    await this.uploadPendingData();
  }
}

export default new BackgroundService();
