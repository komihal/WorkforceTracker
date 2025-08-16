/**
 * Примеры использования API Workforce Tracker
 * Этот файл содержит примеры всех основных API вызовов
 */

import authService from '../services/authService';
import punchService from '../services/punchService';
import geoService from '../services/geoService';
import fileUploadService from '../services/fileUploadService';
import cameraService from '../services/cameraService';

// Пример 1: Аутентификация пользователя
export const exampleAuth = async () => {
  console.log('=== Пример аутентификации ===');
  
  try {
    const result = await authService.login('79999999999', '123456');
    
    if (result.success) {
      console.log('✅ Аутентификация успешна:', result.data);
      return result.data;
    } else {
      console.error('❌ Ошибка аутентификации:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Исключение при аутентификации:', error);
    return null;
  }
};

// Пример 2: Начало смены (Punch In)
export const examplePunchIn = async (userId) => {
  console.log('=== Пример начала смены ===');
  
  try {
    // Сначала делаем фото
    const photoResult = await cameraService.takePhoto();
    console.log('📸 Результат фото:', photoResult);
    
    // Выполняем punch in
    const result = await punchService.punchIn(
      userId,
      '123456789012345', // IMEI
      photoResult.success ? photoResult.data.fileName : 'start_shift.jpg'
    );
    
    if (result.success) {
      console.log('✅ Смена начата:', result.data);
      
      // Если фото было сделано, загружаем его
      if (photoResult.success) {
        const uploadResult = await fileUploadService.uploadPhoto(
          photoResult.data.uri,
          userId,
          1, // place_id
          '123456789012345', // IMEI
          'start-shift'
        );
        console.log('📤 Результат загрузки фото:', uploadResult);
      }
      
      return result.data;
    } else {
      console.error('❌ Ошибка начала смены:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Исключение при начале смены:', error);
    return null;
  }
};

// Пример 3: Завершение смены (Punch Out)
export const examplePunchOut = async (userId) => {
  console.log('=== Пример завершения смены ===');
  
  try {
    // Делаем финальное фото
    const photoResult = await cameraService.takePhoto();
    console.log('📸 Результат финального фото:', photoResult);
    
    // Выполняем punch out
    const result = await punchService.punchOut(
      userId,
      '123456789012345', // IMEI
      photoResult.success ? photoResult.data.fileName : 'end_shift.jpg'
    );
    
    if (result.success) {
      console.log('✅ Смена завершена:', result.data);
      
      // Если фото было сделано, загружаем его
      if (photoResult.success) {
        const uploadResult = await fileUploadService.uploadPhoto(
          photoResult.data.uri,
          userId,
          1, // place_id
          '123456789012345', // IMEI
          'end-shift'
        );
        console.log('📤 Результат загрузки финального фото:', uploadResult);
      }
      
      return result.data;
    } else {
      console.error('❌ Ошибка завершения смены:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Исключение при завершении смены:', error);
    return null;
  }
};

// Пример 4: Работа с геолокацией
export const exampleGeoLocation = async (userId) => {
  console.log('=== Пример работы с геолокацией ===');
  
  try {
    // Получаем текущую позицию
    const location = await geoService.getCurrentLocation();
    console.log('📍 Текущая позиция:', location);
    
    // Добавляем геопозицию
    const geoPoint = geoService.addGeoPoint(
      location.latitude,
      location.longitude,
      location.altitude,
      location.altitude + 5, // altmsl
      true, // hasAlt
      true, // hasAltMsl
      false, // hasAltMslAccuracy
      1.5 // mslAccuracyMeters
    );
    console.log('📍 Добавлена геопозиция:', geoPoint);
    
    // Показываем количество собранных точек
    const geoCount = geoService.getGeoDataCount();
    console.log('📊 Количество геопозиций:', geoCount);
    
    // Сохраняем геоданные на сервер
    const saveResult = await geoService.saveGeoData(
      userId,
      1, // place_id
      '123456789012345' // IMEI
    );
    
    if (saveResult.success) {
      console.log('✅ Геоданные сохранены:', saveResult.data);
    } else {
      console.error('❌ Ошибка сохранения геоданных:', saveResult.error);
    }
    
    return saveResult;
  } catch (error) {
    console.error('❌ Исключение при работе с геолокацией:', error);
    return null;
  }
};

// Пример 5: Загрузка фотографий
export const examplePhotoUpload = async (userId) => {
  console.log('=== Пример загрузки фотографий ===');
  
  try {
    // Делаем новое фото
    const photoResult = await cameraService.takePhoto();
    console.log('📸 Результат фото:', photoResult);
    
    if (photoResult.success) {
      // Загружаем фото на сервер
      const uploadResult = await fileUploadService.uploadPhoto(
        photoResult.data.uri,
        userId,
        1, // place_id
        '123456789012345', // IMEI
        'example-photo'
      );
      
      if (uploadResult.success) {
        console.log('✅ Фото загружено:', uploadResult.data);
        return uploadResult.data;
      } else {
        console.error('❌ Ошибка загрузки фото:', uploadResult.error);
        return null;
      }
    } else {
      console.log('ℹ️ Фото не было сделано');
      return null;
    }
  } catch (error) {
    console.error('❌ Исключение при загрузке фото:', error);
    return null;
  }
};

// Пример 6: Получение фотографий пользователя
export const exampleGetUserPhotos = async (userId) => {
  console.log('=== Пример получения фотографий пользователя ===');
  
  try {
    const result = await fileUploadService.getUserPhotos(userId);
    
    if (result.success) {
      console.log('✅ Фотографии получены:', result.data);
      console.log('📸 Количество фото:', result.data.photos?.length || 0);
      return result.data;
    } else {
      console.error('❌ Ошибка получения фотографий:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Исключение при получении фотографий:', error);
    return null;
  }
};

// Пример 7: Проверка статуса работника
export const exampleWorkerStatus = async (userId) => {
  console.log('=== Пример проверки статуса работника ===');
  
  try {
    const result = await punchService.getWorkerStatus(userId);
    
    if (result.success) {
      console.log('✅ Статус работника:', result.data);
      console.log('👷 Работает:', result.data.is_working ? 'Да' : 'Нет');
      return result.data;
    } else {
      console.error('❌ Ошибка получения статуса:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Исключение при получении статуса:', error);
    return null;
  }
};

// Пример 8: Полный рабочий цикл
export const exampleFullWorkCycle = async () => {
  console.log('=== Пример полного рабочего цикла ===');
  
  try {
    // 1. Аутентификация
    const userData = await exampleAuth();
    if (!userData) {
      console.error('❌ Не удалось аутентифицироваться');
      return;
    }
    
    const userId = userData.user_id || 123;
    console.log('👤 Пользователь аутентифицирован, ID:', userId);
    
    // 2. Проверяем текущий статус
    const status = await exampleWorkerStatus(userId);
    console.log('📊 Текущий статус:', status);
    
    // 3. Если не работает, начинаем смену
    if (!status?.is_working) {
      console.log('🚀 Начинаем смену...');
      await examplePunchIn(userId);
    }
    
    // 4. Добавляем несколько геопозиций
    console.log('📍 Добавляем геопозиции...');
    for (let i = 0; i < 3; i++) {
      await exampleGeoLocation(userId);
      // Небольшая задержка между позициями
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 5. Делаем несколько фото
    console.log('📸 Делаем фото...');
    for (let i = 0; i < 2; i++) {
      await examplePhotoUpload(userId);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 6. Завершаем смену
    console.log('🏁 Завершаем смену...');
    await examplePunchOut(userId);
    
    // 7. Просматриваем фотографии
    console.log('🖼️ Просматриваем фотографии...');
    await exampleGetUserPhotos(userId);
    
    console.log('✅ Полный рабочий цикл завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка в полном рабочем цикле:', error);
  }
};

// Пример 9: Работа с камерой
export const exampleCameraOperations = async () => {
  console.log('=== Пример работы с камерой ===');
  
  try {
    // Проверяем разрешения
    const permissions = await cameraService.checkCameraPermissions();
    console.log('🔐 Разрешения камеры:', permissions);
    
    // Получаем настройки по умолчанию
    const defaultOptions = cameraService.getDefaultOptions();
    console.log('⚙️ Настройки по умолчанию:', defaultOptions);
    
    // Обновляем настройки
    cameraService.updateDefaultOptions({
      quality: 0.9,
      maxWidth: 1280,
      maxHeight: 720,
    });
    
    const updatedOptions = cameraService.getDefaultOptions();
    console.log('⚙️ Обновленные настройки:', updatedOptions);
    
    // Выбираем фото из галереи
    const galleryResult = await cameraService.selectPhoto();
    console.log('🖼️ Результат выбора из галереи:', galleryResult);
    
    // Выбираем несколько фото
    const multipleResult = await cameraService.selectMultiplePhotos();
    console.log('🖼️ Результат выбора нескольких фото:', multipleResult);
    
  } catch (error) {
    console.error('❌ Ошибка при работе с камерой:', error);
  }
};

// Экспорт всех примеров
export const allExamples = {
  exampleAuth,
  examplePunchIn,
  examplePunchOut,
  exampleGeoLocation,
  examplePhotoUpload,
  exampleGetUserPhotos,
  exampleWorkerStatus,
  exampleFullWorkCycle,
  exampleCameraOperations,
};

// Функция для запуска всех примеров
export const runAllExamples = async () => {
  console.log('🚀 Запуск всех примеров...');
  
  for (const [name, example] of Object.entries(allExamples)) {
    if (name === 'exampleFullWorkCycle') continue; // Пропускаем полный цикл
    
    console.log(`\n--- Запуск ${name} ---`);
    try {
      await example();
    } catch (error) {
      console.error(`❌ Ошибка в ${name}:`, error);
    }
    
    // Пауза между примерами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Все примеры выполнены!');
};

export default allExamples;

