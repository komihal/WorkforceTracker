import { API_CONFIG } from '../config/api';

class FileUploadService {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.apiToken = API_CONFIG.API_TOKEN;
  }

  // Загрузка фото для открытия/закрытия смены
  // Обязательные поля запроса: api_token, folder, foto, phone_imei, user_id, timestamp
  async uploadShiftPhoto(photo, userId, phoneImei, folder) {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const formData = new FormData();
      formData.append('api_token', this.apiToken);
      formData.append('folder', (folder || 'shift').toString());
      formData.append('phone_imei', phoneImei);
      formData.append('user_id', String(userId));
      formData.append('timestamp', timestamp);

      // Поддержка входа как { uri, type, fileName } или просто uri-строки
      const filePart = photo && typeof photo === 'object' ? {
        uri: photo.uri,
        type: photo.type || 'image/jpeg',
        name: photo.fileName || `photo_${timestamp}.jpg`,
      } : {
        uri: String(photo),
        type: 'image/jpeg',
        name: `photo_${timestamp}.jpg`,
      };
      formData.append('foto', filePart);

      const uploadUrl = `${this.baseURL}${API_CONFIG.ENDPOINTS.FILE_UPLOAD}`;
      console.log(`[${new Date().toLocaleTimeString()}] uploadShiftPhoto →`, {
        url: uploadUrl,
        userId: String(userId),
        phoneImei,
        folder: (folder || 'shift').toString(),
        hasPhoto: !!filePart?.uri,
        fileName: filePart?.name,
        contentType: filePart?.type,
        timestamp,
      });

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
        body: formData,
      });

      console.log(`[${new Date().toLocaleTimeString()}] uploadShiftPhoto ← response`, {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `HTTP ${response.status}`, details: text };
      }

      const data = await response.json();
      console.log(`[${new Date().toLocaleTimeString()}] uploadShiftPhoto ✓ success`, data);
      return { success: true, data };
    } catch (error) {
      console.log(`[${new Date().toLocaleTimeString()}] uploadShiftPhoto ✗ error`, error?.message || error);
      return { success: false, error: error.message || 'Ошибка загрузки фото' };
    }
  }

  // Загрузка фотографии
  // Требования сервера: поле файла 'foto', обязательное поле 'folder', тег файла в 'file_tag'
  async uploadPhoto(photoUri, userId, placeId, phoneImei, photoType = 'general') {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] Uploading photo:`, {
        uri: photoUri,
        userId,
        placeId,
        phoneImei,
        photoType
      });

      // Создаем FormData для загрузки файла (сервер ожидает поле 'foto')
      const formData = new FormData();
      
      // Добавляем файл (ключ должен быть именно 'foto')
      formData.append('foto', {
        uri: photoUri,
        type: 'image/jpeg',
        name: `photo_${Date.now()}.jpg`,
      });

      // Добавляем метаданные
      formData.append('api_token', this.apiToken);
      formData.append('user_id', userId.toString());
      formData.append('place_id', placeId.toString());
      formData.append('phone_imei', phoneImei);
      // Сервер требует 'folder'; используем photoType как папку по умолчанию
      formData.append('folder', (photoType || 'general').toString());
      // Вместо photo_type используем 'file_tag' при необходимости
      if (photoType) {
        formData.append('file_tag', photoType.toString());
      }

      // Отправляем запрос
      const response = await fetch(`${this.baseURL}${API_CONFIG.ENDPOINTS.FILE_UPLOAD}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[${new Date().toLocaleTimeString()}] Photo uploaded successfully:`, result);
        return { success: true, data: result };
      } else {
        const errorText = await response.text();
        console.error(`[${new Date().toLocaleTimeString()}] Photo upload failed:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Photo upload error:`, error);
      return { 
        success: false, 
        error: error.message || 'Неизвестная ошибка загрузки'
      };
    }
  }

  // Получение фотографий пользователя
  async getUserPhotos(userId) {
    // Эндпоинт временно отключен по требованию. Запрос не выполняется.
    console.log(`[${new Date().toLocaleTimeString()}] Skipping getUserPhotos (endpoint disabled) for user:`, userId);
    return { success: false, skipped: true, reason: 'user-photos endpoint disabled' };
  }

  // Загрузка файла с дополнительными параметрами
  // Требования сервера: поле файла 'foto', обязательное поле 'folder', тег файла в 'file_tag'
  async uploadFile(fileUri, userId, placeId, phoneImei, fileType = 'document', metadata = {}) {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] Uploading file:`, {
        uri: fileUri,
        userId,
        placeId,
        phoneImei,
        fileType,
        metadata
      });

      // Создаем FormData для загрузки файла
      const formData = new FormData();
      
      // Добавляем файл (ключ должен быть именно 'foto')
      formData.append('foto', {
        uri: fileUri,
        type: 'application/octet-stream',
        name: `file_${Date.now()}`,
      });

      // Добавляем метаданные
      formData.append('api_token', this.apiToken);
      formData.append('user_id', userId.toString());
      formData.append('place_id', placeId.toString());
      formData.append('phone_imei', phoneImei);
      // Обязательное поле 'folder'
      formData.append('folder', (fileType || 'document').toString());
      // Вместо file_type используем 'file_tag'
      if (fileType) {
        formData.append('file_tag', fileType.toString());
      }

      // Добавляем дополнительные метаданные
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });

      // Отправляем запрос
      const response = await fetch(`${this.baseURL}${API_CONFIG.ENDPOINTS.FILE_UPLOAD}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[${new Date().toLocaleTimeString()}] File uploaded successfully:`, result);
        return { success: true, data: result };
      } else {
        const errorText = await response.text();
        console.error(`[${new Date().toLocaleTimeString()}] File upload failed:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] File upload error:`, error);
      return { 
        success: false, 
        error: error.message || 'Неизвестная ошибка загрузки файла'
      };
    }
  }
}

export default new FileUploadService();
