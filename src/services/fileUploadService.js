import axios from 'axios';
import { API_CONFIG } from '../config/api';

class FileUploadService {
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: 30000, // Увеличиваем timeout для загрузки файлов
    });
  }

  // Загрузка фотографии
  async uploadPhoto(photoUri, userId, placeId, phoneImei, fileTag = 'user-photo') {
    try {
      // Создаем FormData для multipart/form-data
      const formData = new FormData();
      
      // Добавляем файл
      const photoFile = {
        uri: photoUri,
        type: 'image/jpeg',
        name: `photo_${Date.now()}.jpg`,
      };
      
      formData.append('foto', photoFile);
      formData.append('folder', 'photos');
      formData.append('file_name', photoFile.name);
      formData.append('user_id', userId.toString());
      formData.append('place_id', placeId.toString());
      formData.append('timestamp', Math.floor(Date.now() / 1000).toString());
      formData.append('phone_imei', phoneImei);
      formData.append('file_type', 'image');
      formData.append('file_tag', fileTag);

      const response = await this.axiosInstance.post(API_CONFIG.ENDPOINTS.FILE_UPLOAD, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${API_CONFIG.API_TOKEN}`,
        },
        transformRequest: (data) => data, // Отключаем автоматическое преобразование
      });

      if (response.data && response.data.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.data.message || 'Ошибка загрузки файла' };
      }
    } catch (error) {
      console.error('File upload error:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка загрузки файла' 
      };
    }
  }

  // Загрузка нескольких фотографий
  async uploadMultiplePhotos(photoUris, userId, placeId, phoneImei, fileTag = 'user-photo') {
    const results = [];
    
    for (let i = 0; i < photoUris.length; i++) {
      const result = await this.uploadPhoto(
        photoUris[i], 
        userId, 
        placeId, 
        phoneImei, 
        `${fileTag}_${i + 1}`
      );
      results.push(result);
      
      // Небольшая задержка между загрузками
      if (i < photoUris.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  // Получение списка фотографий пользователя
  async getUserPhotos(userId) {
    try {
      const response = await this.axiosInstance.get(
        `${API_CONFIG.ENDPOINTS.USER_PHOTOS}?user_id=${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${API_CONFIG.API_TOKEN}`,
          },
        }
      );

      if (response.data && response.data.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.data.message || 'Ошибка получения фотографий' };
      }
    } catch (error) {
      console.error('Get user photos error:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка сети' 
      };
    }
  }

  // Проверка размера файла
  checkFileSize(fileSize) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    return fileSize <= maxSize;
  }

  // Проверка типа файла
  checkFileType(fileType) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    return allowedTypes.includes(fileType);
  }
}

export default new FileUploadService();

