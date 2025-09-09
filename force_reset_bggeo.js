// Принудительный сброс BGGeo конфигурации для исправления locationTemplate
// Этот файл можно импортировать для полного сброса BGGeo

import { resetLocationInit } from './src/location.js';

export const forceResetBGGeo = async () => {
  console.log('🔄 Принудительный сброс BGGeo конфигурации...');
  
  try {
    // Импортируем BGGeo
    const BackgroundGeolocation = require('react-native-background-geolocation');
    const BGGeo = BackgroundGeolocation.default || BackgroundGeolocation;
    
    if (BGGeo) {
      console.log('🛑 Останавливаем BGGeo...');
      await BGGeo.stop();
      
      console.log('🗑️ Сбрасываем конфигурацию...');
      await BGGeo.reset();
      
      console.log('🗑️ Очищаем данные...');
      await BGGeo.destroyLocations();
      await BGGeo.destroyLog();
      
      console.log('🗑️ Удаляем слушатели...');
      BGGeo.removeListeners();
      
      console.log('✅ Принудительный сброс BGGeo завершен');
      return { success: true };
    } else {
      console.log('❌ BGGeo не доступен');
      return { success: false, error: 'BGGeo not available' };
    }
  } catch (error) {
    console.log('❌ Ошибка принудительного сброса:', error);
    return { success: false, error: error.message };
  }
};

// Функция для проверки текущей конфигурации
export const checkBGGeoConfig = async () => {
  try {
    const BackgroundGeolocation = require('react-native-background-geolocation');
    const BGGeo = BackgroundGeolocation.default || BackgroundGeolocation;
    
    if (BGGeo) {
      const state = await BGGeo.getState();
      console.log('📊 Текущее состояние BGGeo:', {
        enabled: state.enabled,
        isMoving: state.isMoving,
        hasLocationTemplate: !!state.locationTemplate
      });
      
      if (state.locationTemplate) {
        console.log('📋 LocationTemplate:', state.locationTemplate);
        const hasMathFloor = state.locationTemplate.includes('Math.floor');
        console.log('🔍 Содержит Math.floor:', hasMathFloor);
        return { hasMathFloor, locationTemplate: state.locationTemplate };
      }
    }
    return { hasMathFloor: false, locationTemplate: null };
  } catch (error) {
    console.log('❌ Ошибка проверки конфигурации:', error);
    return { hasMathFloor: false, locationTemplate: null, error: error.message };
  }
};

console.log('🔄 Модуль принудительного сброса BGGeo загружен');
