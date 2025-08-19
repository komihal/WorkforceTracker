import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Platform, Alert } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';

class CameraService {
  constructor() {
    this.defaultOptions = {
      mediaType: 'photo',
      quality: 0.8,
      includeBase64: false,
      maxWidth: 1920,
      maxHeight: 1080,
      saveToPhotos: false,
      cameraType: 'front',
    };
  }

  async ensureCameraPermissionAndroid() {
    try {
      const permission = PERMISSIONS.ANDROID.CAMERA;
      let status = await check(permission);

      if (status === RESULTS.GRANTED) {
        return true;
      }

      if (status === RESULTS.DENIED || status === RESULTS.LIMITED) {
        status = await request(permission);
        return status === RESULTS.GRANTED;
      }

      if (status === RESULTS.BLOCKED) {
        Alert.alert(
          'Доступ к камере',
          'Доступ к камере заблокирован в настройках. Откройте настройки, чтобы выдать разрешение.',
          [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Открыть настройки', onPress: () => openSettings() },
          ],
        );
        return false;
      }

      return false;
    } catch (error) {
      console.error('ensureCameraPermissionAndroid error:', error);
      return false;
    }
  }

  // Сделать фото с камеры
  async takePhoto(options = {}) {
    try {
      // Для iOS симулятора предлагаем использовать галерею
      if (Platform.OS === 'ios') {
        console.log('iOS detected, checking camera availability...');
        
        // Проверяем, что модуль доступен
        if (!launchCamera) {
          console.error('launchCamera is not available on iOS');
          return { 
            success: false, 
            error: 'Камера недоступна. Попробуйте выбрать фото из галереи.',
            suggestGallery: true 
          };
        }
      }
      
      if (Platform.OS === 'android') {
        const hasPermission = await this.ensureCameraPermissionAndroid();
        if (!hasPermission) {
          return { success: false, error: 'Нет доступа к камере' };
        }
      }

      const cameraOptions = {
        ...this.defaultOptions,
        ...options,
      };

      console.log('Launching camera with options:', cameraOptions);
      const result = await launchCamera(cameraOptions);
      console.log('Camera result:', result);
      
      if (result.didCancel) {
        return { success: false, error: 'Пользователь отменил съемку' };
      }
      
      if (result.errorCode) {
        // Если ошибка камеры на iOS, предлагаем галерею
        if (Platform.OS === 'ios') {
          return { 
            success: false, 
            error: 'Камера недоступна. Попробуйте выбрать фото из галереи.',
            suggestGallery: true 
          };
        }
        return { success: false, error: result.errorMessage || 'Ошибка камеры' };
      }
      
      if (result.assets && result.assets.length > 0) {
        const photo = result.assets[0];
        return { 
          success: true, 
          data: {
            uri: photo.uri,
            type: photo.type,
            fileName: photo.fileName,
            fileSize: photo.fileSize,
            width: photo.width,
            height: photo.height,
          }
        };
      }
      
      return { success: false, error: 'Не удалось получить фото' };
    } catch (error) {
      console.error('Camera error:', error);
      
      // Для iOS предлагаем галерею как fallback
      if (Platform.OS === 'ios') {
        return { 
          success: false, 
          error: 'Ошибка камеры. Попробуйте выбрать фото из галереи.',
          suggestGallery: true 
        };
      }
      
      return { success: false, error: `Ошибка при работе с камерой: ${error.message}` };
    }
  }

  // Выбрать фото из галереи
  async selectPhoto(options = {}) {
    try {
      // Проверяем, что модуль доступен
      if (!launchImageLibrary) {
        console.error('launchImageLibrary is not available');
        return { success: false, error: 'Модуль галереи недоступен' };
      }

      const libraryOptions = {
        ...this.defaultOptions,
        ...options,
        selectionLimit: 1,
      };

      console.log('Launching image library with options:', libraryOptions);
      const result = await launchImageLibrary(libraryOptions);
      console.log('Image library result:', result);
      
      if (result.didCancel) {
        return { success: false, error: 'Пользователь отменил выбор' };
      }
      
      if (result.errorCode) {
        return { success: false, error: result.errorMessage || 'Ошибка галереи' };
      }
      
      if (result.assets && result.assets.length > 0) {
        const photo = result.assets[0];
        return { 
          success: true, 
          data: {
            uri: photo.uri,
            type: photo.type,
            fileName: photo.fileName,
            fileSize: photo.fileSize,
            width: photo.width,
            height: photo.height,
          }
        };
      }
      
      return { success: false, error: 'Не удалось выбрать фото' };
    } catch (error) {
      console.error('Gallery error:', error);
      return { success: false, error: `Ошибка при работе с галереей: ${error.message}` };
    }
  }

  // Выбрать несколько фото
  async selectMultiplePhotos(options = {}) {
    try {
      const libraryOptions = {
        ...this.defaultOptions,
        ...options,
        selectionLimit: 10, // Максимум 10 фото
      };

      const result = await launchImageLibrary(libraryOptions);
      
      if (result.didCancel) {
        return { success: false, error: 'Пользователь отменил выбор' };
      }
      
      if (result.errorCode) {
        return { success: false, error: result.errorMessage || 'Ошибка галереи' };
      }
      
      if (result.assets && result.assets.length > 0) {
        const photos = result.assets.map(photo => ({
          uri: photo.uri,
          type: photo.type,
          fileName: photo.fileName,
          fileSize: photo.fileSize,
          width: photo.width,
          height: photo.height,
        }));
        
        return { success: true, data: photos };
      }
      
      return { success: false, error: 'Не удалось выбрать фото' };
    } catch (error) {
      console.error('Multiple photos selection error:', error);
      return { success: false, error: 'Ошибка при выборе фото' };
    }
  }

  // Проверка разрешений камеры
  async checkCameraPermissions() {
    try {
      // Для iOS симулятора камера может быть недоступна
      if (Platform.OS === 'ios') {
        if (!launchCamera) {
          return { 
            success: true, 
            hasPermission: false, 
            warning: 'Камера недоступна в симуляторе. Используйте галерею.',
            platform: Platform.OS 
          };
        }
        return { 
          success: true, 
          hasPermission: true, 
          warning: 'В симуляторе камера может работать ограниченно',
          platform: Platform.OS 
        };
      }
      if (Platform.OS === 'android') {
        const permission = PERMISSIONS.ANDROID.CAMERA;
        const status = await check(permission);
        const hasPermission = status === RESULTS.GRANTED;
        return { success: true, hasPermission, platform: Platform.OS };
      }

      return { success: true, hasPermission: true, platform: Platform.OS };
    } catch (error) {
      console.error('Permission check error:', error);
      return { 
        success: false, 
        hasPermission: false, 
        error: 'Ошибка проверки разрешений',
        platform: Platform.OS 
      };
    }
  }

  // Получить настройки по умолчанию
  getDefaultOptions() {
    return { ...this.defaultOptions };
  }

  // Обновить настройки по умолчанию
  updateDefaultOptions(newOptions) {
    this.defaultOptions = { ...this.defaultOptions, ...newOptions };
  }
}

export default new CameraService();
