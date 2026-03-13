import { API_CONFIG } from '../config/api';
import { unixSecStr } from '../utils/dateUtils';

/**
 * Создаёт FormData для загрузки файла на сервер.
 * Сервер ожидает поле 'foto', обязательное поле 'folder'.
 */
function buildUploadFormData({ file, userId, phoneImei, folder, extras = {} }) {
  const timestamp = unixSecStr();
  const formData = new FormData();
  formData.append('api_token', API_CONFIG.API_TOKEN);
  formData.append('user_id', String(userId));
  formData.append('phone_imei', phoneImei);
  formData.append('folder', String(folder));
  formData.append('timestamp', timestamp);

  // file: { uri, type?, fileName? } или строка URI
  const filePart = file && typeof file === 'object' ? {
    uri: file.uri,
    type: file.type || 'image/jpeg',
    name: file.fileName || `photo_${timestamp}.jpg`,
  } : {
    uri: String(file),
    type: 'image/jpeg',
    name: `photo_${timestamp}.jpg`,
  };
  formData.append('foto', filePart);

  Object.entries(extras).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return { formData, timestamp, filePart };
}

async function postFormData(formData, context) {
  const uploadUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FILE_UPLOAD}`;
  console.log(`[${new Date().toLocaleTimeString()}] ${context} ->`, uploadUrl);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log(`[${new Date().toLocaleTimeString()}] ${context} <- error`, response.status);
    return { success: false, error: `HTTP ${response.status}: ${response.statusText}`, details: errorText };
  }

  const data = await response.json();
  console.log(`[${new Date().toLocaleTimeString()}] ${context} <- success`);
  return { success: true, data };
}

class FileUploadService {
  // Загрузка фото для открытия/закрытия смены
  async uploadShiftPhoto(photo, userId, phoneImei, folder) {
    try {
      const { formData } = buildUploadFormData({
        file: photo,
        userId,
        phoneImei,
        folder: folder || 'shift',
      });
      return await postFormData(formData, 'uploadShiftPhoto');
    } catch (error) {
      console.log(`[${new Date().toLocaleTimeString()}] uploadShiftPhoto error`, error?.message || error);
      return { success: false, error: error.message || 'Ошибка загрузки фото' };
    }
  }

  // Загрузка фотографии общего назначения
  async uploadPhoto(photoUri, userId, placeId, phoneImei, photoType = 'general') {
    try {
      const extras = {};
      if (placeId) extras.place_id = placeId.toString();
      if (photoType) extras.file_tag = photoType.toString();

      const { formData } = buildUploadFormData({
        file: { uri: photoUri },
        userId,
        phoneImei,
        folder: photoType || 'general',
        extras,
      });
      return await postFormData(formData, 'uploadPhoto');
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] uploadPhoto error:`, error);
      return { success: false, error: error.message || 'Неизвестная ошибка загрузки' };
    }
  }

  // Получение фотографий пользователя (отключено)
  async getUserPhotos(userId) {
    console.log(`[${new Date().toLocaleTimeString()}] Skipping getUserPhotos (endpoint disabled) for user:`, userId);
    return { success: false, skipped: true, reason: 'user-photos endpoint disabled' };
  }

  // Загрузка файла с дополнительными параметрами
  async uploadFile(fileUri, userId, placeId, phoneImei, fileType = 'document', metadata = {}) {
    try {
      const extras = { ...metadata };
      if (placeId) extras.place_id = placeId.toString();
      if (fileType) extras.file_tag = fileType.toString();

      const { formData } = buildUploadFormData({
        file: { uri: fileUri, type: 'application/octet-stream', fileName: `file_${Date.now()}` },
        userId,
        phoneImei,
        folder: fileType || 'document',
        extras,
      });
      return await postFormData(formData, 'uploadFile');
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] uploadFile error:`, error);
      return { success: false, error: error.message || 'Неизвестная ошибка загрузки файла' };
    }
  }
}

export default new FileUploadService();
