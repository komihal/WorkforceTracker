import React, { useState, useEffect } from 'react';
import { SafeAreaView, Text, BackHandler, AppState } from 'react-native';
import LoginScreen from './src/components/LoginScreen';
import MainScreen from './src/components/MainScreen';
import authService from './src/services/authService';
import punchService from './src/services/punchService';
import deviceUtils from './src/utils/deviceUtils';
import { initBgGeo, startTracking } from './src/location.js';
import backgroundService from './src/services/backgroundService';
import { getGeoConfig } from './src/config/geoConfig';
import { Alert } from 'react-native';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    console.log('===== APP USEFFECT CALLED =====');
    console.log('Current screen:', currentScreen);

    const onBackPress = () => {
      // Для экранам 'main' и 'login' используем поведение по умолчанию (выход из приложения)
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [currentScreen]);

  // Обработчик состояния приложения для автоматического закрытия смены
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      console.log('App state changed to:', nextAppState);
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Приложение уходит в фон или становится неактивным
        console.log('App going to background - auto-close DISABLED for testing');
        
        // ВРЕМЕННО ОТКЛЮЧЕНО для тестирования
        // try {
        //   const currentUser = await authService.getCurrentUser();
        //   if (currentUser && currentUser.user_id) {
        //     console.log('App going to background - checking if shift is active...');
        //     
        //     // Проверяем, активна ли смена
        //     const shiftResult = await punchService.getShiftStatus(currentUser.user_id);
        //     if (shiftResult.success && shiftResult.data.shift_active) {
        //       console.log('Shift is active, auto-closing...');
        //       
        //       // Останавливаем отслеживание геолокации
        //       // TODO: Добавить функцию остановки BG Geo
        //       
        //       // Автоматически закрываем смену
        //       const phoneImei = await deviceUtils.getDeviceId();
        //       const autoPunchResult = await punchService.autoPunchOut(currentUser.user_id, phoneImei);
        //       
        //       if (autoPunchResult.success) {
        //         console.log('Shift auto-closed successfully');
        //       } else {
        //         console.error('Failed to auto-close shift:', autoPunchResult.error);
        //       }
        //     } else {
        //       console.log('Shift is not active, no need to close');
        //     }
        //   }
        // } catch (error) {
        //   console.error('Error in app state change handler:', error);
        // }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentScreen('main');
        
        // Инициализируем BG Geolocation для существующего пользователя
        console.log('Initializing BG Geolocation for existing user...');
        console.log('User data:', user);
        try {
          // Инициализируем новый единый модуль BG Geo
          console.log('Calling initBgGeo...');
          await initBgGeo();
          console.log('BG Geolocation initialization completed');
          
          // Стартуем трекинг с userId
          await startTracking(user.user_id);
          
          // Инициализируем backgroundService только для фото
          console.log('Initializing backgroundService for photos only...');
          const phoneImei = await deviceUtils.getDeviceId();
          await backgroundService.initialize(user.user_id, 1, phoneImei, __DEV__);
          console.log('BackgroundService initialization completed (photos only)');
        } catch (locationError) {
          console.error('BG Geolocation initialization failed:', locationError);
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = async (userData) => {
    setCurrentScreen('main');
    
    // Инициализируем BG Geolocation для нового пользователя
    console.log('Initializing BG Geolocation for new user...');
    try {
      // Инициализируем новый единый модуль BG Geo
      console.log('Calling initBgGeo for new user...');
      await initBgGeo();
      console.log('BG Geolocation initialization completed for new user');
      
      // Стартуем трекинг с userId
      await startTracking(userData.user_id);
      
      // Инициализируем backgroundService только для фото
      console.log('Initializing backgroundService for photos only...');
      const phoneImei = await deviceUtils.getDeviceId();
      await backgroundService.initialize(userData.user_id, 1, phoneImei, __DEV__);
      console.log('BackgroundService initialization completed (photos only)');
    } catch (locationError) {
      console.error('BG Geolocation initialization failed:', locationError);
    }
  };

  const handleLogout = () => {
    setCurrentScreen('login');
  };



  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 18 }}>Загрузка...</Text>
      </SafeAreaView>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
      case 'main':
        return (
          <MainScreen 
            onLogout={handleLogout}
          />
        );
      default:
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {renderScreen()}
    </SafeAreaView>
  );
}
